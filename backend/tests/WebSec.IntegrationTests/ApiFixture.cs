using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Infrastructure.Scanning.Engine;
using WebSec.Shared.Models;
using WebSec.Shared.Responses;

namespace WebSec.IntegrationTests;

/// <summary>
/// Runs the real API (Development: migrations + dev seed) against a throwaway PostgreSQL database
/// created on the server in TEST_DATABASE_URL (default: the docker compose / local dev server) and dropped afterwards.
/// </summary>
public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly string _serverConnectionString;
    private readonly string _databaseName = $"websec_it_{Guid.NewGuid():N}";
    private readonly Dictionary<string, string> _tokens = [];

    public ApiFixture()
    {
        var builder = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("TEST_DATABASE_URL")
            ?? "Host=localhost;Port=5432;Database=postgres;Username=websec_dev;Password=change_me_local_only");
        _serverConnectionString = builder.ConnectionString;
        builder.Database = _databaseName;
        ConnectionString = builder.ConnectionString;
    }

    public string ConnectionString { get; }

    public async Task InitializeAsync()
    {
        try
        {
            await ExecuteOnServerAsync($"CREATE DATABASE \"{_databaseName}\"");
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException(
                "Integration tests need PostgreSQL with CREATEDB rights. Start it with `docker compose up -d postgres` or set TEST_DATABASE_URL.", ex);
        }
        // Program reads DATABASE_URL while registering services, so it must be in the environment before the host starts.
        Environment.SetEnvironmentVariable("DATABASE_URL", ConnectionString);
        _ = Server; // starts the host: migrate + seed roles, dev users and sample data
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await ExecuteOnServerAsync($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // Same mock engine, without the 1.5 s step delay.
        builder.ConfigureTestServices(s =>
        {
            s.RemoveAll<IScanEngine>();
            s.AddSingleton<IScanEngine>(new MockScanEngine(TimeSpan.Zero));
        });
    }

    public async Task<HttpClient> ClientAsAsync(string userName, string password)
    {
        if (!_tokens.TryGetValue(userName, out var token))
        {
            var res = await CreateClient().PostAsJsonAsync("/api/auth/login", new { userName, password }, Json);
            res.EnsureSuccessStatusCode();
            token = (await res.Content.ReadFromJsonAsync<ApiResponse<LoginResult>>(Json))!.Data!.AccessToken;
            _tokens[userName] = token;
        }
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public Task<HttpClient> AdminAsync() => ClientAsAsync("admin", "Admin@12345");

    /// <summary>What WebSec.Worker does per loop: claim queued jobs and process them, until the queue is empty.</summary>
    public async Task DrainScanQueueAsync()
    {
        while (true)
        {
            using var scope = Services.CreateScope();
            var job = await scope.ServiceProvider.GetRequiredService<IScanJobQueue>().ClaimNextAsync("integration-test", CancellationToken.None);
            if (job is null) return;
            await scope.ServiceProvider.GetRequiredService<ScanProcessor>().ProcessAsync(job, CancellationToken.None);
        }
    }

    private async Task ExecuteOnServerAsync(string sql)
    {
        await using var conn = new NpgsqlConnection(_serverConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

public static class HttpJson
{
    public static async Task<(HttpResponseMessage Response, ApiResponse<T> Body)> PostAsync<T>(this HttpClient client, string path, object body)
    {
        var res = await client.PostAsJsonAsync(path, body, ApiFixture.Json);
        var parsed = await res.Content.ReadFromJsonAsync<ApiResponse<T>>(ApiFixture.Json);
        return (res, parsed!);
    }
}

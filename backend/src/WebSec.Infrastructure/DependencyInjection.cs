using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WebSec.Infrastructure.AI;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Scanning;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Infrastructure.Scanning.Engine;
using WebSec.Infrastructure.Scanning.Queue;
using WebSec.Infrastructure.Services;
using WebSec.Shared.Entities;

namespace WebSec.Infrastructure;

public static class DependencyInjection
{
    public static string GetConnectionString(IConfiguration config) =>
        config["DATABASE_URL"] ?? config.GetConnectionString("Default")
        ?? throw new InvalidOperationException("DATABASE_URL (or ConnectionStrings:Default) is not configured.");

    public static void ConfigureDb(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention();

    /// <summary>Shared by API and Worker: database, scanning and AI.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config, IHostEnvironment env)
    {
        var cs = GetConnectionString(config);
        services.AddDbContext<AppDbContext>(o => ConfigureDb(o, cs));

        // Private/loopback targets are only ever allowed in Development, and only when explicitly enabled.
        services.AddSingleton(new ScanSafetyOptions
        {
            AllowPrivateTargets = env.IsDevelopment() && config.GetValue<bool>("ALLOW_PRIVATE_TARGETS"),
        });
        services.AddScoped<ITargetScopeValidator, TargetScopeValidator>();
        services.AddScoped<IScanJobQueue, DbScanJobQueue>();
        services.AddSingleton<IScanEngine>(new MockScanEngine());
        services.AddScoped<ScanProcessor>();

        var ai = new AiOptions { Provider = config["AI_PROVIDER"] ?? "mock" };
        services.AddSingleton(ai);
        // shortcut: only the mock adapter exists; add a real provider adapter here when AI_PROVIDER != mock.
        if (ai.Provider.Equals("mock", StringComparison.OrdinalIgnoreCase))
            services.AddSingleton<IAiAdvisor, MockAiAdvisor>();

        services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
        return services;
    }

    /// <summary>API-only business services.</summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ITargetService, TargetService>();
        services.AddScoped<IScanService, ScanService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IAiService, AiService>();
        return services;
    }
}

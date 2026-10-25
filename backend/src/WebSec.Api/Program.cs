using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WebSec.Api.Extensions;
using WebSec.Api.Middleware;
using WebSec.Infrastructure;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Data.Seed;
using WebSec.Shared.Entities;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole(o => o.IncludeScopes = true);

using var startupLoggerFactory = LoggerFactory.Create(l => l.AddConsole());
var startupLogger = startupLoggerFactory.CreateLogger("Startup");

builder.Services
    .AddInfrastructure(builder.Configuration, builder.Environment)
    .AddApplicationServices()
    .AddApiServices(builder.Configuration, builder.Environment, startupLogger);

var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors(ApiServiceExtensions.CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });
app.MapControllers();

await InitializeDatabaseAsync(app);
app.Run();

static async Task InitializeDatabaseAsync(WebApplication app)
{
    var config = app.Configuration;
    var isDev = app.Environment.IsDevelopment();
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbInit");

    var migrate = isDev || config.GetValue<bool>("APPLY_MIGRATIONS");
    var seedDevUsers = isDev || config.GetValue<bool>("SEED_DEV_DATA");
    if (migrate) await db.Database.MigrateAsync();
    if (migrate || seedDevUsers) await DevDataSeeder.SeedRolesAndPermissionsAsync(db);
    // Dev accounts only in Development or with an explicit flag.
    if (seedDevUsers)
    {
        await DevDataSeeder.SeedDevUsersAsync(db, scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>(), logger);
    }
}

public partial class Program;

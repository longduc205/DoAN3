using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WebSec.Infrastructure.Data;

/// <summary>Used only by `dotnet ef` tooling. Reads DATABASE_URL, falling back to the local docker-compose placeholder.</summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("DATABASE_URL")
                 ?? "Host=localhost;Port=5432;Database=websec_dev;Username=websec_dev;Password=change_me_local_only";
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DependencyInjection.ConfigureDb(options, cs);
        return new AppDbContext(options.Options);
    }
}

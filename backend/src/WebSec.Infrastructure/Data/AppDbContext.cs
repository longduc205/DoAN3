using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser? currentUser = null) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Target> Targets => Set<Target>();
    public DbSet<Scan> Scans => Set<Scan>();
    public DbSet<ScanJob> ScanJobs => Set<ScanJob>();
    public DbSet<ScanUrl> ScanUrls => Set<ScanUrl>();
    public DbSet<ScanFinding> ScanFindings => Set<ScanFinding>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<ProjectStatus>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<TargetEnvironment>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<ScopeMode>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<ScanType>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<ScanStatus>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<ScanJobStatus>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<Severity>().HaveConversion<string>().HaveMaxLength(30);
        builder.Properties<Confidence>().HaveConversion<string>().HaveMaxLength(30);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAuditFields();
        return base.SaveChanges();
    }

    private void ApplyAuditFields()
    {
        var now = DateTimeOffset.UtcNow;
        var userId = currentUser?.UserId;
        foreach (var entry in ChangeTracker.Entries<AuditEntity<Guid>>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedDate = now;
                entry.Entity.CreatedBy ??= userId;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedDate = now;
                entry.Entity.UpdatedBy = userId;
            }
        }
    }
}

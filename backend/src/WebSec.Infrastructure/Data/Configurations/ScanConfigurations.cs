using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebSec.Shared.Entities;

namespace WebSec.Infrastructure.Data.Configurations;

public class ScanConfiguration : IEntityTypeConfiguration<Scan>
{
    public void Configure(EntityTypeBuilder<Scan> b)
    {
        b.Property(x => x.ErrorCode).HasMaxLength(50);
        b.Property(x => x.ErrorMessageSafe).HasMaxLength(1000);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => x.ProjectId);
        b.HasIndex(x => x.TargetId);
        b.HasOne(x => x.Target).WithMany().HasForeignKey(x => x.TargetId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.RequestedBy).OnDelete(DeleteBehavior.Restrict);
        // Scans belong to soft-deletable targets; keep them visible with the same filter so EF does not warn.
        b.HasQueryFilter(x => !x.Target.IsDeleted);
    }
}

public class ScanJobConfiguration : IEntityTypeConfiguration<ScanJob>
{
    public void Configure(EntityTypeBuilder<ScanJob> b)
    {
        b.Property(x => x.LockedBy).HasMaxLength(200);
        b.Property(x => x.LastErrorSafe).HasMaxLength(1000);
        b.HasIndex(x => new { x.Status, x.AvailableAt });
        b.HasIndex(x => x.ScanId);
        b.HasOne<Scan>().WithMany().HasForeignKey(x => x.ScanId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ScanUrlConfiguration : IEntityTypeConfiguration<ScanUrl>
{
    public void Configure(EntityTypeBuilder<ScanUrl> b)
    {
        b.Property(x => x.Url).HasMaxLength(2048).IsRequired();
        b.Property(x => x.HttpMethod).HasMaxLength(10);
        b.Property(x => x.ContentType).HasMaxLength(200);
        b.HasIndex(x => x.ScanId);
        b.HasOne<Scan>().WithMany().HasForeignKey(x => x.ScanId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ScanFindingConfiguration : IEntityTypeConfiguration<ScanFinding>
{
    public void Configure(EntityTypeBuilder<ScanFinding> b)
    {
        b.Property(x => x.FindingType).HasMaxLength(100).IsRequired();
        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Url).HasMaxLength(2048).IsRequired();
        b.Property(x => x.ParameterName).HasMaxLength(200);
        b.Property(x => x.EvidenceSummary).HasMaxLength(4000);
        b.Property(x => x.DetectorName).HasMaxLength(100);
        b.Property(x => x.Fingerprint).HasMaxLength(128);
        b.HasIndex(x => x.ScanId);
        b.HasIndex(x => x.Fingerprint);
        b.HasIndex(x => x.Severity);
        b.HasOne<Scan>().WithMany().HasForeignKey(x => x.ScanId).OnDelete(DeleteBehavior.Cascade);
    }
}

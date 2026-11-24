using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WebSec.Infrastructure.AI;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Scanning;
using WebSec.Infrastructure.Scanning.Engine;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.UnitTests;

/// <summary>Uses EF InMemory: good for service logic, does not cover PostgreSQL-specific SQL (job claim, ILIKE).</summary>
public class ServiceTests
{
    private sealed class FakeUser(Guid id, string role) : ICurrentUser
    {
        public Guid? UserId => id;
        public bool IsInRole(string r) => r == role;
        public bool HasPermission(string p) => Roles.DefaultPermissions[role].Contains(p);
    }

    private static readonly Guid UserId = Guid.NewGuid();

    private static AppDbContext NewDb() => new(
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
        new FakeUser(UserId, Roles.SecurityAnalyst));

    private static (AppDbContext Db, Scan Scan, ScanJob Job) SeedQueuedScan(bool authorized = true)
    {
        var db = NewDb();
        var project = new Project { Id = Guid.NewGuid(), Code = "P", Name = "P", OwnerId = UserId };
        var target = new Target
        {
            Id = Guid.NewGuid(), ProjectId = project.Id, Name = "lab", BaseUrl = "http://127.0.0.1:3000/",
            IsEnabled = true, IsAuthorized = authorized,
        };
        var scan = new Scan { Id = Guid.NewGuid(), ProjectId = project.Id, TargetId = target.Id, RequestedBy = UserId, Status = ScanStatus.Queued };
        var job = new ScanJob { Id = Guid.NewGuid(), ScanId = scan.Id, Status = ScanJobStatus.Running };
        db.AddRange(project, target, scan, job);
        db.SaveChanges();
        return (db, scan, job);
    }

    private static ScanProcessor NewProcessor(AppDbContext db) => new(
        db, new TargetScopeValidator(new ScanSafetyOptions { AllowPrivateTargets = true }),
        new MockScanEngine(TimeSpan.Zero), NullLogger<ScanProcessor>.Instance);

    [Fact]
    public async Task Worker_CompletesScan_AndPersistsFindings()
    {
        var (db, scan, job) = SeedQueuedScan();
        await NewProcessor(db).ProcessAsync(job, default);

        var saved = await db.Scans.SingleAsync();
        Assert.Equal(ScanStatus.Completed, saved.Status);
        Assert.Equal(100, saved.ProgressPercent);
        Assert.Equal(3, saved.TotalFindings);
        Assert.Equal(3, await db.ScanFindings.CountAsync(f => f.ScanId == scan.Id));
        Assert.Equal(ScanJobStatus.Done, (await db.ScanJobs.SingleAsync()).Status);
    }

    [Fact]
    public async Task Worker_FailsScan_WhenTargetNoLongerInScope()
    {
        var (db, _, job) = SeedQueuedScan(authorized: false);
        await NewProcessor(db).ProcessAsync(job, default);

        var saved = await db.Scans.SingleAsync();
        Assert.Equal(ScanStatus.Failed, saved.Status);
        Assert.Equal("SCAN_SCOPE_REJECTED", saved.ErrorCode);
        Assert.Equal(0, await db.ScanFindings.CountAsync());
        Assert.Equal(ScanJobStatus.Failed, (await db.ScanJobs.SingleAsync()).Status);
    }

    [Fact]
    public async Task ProjectGetAll_ReturnsSummaryCounts()
    {
        var (db, scan, _) = SeedQueuedScan();
        var projectId = scan.ProjectId;
        var other = new Target { Id = Guid.NewGuid(), ProjectId = projectId, Name = "b", BaseUrl = "http://127.0.0.1:4000/", IsEnabled = true };
        db.Targets.Add(other);
        db.ScanFindings.AddRange(
            new ScanFinding { Id = Guid.NewGuid(), ScanId = scan.Id, TargetId = scan.TargetId, Fingerprint = "a" },
            new ScanFinding { Id = Guid.NewGuid(), ScanId = scan.Id, TargetId = scan.TargetId, Fingerprint = "a" },
            new ScanFinding { Id = Guid.NewGuid(), ScanId = scan.Id, TargetId = other.Id, Fingerprint = "b" });
        await db.SaveChangesAsync();

        var page = await new Infrastructure.Services.ProjectService(db, new FakeUser(UserId, Roles.SecurityAnalyst))
            .GetAllAsync(new Shared.Params.ProjectSearchParam(), default);

        var p = Assert.Single(page.Items);
        Assert.Equal(2, p.TargetCount);
        Assert.Equal(1, p.UnauthorizedTargetCount);
        Assert.Equal(2, p.FindingCount);
        Assert.True(p.IsScanning); // seeded scan is Queued
        Assert.Equal(2, p.Targets.Count);
        Assert.True(Assert.Single(p.Targets, x => x.Id == scan.TargetId).IsScanning);
        Assert.False(Assert.Single(p.Targets, x => x.Id == other.Id).IsAuthorized);
    }

    [Fact]
    public async Task ProjectGetAll_RiskScore_EnvironmentFilter_AndRiskSort()
    {
        var db = NewDb();
        Project NewProject(string name, TargetEnvironment env)
        {
            var project = new Project { Id = Guid.NewGuid(), Code = name, Name = name, OwnerId = UserId };
            db.Projects.Add(project);
            db.Targets.Add(new Target { Id = Guid.NewGuid(), ProjectId = project.Id, Name = name, BaseUrl = "http://127.0.0.1/", Environment = env });
            return project;
        }
        Vulnerability Vuln(Project p, Severity sev, VulnerabilityStatus status) =>
            new() { Id = Guid.NewGuid(), ProjectId = p.Id, TargetId = db.Targets.Local.First(t => t.ProjectId == p.Id).Id, Severity = sev, Status = status };
        var low = NewProject("A-low", TargetEnvironment.Lab);
        var high = NewProject("B-high", TargetEnvironment.Staging);
        db.Vulnerabilities.AddRange(
            Vuln(low, Severity.Low, VulnerabilityStatus.Open),
            Vuln(high, Severity.High, VulnerabilityStatus.Triaged),
            Vuln(high, Severity.Critical, VulnerabilityStatus.Resolved)); // closed: not counted
        await db.SaveChangesAsync();
        var service = new Infrastructure.Services.ProjectService(db, new FakeUser(UserId, Roles.SecurityAnalyst));

        var byRisk = await service.GetAllAsync(new Shared.Params.ProjectSearchParam { SortBy = "risk" }, default);
        Assert.Equal(["B-high", "A-low"], byRisk.Items.Select(p => p.Name));
        Assert.Equal((1, 10), (byRisk.Items[0].OpenVulnerabilityCount, byRisk.Items[0].RiskScore));
        Assert.Equal((1, 1), (byRisk.Items[1].OpenVulnerabilityCount, byRisk.Items[1].RiskScore));

        var staging = await service.GetAllAsync(new Shared.Params.ProjectSearchParam { Environment = TargetEnvironment.Staging }, default);
        Assert.Equal("B-high", Assert.Single(staging.Items).Name);
    }

    [Fact]
    public async Task ProjectDelete_IsSoftDelete()
    {
        var db = NewDb();
        var project = new Project { Id = Guid.NewGuid(), Code = "P", Name = "P", OwnerId = UserId };
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        await new Infrastructure.Services.ProjectService(db, new FakeUser(UserId, Roles.SecurityAnalyst)).DeleteAsync(project.Id, default);

        Assert.Equal(0, await db.Projects.CountAsync());
        var row = await db.Projects.IgnoreQueryFilters().SingleAsync();
        Assert.True(row.IsDeleted);
        Assert.NotNull(row.UpdatedDate);
    }

    [Fact]
    public async Task AiService_DoesNotModifyFindingOrScan()
    {
        var (db, scan, job) = SeedQueuedScan();
        await NewProcessor(db).ProcessAsync(job, default);
        var finding = await db.ScanFindings.FirstAsync();
        var before = (finding.Severity, scan.Status);

        var advice = await new AiService(db, new FakeUser(UserId, Roles.SecurityAnalyst), new MockAiAdvisor())
            .ExplainFindingAsync(new AiFindingRequest { FindingId = finding.Id }, default);

        Assert.True(advice.IsAiAssisted);
        Assert.False(db.ChangeTracker.HasChanges());
        var after = await db.ScanFindings.AsNoTracking().FirstAsync(f => f.Id == finding.Id);
        Assert.Equal(before.Severity, after.Severity);
    }
}

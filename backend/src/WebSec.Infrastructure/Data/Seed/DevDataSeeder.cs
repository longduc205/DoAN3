using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Data.Seed;

/// <summary>
/// Seeds roles and permissions (always safe, idempotent) and disposable DEVELOPMENT-ONLY accounts.
/// Callers must only invoke <see cref="SeedDevUsersAsync"/> in Development or with SEED_DEV_DATA=true.
/// </summary>
public static class DevDataSeeder
{
    // Local-only credentials, documented in README. Never reuse in any shared/production environment.
    public static readonly (string UserName, string Password, string FullName, string Role)[] DevUsers =
    [
        ("admin", "Admin@12345", "Dev Admin", Roles.Admin),
        ("analyst", "Analyst@12345", "Dev Analyst", Roles.SecurityAnalyst),
        ("developer", "Developer@12345", "Dev Developer", Roles.Developer),
        ("viewer", "Viewer@12345", "Dev Viewer", Roles.Viewer),
    ];

    public static async Task SeedRolesAndPermissionsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code, ct);
        foreach (var code in Permissions.All.Where(c => !permissions.ContainsKey(c)))
        {
            var p = new Permission { Id = Guid.NewGuid(), Code = code, Name = code, Module = code.Split('.')[0] };
            db.Permissions.Add(p);
            permissions[code] = p;
        }

        var roles = await db.Roles.Include(r => r.RolePermissions).ToDictionaryAsync(r => r.Code, ct);
        foreach (var (code, perms) in Roles.DefaultPermissions)
        {
            if (!roles.TryGetValue(code, out var role))
            {
                role = new Role { Id = Guid.NewGuid(), Code = code, Name = code, Deletable = false };
                db.Roles.Add(role);
            }
            foreach (var perm in perms.Where(pc => role.RolePermissions.All(rp => rp.PermissionId != permissions[pc].Id)))
                role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permissions[perm].Id });
        }
        await db.SaveChangesAsync(ct);
    }

    public static async Task SeedDevUsersAsync(AppDbContext db, IPasswordHasher<User> hasher, ILogger logger, CancellationToken ct = default)
    {
        var roles = await db.Roles.ToDictionaryAsync(r => r.Code, ct);
        foreach (var (userName, password, fullName, role) in DevUsers)
        {
            if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.UserName == userName, ct)) continue;
            var user = new User { Id = Guid.NewGuid(), UserName = userName, Email = $"{userName}@websec.local", FullName = fullName };
            user.PasswordHash = hasher.HashPassword(user, password);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roles[role].Id });
            db.Users.Add(user);
            logger.LogInformation("Seeded development user {UserName} ({Role})", userName, role);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// DEVELOPMENT-ONLY sample projects/targets/scan history so the UI isn't empty. Idempotent (per project code).
    /// Targets use reserved <c>.test</c> hostnames and seeded scans are already finished: no ScanJob is queued,
    /// so nothing is ever sent over the network by this seed.
    /// </summary>
    public static async Task SeedDevSampleDataAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var owners = await db.Users.Where(u => u.UserName == "analyst" || u.UserName == "admin")
            .ToDictionaryAsync(u => u.UserName, u => u.Id, ct);
        if (!owners.TryGetValue("analyst", out var analystId)) return;
        var adminId = owners.GetValueOrDefault("admin", analystId);
        var now = DateTimeOffset.UtcNow;

        var samples = new[]
        {
            (Code: "DEMO-SHOP", Name: "Demo Shop", Description: "Sample e-commerce lab app (dev seed).", Owner: analystId, Status: ProjectStatus.Active),
            (Code: "DEMO-BLOG", Name: "Demo Blog", Description: "Sample blog lab app (dev seed).", Owner: analystId, Status: ProjectStatus.Active),
            (Code: "DEMO-LEGACY", Name: "Legacy Portal", Description: "Archived sample project (dev seed).", Owner: adminId, Status: ProjectStatus.Archived),
        };
        var existing = await db.Projects.IgnoreQueryFilters().Where(p => p.Code.StartsWith("DEMO-")).Select(p => p.Code).ToListAsync(ct);

        foreach (var s in samples.Where(s => !existing.Contains(s.Code)))
        {
            var project = new Project { Id = Guid.NewGuid(), Code = s.Code, Name = s.Name, Description = s.Description, OwnerId = s.Owner, Status = s.Status, CreatedBy = s.Owner };
            db.Projects.Add(project);
            var host = s.Code.ToLowerInvariant().Replace("demo-", "") + ".test";

            Target AddTarget(string name, string url, TargetEnvironment env, bool enabled, bool authorized)
            {
                var t = new Target { Id = Guid.NewGuid(), ProjectId = project.Id, Name = name, BaseUrl = url, Environment = env, IsEnabled = enabled, IsAuthorized = authorized, CreatedBy = s.Owner };
                db.Targets.Add(t);
                return t;
            }

            var lab = AddTarget("Lab", $"http://{host}/", TargetEnvironment.Lab, enabled: true, authorized: true);
            AddTarget("Staging (chưa xác nhận quyền)", $"http://staging.{host}/", TargetEnvironment.Staging, enabled: true, authorized: false);
            if (s.Status == ProjectStatus.Active)
                AddTarget("Dev (tắt)", $"http://dev.{host}/app/", TargetEnvironment.Development, enabled: false, authorized: true);

            if (s.Status == ProjectStatus.Active)
            {
                AddCompletedScan(db, project.Id, lab, s.Owner, now.AddDays(-3), withHsts: true);
                AddCompletedScan(db, project.Id, lab, s.Owner, now.AddHours(-5), withHsts: false);
                db.Scans.Add(new Scan
                {
                    Id = Guid.NewGuid(), ProjectId = project.Id, TargetId = lab.Id, RequestedBy = s.Owner, ScanType = ScanType.Mock,
                    Status = ScanStatus.Failed, ProgressPercent = 40, CreatedAt = now.AddDays(-1), StartedAt = now.AddDays(-1),
                    CompletedAt = now.AddDays(-1).AddSeconds(8), ErrorCode = "TARGET_UNREACHABLE", ErrorMessageSafe = "[sample] Target did not respond.",
                });
            }
            logger.LogInformation("Seeded development sample project {Code}", s.Code);
        }
        await db.SaveChangesAsync(ct);
    }

    private static void AddCompletedScan(AppDbContext db, Guid projectId, Target target, Guid requestedBy, DateTimeOffset startedAt, bool withHsts)
    {
        var root = target.BaseUrl.TrimEnd('/');
        var scan = new Scan
        {
            Id = Guid.NewGuid(), ProjectId = projectId, TargetId = target.Id, RequestedBy = requestedBy, ScanType = ScanType.Mock,
            Status = ScanStatus.Completed, ProgressPercent = 100, CreatedAt = startedAt, StartedAt = startedAt, CompletedAt = startedAt.AddSeconds(6),
        };
        string[] paths = ["/", "/login", "/search?q="];
        foreach (var path in paths)
            db.ScanUrls.Add(new ScanUrl { Id = Guid.NewGuid(), ScanId = scan.Id, Url = root + path, StatusCode = 200, ContentType = "text/html", DiscoveredAt = startedAt.AddSeconds(2), IsInScope = true });

        var findings = new List<(string Type, string Title, string Url, string? Param, Severity Sev, Confidence Conf, string Evidence)>
        {
            ("MissingContentSecurityPolicy", "Missing Content-Security-Policy header", root + "/", null, Severity.Medium, Confidence.High, "[sample] Response has no Content-Security-Policy header."),
            ("ServerBannerDisclosure", "Server version disclosed in response header", root + "/", null, Severity.Info, Confidence.Medium, "[sample] Server: demo-server/1.0"),
            ("CookieWithoutSecureFlag", "Session cookie without Secure/HttpOnly flag", root + "/login", "sessionid", Severity.High, Confidence.Medium, "[sample] Set-Cookie: sessionid=<redacted>; Path=/"),
        };
        if (withHsts)
            findings.Add(("MissingHsts", "Missing Strict-Transport-Security header", root + "/", null, Severity.Low, Confidence.High, "[sample] Response has no Strict-Transport-Security header."));

        foreach (var f in findings)
            db.ScanFindings.Add(new ScanFinding
            {
                Id = Guid.NewGuid(), ScanId = scan.Id, TargetId = target.Id, FindingType = f.Type, Title = f.Title, Url = f.Url, ParameterName = f.Param,
                Severity = f.Sev, Confidence = f.Conf, EvidenceSummary = f.Evidence, EvidenceRedacted = f.Param is not null, DetectorName = "DevSeed",
                // Same formula as ScanProcessor so findings dedupe across scans.
                Fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{target.Id}|{f.Type}|{f.Url}|{f.Param}"))),
                DetectedAt = startedAt.AddSeconds(4),
            });

        scan.TotalUrls = paths.Length;
        scan.TotalRequests = paths.Length;
        scan.TotalFindings = findings.Count;
        db.Scans.Add(scan);
        if (target.LastScanAt is null || target.LastScanAt < scan.CompletedAt) target.LastScanAt = scan.CompletedAt;
    }
}

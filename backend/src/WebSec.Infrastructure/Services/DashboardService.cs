using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Vulnerabilities;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;

namespace WebSec.Infrastructure.Services;

public class DashboardService(AppDbContext db, ICurrentUser currentUser) : IDashboardService
{
    /// <summary>Risk weights per open vulnerability; documented in docs/DATA_MODEL.md.</summary>
    public static readonly IReadOnlyDictionary<Severity, int> RiskWeights = new Dictionary<Severity, int>
    {
        [Severity.Critical] = 25, [Severity.High] = 10, [Severity.Medium] = 4, [Severity.Low] = 1, [Severity.Info] = 0,
    };

    public static int RiskScore(IReadOnlyDictionary<Severity, int> openBySeverity) =>
        Math.Min(100, openBySeverity.Sum(kv => RiskWeights[kv.Key] * kv.Value));

    public async Task<DashboardSummaryModel> GetSummaryAsync(CancellationToken ct)
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        var scanIds = db.Scans.Where(s => projectIds.Contains(s.ProjectId)).Select(s => s.Id);
        var bySeverity = await db.ScanFindings.Where(f => scanIds.Contains(f.ScanId))
            .GroupBy(f => f.Severity).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);

        // Same visibility as the vulnerability list: own projects + items assigned to me (developers).
        var me = currentUser.UserId ?? Guid.Empty;
        var vulns = db.Vulnerabilities.Where(v => projectIds.Contains(v.ProjectId) || v.AssigneeId == me);
        var byStatus = await vulns.GroupBy(v => v.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var openStatuses = VulnerabilityStateMachine.OpenStatuses;
        var open = vulns.Where(v => openStatuses.Contains(v.Status));
        var openBySeverity = (await open.GroupBy(v => v.Severity).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct))
            .ToDictionary(x => x.Key, x => x.Count);

        return new DashboardSummaryModel
        {
            Projects = await projectIds.CountAsync(ct),
            Targets = await db.Targets.CountAsync(t => projectIds.Contains(t.ProjectId), ct),
            Scans = await scanIds.CountAsync(ct),
            Findings = bySeverity.Sum(x => x.Count),
            FindingsBySeverity = bySeverity.ToDictionary(x => x.Key, x => x.Count),
            OpenVulnerabilities = openBySeverity.Values.Sum(),
            OpenBySeverity = openBySeverity,
            ByStatus = byStatus.ToDictionary(x => x.Key, x => x.Count),
            Reappeared = await vulns.CountAsync(v => v.IsReappeared, ct),
            Unassigned = await open.CountAsync(v => v.AssigneeId == null, ct),
            RiskScore = RiskScore(openBySeverity),
        };
    }
}

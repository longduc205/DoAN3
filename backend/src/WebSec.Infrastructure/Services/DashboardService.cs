using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Models;

namespace WebSec.Infrastructure.Services;

public class DashboardService(AppDbContext db, ICurrentUser currentUser) : IDashboardService
{
    public async Task<DashboardSummaryModel> GetSummaryAsync(CancellationToken ct)
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        var scanIds = db.Scans.Where(s => projectIds.Contains(s.ProjectId)).Select(s => s.Id);
        var bySeverity = await db.ScanFindings.Where(f => scanIds.Contains(f.ScanId))
            .GroupBy(f => f.Severity).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);

        return new DashboardSummaryModel
        {
            Projects = await projectIds.CountAsync(ct),
            Targets = await db.Targets.CountAsync(t => projectIds.Contains(t.ProjectId), ct),
            Scans = await scanIds.CountAsync(ct),
            Findings = bySeverity.Sum(x => x.Count),
            FindingsBySeverity = bySeverity.ToDictionary(x => x.Key, x => x.Count),
        };
    }
}

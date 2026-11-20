using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Infrastructure.Vulnerabilities;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

// shortcut: reports are built synchronously in the request and "PDF" is the browser's print dialog;
// move to a background job + PDF library once reports get large or need a stored file.
public class ReportService(AppDbContext db, ICurrentUser currentUser, IAuditLogger? audit = null) : IReportService
{
    private const int ExecutiveTopN = 10;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Task<PagedResult<ReportModel>> GetAllAsync(ReportSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var q = Accessible();
        if (param.ProjectId is { } pid) q = q.Where(r => r.ProjectId == pid);
        return ToModel(q.OrderByDescending(r => r.CreatedAt)).ToPagedAsync(param, x => x, ct);
    }

    public async Task<ReportDetailModel> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var m = await ToModel(Accessible().Where(r => r.Id == id)).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("report");
        var json = await db.Reports.Where(r => r.Id == id).Select(r => r.SnapshotJson).FirstAsync(ct);
        return new ReportDetailModel
        {
            Id = m.Id, ProjectId = m.ProjectId, ProjectName = m.ProjectName, Title = m.Title, Template = m.Template, Status = m.Status,
            ErrorSafe = m.ErrorSafe, CreatedByName = m.CreatedByName, CreatedAt = m.CreatedAt, CompletedAt = m.CompletedAt,
            Snapshot = json is null ? null : JsonSerializer.Deserialize<ReportSnapshotModel>(json, Json),
        };
    }

    public async Task<ReportDetailModel> CreateAsync(CreateReportRequest request, CancellationToken ct)
    {
        var project = await db.AccessibleProjects(currentUser).FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct)
            ?? throw AppException.NotFound("project");
        // W11: explain the "no data" case in the dialog instead of producing an empty report.
        if (!await db.Scans.AnyAsync(s => s.ProjectId == project.Id, ct))
            throw AppException.Validation("This project has no scans yet, so there is nothing to report. Run a scan first.");

        var now = DateTimeOffset.UtcNow;
        var report = new Report
        {
            Id = Guid.NewGuid(), ProjectId = project.Id, Template = request.Template, CreatedAt = now,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{project.Name} · {request.Template} · {now:yyyy-MM-dd}" : request.Title.Trim(),
            CreatedBy = currentUser.UserId ?? throw AppException.Forbidden(),
        };
        db.Reports.Add(report);
        audit?.Add("REPORT_CREATED", "Report", report.Id, $"Report '{report.Title}' ({report.Template})");
        await GenerateAsync(report, project, ct);
        return await GetByIdAsync(report.Id, ct);
    }

    /// <summary>Only a Failed report can be retried; Ready ones are immutable (A10).</summary>
    public async Task<ReportDetailModel> RetryAsync(Guid id, CancellationToken ct)
    {
        var report = await Accessible().FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("report");
        if (report.Status != ReportStatus.Failed) throw AppException.Conflict("Only a failed report can be retried.");
        var project = await db.Projects.FirstAsync(p => p.Id == report.ProjectId, ct);
        await GenerateAsync(report, project, ct);
        return await GetByIdAsync(report.Id, ct);
    }

    private async Task GenerateAsync(Report report, Project project, CancellationToken ct)
    {
        try
        {
            report.SnapshotJson = JsonSerializer.Serialize(await BuildSnapshotAsync(report, project, ct), Json);
            report.Status = ReportStatus.Ready;
            report.ErrorSafe = null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            report.Status = ReportStatus.Failed;
            report.ErrorSafe = "The report could not be generated. Try again."; // never leak internals
        }
        report.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task<ReportSnapshotModel> BuildSnapshotAsync(Report report, Project project, CancellationToken ct)
    {
        var vulns = db.Vulnerabilities.Where(v => v.ProjectId == project.Id);
        var openStatuses = VulnerabilityStateMachine.OpenStatuses;
        var openBySeverity = (await vulns.Where(v => openStatuses.Contains(v.Status)).GroupBy(v => v.Severity)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct)).ToDictionary(x => x.Key, x => x.Count);
        var rows = await vulns.Select(v => new ReportVulnerabilityRow
        {
            Title = v.Title, FindingType = v.FindingType, Severity = v.Severity, Status = v.Status, TargetName = v.Target.Name, Url = v.Url,
            AssigneeName = db.Users.Where(u => u.Id == v.AssigneeId).Select(u => u.FullName).FirstOrDefault(), FirstDetectedAt = v.FirstDetectedAt,
        }).ToListAsync(ct);
        // Most severe open items first; the executive template keeps only the top of that list.
        rows = rows.OrderBy(r => VulnerabilityStateMachine.IsOpen(r.Status) ? 0 : 1).ThenByDescending(r => (int)r.Severity).ThenBy(r => r.Title).ToList();
        if (report.Template == ReportTemplate.Executive) rows = rows.Where(r => VulnerabilityStateMachine.IsOpen(r.Status)).Take(ExecutiveTopN).ToList();

        return new ReportSnapshotModel
        {
            ProjectCode = project.Code, ProjectName = project.Name, GeneratedAt = DateTimeOffset.UtcNow,
            Targets = await db.Targets.CountAsync(t => t.ProjectId == project.Id, ct),
            Scans = await db.Scans.CountAsync(s => s.ProjectId == project.Id, ct),
            LastScanAt = await db.Scans.Where(s => s.ProjectId == project.Id).MaxAsync(s => s.CompletedAt, ct),
            OpenVulnerabilities = openBySeverity.Values.Sum(),
            RiskScore = DashboardService.RiskScore(openBySeverity),
            OpenBySeverity = openBySeverity,
            ByStatus = (await vulns.GroupBy(v => v.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct)).ToDictionary(x => x.Key, x => x.Count),
            Vulnerabilities = rows,
        };
    }

    private IQueryable<Report> Accessible()
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        return db.Reports.Where(r => projectIds.Contains(r.ProjectId));
    }

    private IQueryable<ReportModel> ToModel(IQueryable<Report> q) => q.Select(r => new ReportModel
    {
        Id = r.Id, ProjectId = r.ProjectId, Title = r.Title, Template = r.Template, Status = r.Status, ErrorSafe = r.ErrorSafe,
        CreatedAt = r.CreatedAt, CompletedAt = r.CompletedAt,
        ProjectName = db.Projects.Where(p => p.Id == r.ProjectId).Select(p => p.Name).FirstOrDefault() ?? string.Empty,
        CreatedByName = db.Users.Where(u => u.Id == r.CreatedBy).Select(u => u.FullName).FirstOrDefault(),
    });
}

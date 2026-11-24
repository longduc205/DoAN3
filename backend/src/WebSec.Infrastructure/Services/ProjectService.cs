using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Infrastructure.Mapping;
using WebSec.Infrastructure.Vulnerabilities;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

public class ProjectService(AppDbContext db, ICurrentUser currentUser, IAuditLogger? audit = null) : IProjectService
{
    private static readonly Dictionary<string, Expression<Func<Project, object>>> Sorts = new(StringComparer.OrdinalIgnoreCase)
    {
        ["code"] = p => p.Code,
        ["name"] = p => p.Name,
        ["createdDate"] = p => p.CreatedDate,
        ["updatedDate"] = p => p.UpdatedDate ?? p.CreatedDate,
    };

    private static readonly ScanStatus[] ActiveScanStatuses = [ScanStatus.Pending, ScanStatus.Queued, ScanStatus.Running, ScanStatus.Cancelling];

    public async Task<PagedResult<ProjectModel>> GetAllAsync(ProjectSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var query = db.AccessibleProjects(currentUser);
        if (param.Keyword is { } kw)
        {
            var pattern = $"%{kw}%";
            query = query.Where(p => EF.Functions.ILike(p.Name, pattern) || EF.Functions.ILike(p.Code, pattern));
        }
        if (param.IsActive is { } active) query = query.Where(p => p.IsActive == active);
        if (param.Status is { } status) query = query.Where(p => p.Status == status);
        if (param.Environment is { } env) query = query.Where(p => db.Targets.Any(t => t.ProjectId == p.Id && t.Environment == env));
        var sorted = string.Equals(param.SortBy, "risk", StringComparison.OrdinalIgnoreCase) ? SortByRisk(query, param.SortDirection) : query.SortBy(param, Sorts, "createdDate");
        var page = await sorted.ToPagedAsync(param, AppMapper.ToModel, ct);
        await FillSummaryAsync(page.Items, ct);
        return page;
    }

    /// <summary>Orders by the uncapped risk sum so the database can sort it; weights mirror DashboardService.RiskWeights.</summary>
    private IQueryable<Project> SortByRisk(IQueryable<Project> query, SortDirection direction)
    {
        var open = VulnerabilityStateMachine.OpenStatuses;
        Expression<Func<Project, int>> risk = p => db.Vulnerabilities.Where(v => v.ProjectId == p.Id && open.Contains(v.Status))
            .Sum(v => v.Severity == Severity.Critical ? 25 : v.Severity == Severity.High ? 10 : v.Severity == Severity.Medium ? 4 : v.Severity == Severity.Low ? 1 : 0);
        return (direction == SortDirection.Asc ? query.OrderBy(risk) : query.OrderByDescending(risk)).ThenBy(p => p.Name);
    }

    /// <summary>One grouped query per metric for the whole page (no N+1).</summary>
    private async Task FillSummaryAsync(IReadOnlyList<ProjectModel> items, CancellationToken ct)
    {
        if (items.Count == 0) return;
        var ids = items.Select(p => p.Id).ToList();

        var targets = await db.Targets.Where(t => ids.Contains(t.ProjectId))
            .GroupBy(t => t.ProjectId)
            .Select(g => new
            {
                ProjectId = g.Key,
                Total = g.Count(),
                Unauthorized = g.Count(t => t.IsEnabled && !t.IsAuthorized),
                LastScanAt = g.Max(t => t.LastScanAt),
            })
            .ToDictionaryAsync(x => x.ProjectId, ct);

        var scanningTargets = (await db.Scans.Where(s => ids.Contains(s.ProjectId) && ActiveScanStatuses.Contains(s.Status))
            .Select(s => new { s.ProjectId, s.TargetId }).Distinct().ToListAsync(ct));
        var scanning = scanningTargets.Select(s => s.ProjectId).ToHashSet();
        var scanningTargetIds = scanningTargets.Select(s => s.TargetId).ToHashSet();

        // shortcut: loads every target of the page's projects, then keeps 3 each; fine while projects hold a handful of targets.
        var previews = (await db.Targets.Where(t => ids.Contains(t.ProjectId))
            .OrderByDescending(t => t.CreatedDate)
            .Select(t => new { t.ProjectId, t.Id, t.Name, t.IsAuthorized })
            .ToListAsync(ct))
            .ToLookup(t => t.ProjectId, t => new ProjectTargetPreview(t.Id, t.Name, t.IsAuthorized, scanningTargetIds.Contains(t.Id)));

        var findings = await db.ScanFindings
            .Join(db.Targets.Where(t => ids.Contains(t.ProjectId)), f => f.TargetId, t => t.Id, (f, t) => new { t.ProjectId, f.Fingerprint })
            .GroupBy(x => x.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Select(x => x.Fingerprint).Distinct().Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count, ct);

        var openStatuses = VulnerabilityStateMachine.OpenStatuses;
        var openVulns = (await db.Vulnerabilities.Where(v => ids.Contains(v.ProjectId) && openStatuses.Contains(v.Status))
            .GroupBy(v => new { v.ProjectId, v.Severity })
            .Select(g => new { g.Key.ProjectId, g.Key.Severity, Count = g.Count() })
            .ToListAsync(ct))
            .ToLookup(x => x.ProjectId);

        foreach (var p in items)
        {
            if (targets.TryGetValue(p.Id, out var t))
            {
                p.TargetCount = t.Total;
                p.UnauthorizedTargetCount = t.Unauthorized;
                p.LastScanAt = t.LastScanAt;
            }
            p.IsScanning = scanning.Contains(p.Id);
            p.Targets = previews[p.Id].Take(3).ToList();
            p.FindingCount = findings.GetValueOrDefault(p.Id);
            var bySeverity = openVulns[p.Id].ToDictionary(x => x.Severity, x => x.Count);
            p.OpenVulnerabilityCount = bySeverity.Values.Sum();
            p.RiskScore = DashboardService.RiskScore(bySeverity);
        }
    }

    public async Task<ProjectModel> GetByIdAsync(Guid id, CancellationToken ct) => (await FindAsync(id, ct)).ToModel();

    public async Task<ProjectModel> CreateAsync(CreateProjectRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        await EnsureCodeUniqueAsync(code, null, ct);
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            OwnerId = currentUser.UserId ?? throw AppException.Forbidden(),
        };
        db.Projects.Add(project);
        audit?.Add("PROJECT_CREATED", "Project", project.Id, $"Created project {project.Code}");
        await db.SaveChangesAsync(ct);
        return project.ToModel();
    }

    public async Task<ProjectModel> UpdateAsync(UpdateProjectRequest request, CancellationToken ct)
    {
        var project = await FindAsync(request.Id, ct);
        var code = request.Code.Trim().ToUpperInvariant();
        await EnsureCodeUniqueAsync(code, project.Id, ct);
        var before = new { project.Code, project.Name, project.Status };
        project.Code = code;
        project.Name = request.Name.Trim();
        project.Description = request.Description?.Trim();
        project.Status = request.Status;
        audit?.Add("PROJECT_UPDATED", "Project", project.Id, $"Updated project {project.Code}",
            new { before, after = new { project.Code, project.Name, project.Status } });
        await db.SaveChangesAsync(ct);
        return project.ToModel();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var project = await FindAsync(id, ct);
        if (!project.Deletable) throw AppException.Conflict("This project cannot be deleted.");
        project.IsDeleted = true;
        audit?.Add("PROJECT_DELETED", "Project", project.Id, $"Deleted project {project.Code}");
        await db.SaveChangesAsync(ct);
    }

    private async Task<Project> FindAsync(Guid id, CancellationToken ct) =>
        await db.AccessibleProjects(currentUser).FirstOrDefaultAsync(p => p.Id == id, ct)
        ?? throw AppException.NotFound("project");

    private async Task EnsureCodeUniqueAsync(string code, Guid? exceptId, CancellationToken ct)
    {
        if (await db.Projects.AnyAsync(p => p.Code == code && p.Id != exceptId, ct))
            throw AppException.Conflict($"Project code '{code}' already exists.");
    }
}

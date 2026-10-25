using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Mapping;
using WebSec.Infrastructure.Scanning;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

public class ScanService(AppDbContext db, ICurrentUser currentUser, ITargetScopeValidator scopeValidator) : IScanService
{
    public Task<PagedResult<ScanModel>> GetAllAsync(ScanSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var query = AccessibleScans();
        if (param.ProjectId is { } projectId) query = query.Where(s => s.ProjectId == projectId);
        if (param.TargetId is { } targetId) query = query.Where(s => s.TargetId == targetId);
        if (param.Status is { } status) query = query.Where(s => s.Status == status);
        query = param.SortDirection == SortDirection.Asc ? query.OrderBy(s => s.CreatedAt) : query.OrderByDescending(s => s.CreatedAt);
        return query.ToPagedAsync(param, AppMapper.ToModel, ct);
    }

    public async Task<ScanModel> GetByIdAsync(Guid id, CancellationToken ct) => (await FindAsync(id, ct)).ToModel();

    public async Task<ScanModel> CreateAsync(CreateScanRequest request, CancellationToken ct)
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        var target = await db.Targets.FirstOrDefaultAsync(t => t.Id == request.TargetId && projectIds.Contains(t.ProjectId), ct)
            ?? throw AppException.NotFound("target");

        // Scope is checked BEFORE anything is queued.
        var scopeError = await scopeValidator.ValidateAsync(target, ct);
        if (scopeError is not null) throw AppException.ScopeRejected(scopeError);

        var now = DateTimeOffset.UtcNow;
        var scan = new Scan
        {
            Id = Guid.NewGuid(),
            ProjectId = target.ProjectId,
            TargetId = target.Id,
            Target = target,
            RequestedBy = currentUser.UserId ?? throw AppException.Forbidden(),
            ScanType = request.ScanType,
            Status = ScanStatus.Queued, // Pending -> Queued happens atomically with job creation below.
            CreatedAt = now,
        };
        // Scan + job are saved in one SaveChanges call = one transaction; no orphan scans.
        db.Scans.Add(scan);
        db.ScanJobs.Add(new ScanJob { Id = Guid.NewGuid(), ScanId = scan.Id, Status = ScanJobStatus.Queued, AvailableAt = now, CreatedAt = now });
        await db.SaveChangesAsync(ct);
        return scan.ToModel();
    }

    public async Task<ScanProgressModel> GetProgressAsync(Guid id, CancellationToken ct)
    {
        var s = await FindAsync(id, ct);
        return new ScanProgressModel
        {
            Id = s.Id, Status = s.Status, ProgressPercent = s.ProgressPercent, TotalUrls = s.TotalUrls,
            TotalRequests = s.TotalRequests, TotalFindings = s.TotalFindings, IsTerminal = ScanStateMachine.IsTerminal(s.Status),
        };
    }

    public async Task<ScanModel> CancelAsync(Guid id, CancellationToken ct)
    {
        var scan = await FindAsync(id, ct);
        // Queued: nothing is running yet, cancel immediately. Running: ask the worker to stop cooperatively.
        var next = scan.Status == ScanStatus.Running ? ScanStatus.Cancelling : ScanStatus.Cancelled;
        if (!ScanStateMachine.CanTransition(scan.Status, next))
            throw AppException.Conflict($"A scan in status {scan.Status} cannot be cancelled.");
        scan.Status = next;
        if (next == ScanStatus.Cancelled) scan.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return scan.ToModel();
    }

    public async Task<PagedResult<ScanFindingModel>> GetFindingsAsync(FindingSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        await FindAsync(param.ScanId, ct); // access check
        var query = db.ScanFindings.Where(f => f.ScanId == param.ScanId);
        if (param.Severity is { } sev) query = query.Where(f => f.Severity == sev);
        // Severity is stored as text, so rank it explicitly instead of sorting alphabetically.
        return await query
            .OrderByDescending(f => f.Severity == Severity.Critical ? 4 : f.Severity == Severity.High ? 3
                : f.Severity == Severity.Medium ? 2 : f.Severity == Severity.Low ? 1 : 0)
            .ThenBy(f => f.Title)
            .ToPagedAsync(param, AppMapper.ToModel, ct);
    }

    private IQueryable<Scan> AccessibleScans()
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        return db.Scans.Include(s => s.Target).Where(s => projectIds.Contains(s.ProjectId));
    }

    private async Task<Scan> FindAsync(Guid id, CancellationToken ct) =>
        await AccessibleScans().FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw AppException.NotFound("scan");
}

using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Mapping;
using WebSec.Infrastructure.Scanning;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

public class TargetService(AppDbContext db, ICurrentUser currentUser) : ITargetService
{
    private static readonly Dictionary<string, Expression<Func<Target, object>>> Sorts = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = t => t.Name,
        ["baseUrl"] = t => t.BaseUrl,
        ["createdDate"] = t => t.CreatedDate,
    };

    public Task<PagedResult<TargetModel>> GetAllAsync(TargetSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var query = AccessibleTargets();
        if (param.ProjectId is { } projectId) query = query.Where(t => t.ProjectId == projectId);
        if (param.Keyword is { } kw)
        {
            var pattern = $"%{kw}%";
            query = query.Where(t => EF.Functions.ILike(t.Name, pattern) || EF.Functions.ILike(t.BaseUrl, pattern));
        }
        if (param.IsActive is { } active) query = query.Where(t => t.IsActive == active);
        return query.SortBy(param, Sorts, "createdDate").ToPagedAsync(param, AppMapper.ToModel, ct);
    }

    public async Task<TargetModel> GetByIdAsync(Guid id, CancellationToken ct) => (await FindAsync(id, ct)).ToModel();

    public async Task<TargetModel> CreateAsync(CreateTargetRequest request, CancellationToken ct)
    {
        if (!await db.AccessibleProjects(currentUser).AnyAsync(p => p.Id == request.ProjectId, ct))
            throw AppException.NotFound("project");

        var target = new Target { Id = Guid.NewGuid() };
        request.ApplyTo(target);
        target.BaseUrl = NormalizeUrl(request.BaseUrl);
        db.Targets.Add(target);
        await db.SaveChangesAsync(ct);
        return target.ToModel();
    }

    public async Task<TargetModel> UpdateAsync(UpdateTargetRequest request, CancellationToken ct)
    {
        var target = await FindAsync(request.Id, ct);
        if (target.ProjectId != request.ProjectId) throw AppException.Validation("A target cannot be moved to another project.");
        request.ApplyTo(target);
        target.BaseUrl = NormalizeUrl(request.BaseUrl);
        await db.SaveChangesAsync(ct);
        return target.ToModel();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var target = await FindAsync(id, ct);
        // Soft delete + disable; scan history stays in the database.
        target.IsDeleted = true;
        target.IsEnabled = false;
        await db.SaveChangesAsync(ct);
    }

    private IQueryable<Target> AccessibleTargets()
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        return db.Targets.Where(t => projectIds.Contains(t.ProjectId));
    }

    private async Task<Target> FindAsync(Guid id, CancellationToken ct) =>
        await AccessibleTargets().FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw AppException.NotFound("target");

    private static string NormalizeUrl(string url)
    {
        var error = TargetScopeValidator.ValidateUrlSyntax(url, out var uri);
        if (error is not null) throw AppException.Validation(error);
        return uri!.GetLeftPart(UriPartial.Path);
    }
}

using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

public static class QueryExtensions
{
    public static async Task<PagedResult<TOut>> ToPagedAsync<TIn, TOut>(
        this IQueryable<TIn> query, BaseSearchParam param, Func<TIn, TOut> map, CancellationToken ct)
    {
        var total = await query.LongCountAsync(ct);
        var items = await query.Skip((param.Page - 1) * param.PageSize).Take(param.PageSize).ToListAsync(ct);
        return new PagedResult<TOut>(items.Select(map).ToList(), param.Page, param.PageSize, total);
    }

    /// <summary>Applies the caller's sort only if it is in the allowlist; otherwise the default.</summary>
    public static IQueryable<T> SortBy<T>(
        this IQueryable<T> query, BaseSearchParam param,
        IReadOnlyDictionary<string, System.Linq.Expressions.Expression<Func<T, object>>> allowed, string defaultKey)
    {
        var key = param.SortBy is not null && allowed.ContainsKey(param.SortBy) ? param.SortBy : defaultKey;
        return param.SortDirection == SortDirection.Asc ? query.OrderBy(allowed[key]) : query.OrderByDescending(allowed[key]);
    }

    /// <summary>Projects the caller may access: Admin sees all, others only projects they own.</summary>
    public static IQueryable<Project> AccessibleProjects(this AppDbContext db, ICurrentUser user)
    {
        if (user.IsInRole(Roles.Admin)) return db.Projects;
        var userId = user.UserId ?? Guid.Empty;
        return db.Projects.Where(p => p.OwnerId == userId);
    }
}

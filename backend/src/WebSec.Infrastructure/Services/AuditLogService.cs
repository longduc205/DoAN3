using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

/// <summary>W13: read-only. There is deliberately no update/delete path for audit entries.</summary>
public class AuditLogService(AppDbContext db) : IAuditLogService
{
    public Task<PagedResult<AuditLogModel>> GetAllAsync(AuditLogSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var q = db.AuditLogs.AsNoTracking();
        if (param.UserId is { } uid) q = q.Where(a => a.UserId == uid);
        if (!string.IsNullOrWhiteSpace(param.Action)) q = q.Where(a => a.Action == param.Action);
        if (!string.IsNullOrWhiteSpace(param.EntityType)) q = q.Where(a => a.EntityType == param.EntityType);
        if (param.Result is { } res) q = q.Where(a => a.Result == res);
        if (param.From is { } from) q = q.Where(a => a.CreatedAt >= from);
        if (param.To is { } to) q = q.Where(a => a.CreatedAt < to);
        if (param.Keyword is { } kw) { var pattern = $"%{kw}%"; q = q.Where(a => EF.Functions.ILike(a.Summary, pattern)); }
        return q.OrderByDescending(a => a.CreatedAt).Select(a => new AuditLogModel
        {
            Id = a.Id, UserId = a.UserId, Action = a.Action, EntityType = a.EntityType, EntityId = a.EntityId, Result = a.Result,
            Summary = a.Summary, DetailJson = a.DetailJson, IpAddress = a.IpAddress, CreatedAt = a.CreatedAt,
            UserName = db.Users.Where(u => u.Id == a.UserId).Select(u => u.FullName).FirstOrDefault(),
        }).ToPagedAsync(param, x => x, ct);
    }
}

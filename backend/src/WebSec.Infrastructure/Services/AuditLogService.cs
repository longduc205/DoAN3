using System.Text;
using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

/// <summary>W13: read-only. There is deliberately no update/delete path for audit entries.</summary>
public class AuditLogService(AppDbContext db) : IAuditLogService
{
    public const int MaxExportRows = 5000;

    public Task<PagedResult<AuditLogModel>> GetAllAsync(AuditLogSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        return ToModel(Filter(param)).ToPagedAsync(param, x => x, ct);
    }

    // shortcut: groups the last 7 days in memory (small columns only); move to SQL date_trunc if the trail gets large.
    public async Task<AuditStatsModel> GetStatsAsync(CancellationToken ct)
    {
        var today = DateTimeOffset.UtcNow.UtcDateTime.Date;
        var since = new DateTimeOffset(today.AddDays(-6), TimeSpan.Zero);
        var rows = await db.AuditLogs.AsNoTracking().Where(a => a.CreatedAt >= since)
            .Select(a => new { a.CreatedAt, a.Result, a.Action, a.EntityType }).ToListAsync(ct);
        var perDay = rows.GroupBy(r => r.CreatedAt.UtcDateTime.Date).ToDictionary(g => g.Key, g => g.Count());
        return new AuditStatsModel
        {
            Last7Days = rows.Count,
            Blocked = rows.Count(r => r.Result == AuditResult.Blocked),
            FailedLogins = rows.Count(r => r.Action == "LOGIN_FAILED"),
            ByDay = Enumerable.Range(0, 7).Select(i => today.AddDays(i - 6))
                .Select(d => new AuditDayCount(d.ToString("yyyy-MM-dd"), perDay.GetValueOrDefault(d))).ToList(),
            ByEntityType = rows.GroupBy(r => r.EntityType).ToDictionary(g => g.Key, g => g.Count()),
        };
    }

    public async Task<string> ExportCsvAsync(AuditLogSearchParam param, CancellationToken ct)
    {
        var rows = await ToModel(Filter(param)).Take(MaxExportRows).ToListAsync(ct);
        var sb = new StringBuilder("time_utc,action,result,actor,entity_type,entity_id,summary,ip,detail\n");
        foreach (var a in rows)
            sb.AppendJoin(',', new[]
            {
                a.CreatedAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss"), a.Action, a.Result.ToString(), a.UserName ?? "system",
                a.EntityType, a.EntityId?.ToString() ?? "", a.Summary, a.IpAddress ?? "", a.DetailJson ?? "",
            }.Select(Csv)).Append('\n');
        return sb.ToString();
    }

    /// <summary>RFC 4180 quoting, plus a leading ' on =,+,-,@ so spreadsheets never evaluate audit text as a formula.</summary>
    public static string Csv(string value)
    {
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0])) value = "'" + value;
        return value.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }

    private IQueryable<AuditLog> Filter(AuditLogSearchParam param)
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
        return q.OrderByDescending(a => a.CreatedAt);
    }

    private IQueryable<AuditLogModel> ToModel(IQueryable<AuditLog> q) => q.Select(a => new AuditLogModel
    {
        Id = a.Id, UserId = a.UserId, Action = a.Action, EntityType = a.EntityType, EntityId = a.EntityId, Result = a.Result,
        Summary = a.Summary, DetailJson = a.DetailJson, IpAddress = a.IpAddress, CreatedAt = a.CreatedAt,
        UserName = db.Users.Where(u => u.Id == a.UserId).Select(u => u.FullName).FirstOrDefault(),
    });
}

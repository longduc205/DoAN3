using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Security;

public interface IAuditLogger
{
    /// <summary>Adds an entry to the current DbContext; it is saved with the caller's SaveChanges (same transaction).</summary>
    void Add(string action, string entityType, Guid? entityId, string summary, object? detail = null,
        AuditResult result = AuditResult.Success, Guid? userId = null);
}

public partial class AuditLogger(AppDbContext db, ICurrentUser currentUser, IHttpContextAccessor? http = null) : IAuditLogger
{
    public const string Masked = "••••";

    public void Add(string action, string entityType, Guid? entityId, string summary, object? detail = null,
        AuditResult result = AuditResult.Success, Guid? userId = null) =>
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), UserId = userId ?? currentUser.UserId, Action = action, EntityType = entityType, EntityId = entityId,
            Result = result, Summary = summary.Length > 500 ? summary[..500] : summary, DetailJson = MaskJson(detail),
            IpAddress = MaskIp(http?.HttpContext?.Connection.RemoteIpAddress?.ToString()), CreatedAt = DateTimeOffset.UtcNow,
        });

    /// <summary>Serializes the detail and replaces the value of any secret-looking key (password, token, secret, cookie…).</summary>
    public static string? MaskJson(object? detail)
    {
        if (detail is null) return null;
        var node = JsonSerializer.SerializeToNode(detail, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Mask(node);
        return node?.ToJsonString();
    }

    private static void Mask(JsonNode? node)
    {
        if (node is JsonObject obj)
            foreach (var key in obj.Select(p => p.Key).ToList())
            {
                if (SecretKey().IsMatch(key)) obj[key] = Masked;
                else Mask(obj[key]);
            }
        else if (node is JsonArray arr)
            foreach (var item in arr) Mask(item);
    }

    public static string? MaskIp(string? ip)
    {
        if (string.IsNullOrEmpty(ip)) return null;
        // Behind Kestrel IPv4 clients often appear as ::ffff:a.b.c.d; mask the IPv4 part, not the whole address.
        if (System.Net.IPAddress.TryParse(ip, out var addr) && addr.IsIPv4MappedToIPv6) ip = addr.MapToIPv4().ToString();
        var sep = ip.Contains(':') ? ':' : '.';
        var i = ip.LastIndexOf(sep);
        return i < 0 ? Masked : ip[..(i + 1)] + "x";
    }

    [GeneratedRegex("pass|token|secret|cookie|authorization|apikey|api_key|session", RegexOptions.IgnoreCase)]
    private static partial Regex SecretKey();
}

using WebSec.Shared.Enums;

namespace WebSec.Shared.Entities;

/// <summary>Append-only record of security-relevant actions. Never updated or deleted by the app.</summary>
public class AuditLog : BaseEntity<Guid>
{
    /// <summary>Null for anonymous events (e.g. failed login with an unknown user).</summary>
    public Guid? UserId { get; set; }
    /// <summary>Stable code, e.g. USER_ROLE_CHANGED, SCAN_STARTED, LOGIN_FAILED.</summary>
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public AuditResult Result { get; set; }
    public string Summary { get; set; } = string.Empty;
    /// <summary>Before/after or extra fields as JSON, with secret-looking keys masked before storing.</summary>
    public string? DetailJson { get; set; }
    /// <summary>Masked client address (last part hidden).</summary>
    public string? IpAddress { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

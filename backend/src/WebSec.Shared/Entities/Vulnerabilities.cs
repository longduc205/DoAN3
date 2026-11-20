using WebSec.Shared.Enums;

namespace WebSec.Shared.Entities;

/// <summary>One real issue on a target, deduplicated from scan findings by fingerprint. Never deleted: history matters.</summary>
public class Vulnerability : BaseEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid TargetId { get; set; }
    public Target Target { get; set; } = null!;
    public string Fingerprint { get; set; } = string.Empty;
    public string FindingType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? ParameterName { get; set; }
    public Severity Severity { get; set; }
    public VulnerabilityStatus Status { get; set; } = VulnerabilityStatus.Open;
    /// <summary>Seen again by a scan after being Resolved; an analyst decides whether to reopen (no auto transition).</summary>
    public bool IsReappeared { get; set; }
    public Guid? AssigneeId { get; set; }
    /// <summary>Reason for the last False Positive / Accepted Risk / Reopened decision.</summary>
    public string? CloseReason { get; set; }
    public DateTimeOffset? ReviewAt { get; set; }
    public DateTimeOffset FirstDetectedAt { get; set; }
    public DateTimeOffset LastDetectedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class VulnerabilityComment : BaseEntity<Guid>
{
    public Guid VulnerabilityId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    /// <summary>Saved from the AI panel; shown with an AI-generated label.</summary>
    public bool IsAiNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class VulnerabilityHistory : BaseEntity<Guid>
{
    public Guid VulnerabilityId { get; set; }
    /// <summary>Null = system (scan worker).</summary>
    public Guid? ChangedBy { get; set; }
    public VulnerabilityStatus? OldStatus { get; set; }
    public VulnerabilityStatus? NewStatus { get; set; }
    public string Summary { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

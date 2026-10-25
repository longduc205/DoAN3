using WebSec.Shared.Enums;

namespace WebSec.Shared.Entities;

// Scan records are history: no soft-delete/audit base on purpose.
public class Scan : BaseEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid TargetId { get; set; }
    public Target Target { get; set; } = null!;
    public Guid RequestedBy { get; set; }
    public ScanType ScanType { get; set; } = ScanType.Mock;
    public ScanStatus Status { get; set; } = ScanStatus.Pending;
    public int ProgressPercent { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessageSafe { get; set; }
    public int TotalUrls { get; set; }
    public int TotalRequests { get; set; }
    public int TotalFindings { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ScanJob : BaseEntity<Guid>
{
    public Guid ScanId { get; set; }
    public ScanJobStatus Status { get; set; } = ScanJobStatus.Queued;
    public int AttemptCount { get; set; }
    public DateTimeOffset AvailableAt { get; set; }
    public DateTimeOffset? LockedAt { get; set; }
    public string? LockedBy { get; set; }
    public string? LastErrorSafe { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ScanUrl : BaseEntity<Guid>
{
    public Guid ScanId { get; set; }
    public string Url { get; set; } = string.Empty;
    public string HttpMethod { get; set; } = "GET";
    public int? StatusCode { get; set; }
    public string? ContentType { get; set; }
    public DateTimeOffset DiscoveredAt { get; set; }
    public bool IsInScope { get; set; }
}

public class ScanFinding : BaseEntity<Guid>
{
    public Guid ScanId { get; set; }
    public Guid TargetId { get; set; }
    public string FindingType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? ParameterName { get; set; }
    public Severity Severity { get; set; }
    public Confidence Confidence { get; set; }
    public string EvidenceSummary { get; set; } = string.Empty;
    public bool EvidenceRedacted { get; set; }
    public string DetectorName { get; set; } = string.Empty;
    public string Fingerprint { get; set; } = string.Empty;
    public DateTimeOffset DetectedAt { get; set; }
}

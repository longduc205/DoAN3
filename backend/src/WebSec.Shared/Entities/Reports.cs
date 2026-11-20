using WebSec.Shared.Enums;

namespace WebSec.Shared.Entities;

/// <summary>An immutable snapshot of a project's security state (A10: to change it, generate a new one).</summary>
public class Report : BaseEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ReportTemplate Template { get; set; }
    public ReportStatus Status { get; set; } = ReportStatus.Generating;
    /// <summary>JSON of ReportSnapshotModel; system data only, no AI text.</summary>
    public string? SnapshotJson { get; set; }
    public string? ErrorSafe { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

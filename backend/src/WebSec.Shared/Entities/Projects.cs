using WebSec.Shared.Enums;

namespace WebSec.Shared.Entities;

public class Project : AuditEntity<Guid>
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid OwnerId { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
}

public class Target : AuditEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public TargetEnvironment Environment { get; set; } = TargetEnvironment.Lab;
    public ScopeMode ScopeMode { get; set; } = ScopeMode.SameHostPathPrefix;
    public bool IsEnabled { get; set; }
    /// <summary>User explicitly confirmed they own / are authorized to test this target.</summary>
    public bool IsAuthorized { get; set; }
    public DateTimeOffset? LastScanAt { get; set; }
}

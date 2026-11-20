using System.ComponentModel.DataAnnotations;
using WebSec.Shared.Enums;

namespace WebSec.Shared.DTOs;

public sealed class IdRequest
{
    [Required] public Guid Id { get; set; }
}

public sealed class LoginRequest
{
    [Required, MaxLength(256)] public string UserName { get; set; } = string.Empty;
    [Required, MaxLength(256)] public string Password { get; set; } = string.Empty;
}

public class CreateProjectRequest
{
    [Required, MaxLength(50), RegularExpression("^[A-Za-z0-9_-]+$")]
    public string Code { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; set; }
}

public sealed class UpdateProjectRequest : CreateProjectRequest
{
    [Required] public Guid Id { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
}

public class CreateTargetRequest
{
    [Required] public Guid ProjectId { get; set; }
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Required, MaxLength(2048)] public string BaseUrl { get; set; } = string.Empty;
    public TargetEnvironment Environment { get; set; } = TargetEnvironment.Lab;
    public ScopeMode ScopeMode { get; set; } = ScopeMode.SameHostPathPrefix;
    public bool IsEnabled { get; set; }
    /// <summary>Must be set explicitly by the user: "I own or am authorized to test this target".</summary>
    public bool IsAuthorized { get; set; }
}

public sealed class UpdateTargetRequest : CreateTargetRequest
{
    [Required] public Guid Id { get; set; }
}

public sealed class CreateScanRequest
{
    [Required] public Guid TargetId { get; set; }
    public ScanType ScanType { get; set; } = ScanType.Mock;
}

/// <summary>Either a scan finding or a vulnerability (its latest occurrence is used).</summary>
public sealed class AiFindingRequest
{
    public Guid? FindingId { get; set; }
    public Guid? VulnerabilityId { get; set; }
}

public sealed class CreateReportRequest
{
    [Required] public Guid ProjectId { get; set; }
    [MaxLength(200)] public string? Title { get; set; }
    public ReportTemplate Template { get; set; } = ReportTemplate.Technical;
}

public sealed class UpdateVulnerabilityStatusRequest
{
    [Required] public Guid Id { get; set; }
    [Required] public VulnerabilityStatus Status { get; set; }
    [MaxLength(2000)] public string? Reason { get; set; }
    /// <summary>Required for Accepted Risk (review date).</summary>
    public DateTimeOffset? ReviewAt { get; set; }
}

public sealed class AssignVulnerabilitiesRequest
{
    [Required, MinLength(1), MaxLength(100)] public List<Guid> Ids { get; set; } = [];
    [Required] public Guid AssigneeId { get; set; }
}

public sealed class AddVulnerabilityCommentRequest
{
    [Required] public Guid VulnerabilityId { get; set; }
    [Required, MaxLength(8000)] public string Content { get; set; } = string.Empty;
    public bool IsAiNote { get; set; }
}

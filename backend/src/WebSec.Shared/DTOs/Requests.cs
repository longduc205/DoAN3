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

public sealed class AiFindingRequest
{
    [Required] public Guid FindingId { get; set; }
}

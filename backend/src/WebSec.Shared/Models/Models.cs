using WebSec.Shared.Enums;

namespace WebSec.Shared.Models;

public sealed class LoginResult
{
    public string AccessToken { get; init; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; init; }
    public CurrentUserModel User { get; init; } = null!;
}

public sealed class CurrentUserModel
{
    public Guid Id { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public IReadOnlyList<string> Roles { get; init; } = [];
    public IReadOnlyList<string> Permissions { get; init; } = [];
}

public sealed class ProjectModel
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid OwnerId { get; set; }
    public ProjectStatus Status { get; set; }
    public DateTimeOffset CreatedDate { get; set; }
    public DateTimeOffset? UpdatedDate { get; set; }
}

public sealed class TargetModel
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public TargetEnvironment Environment { get; set; }
    public ScopeMode ScopeMode { get; set; }
    public bool IsEnabled { get; set; }
    public bool IsAuthorized { get; set; }
    public DateTimeOffset? LastScanAt { get; set; }
    public DateTimeOffset CreatedDate { get; set; }
}

public sealed class ScanModel
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TargetId { get; set; }
    public string TargetName { get; set; } = string.Empty;
    public string TargetBaseUrl { get; set; } = string.Empty;
    public ScanType ScanType { get; set; }
    public ScanStatus Status { get; set; }
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

public sealed class ScanProgressModel
{
    public Guid Id { get; init; }
    public ScanStatus Status { get; init; }
    public int ProgressPercent { get; init; }
    public int TotalUrls { get; init; }
    public int TotalRequests { get; init; }
    public int TotalFindings { get; init; }
    public bool IsTerminal { get; init; }
}

public sealed class ScanFindingModel
{
    public Guid Id { get; set; }
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
    public DateTimeOffset DetectedAt { get; set; }
}

public sealed class DashboardSummaryModel
{
    public int Projects { get; init; }
    public int Targets { get; init; }
    public int Scans { get; init; }
    public int Findings { get; init; }
    public IReadOnlyDictionary<Severity, int> FindingsBySeverity { get; init; } = new Dictionary<Severity, int>();
}

public sealed class AiAdviceModel
{
    public string Content { get; init; } = string.Empty;
    public string Provider { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    /// <summary>Always true: AI output is advisory and must be reviewed by a human.</summary>
    public bool IsAiAssisted { get; init; } = true;
    public DateTimeOffset GeneratedAt { get; init; }
}

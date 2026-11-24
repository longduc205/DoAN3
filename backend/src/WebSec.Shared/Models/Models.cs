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

    // Summary, only filled by the list endpoint.
    public int TargetCount { get; set; }
    /// <summary>Enabled targets the owner has not yet confirmed authorization for.</summary>
    public int UnauthorizedTargetCount { get; set; }
    /// <summary>Distinct findings (by fingerprint) across all scans.</summary>
    public int FindingCount { get; set; }
    /// <summary>Vulnerabilities in an open status.</summary>
    public int OpenVulnerabilityCount { get; set; }
    /// <summary>0–100, same formula as the dashboard, over open vulnerabilities.</summary>
    public int RiskScore { get; set; }
    public bool IsScanning { get; set; }
    public DateTimeOffset? LastScanAt { get; set; }
    /// <summary>Up to 3 targets (most recent first) for the folder's sheets.</summary>
    public List<ProjectTargetPreview> Targets { get; set; } = [];
}

public sealed record ProjectTargetPreview(Guid Id, string Name, bool IsAuthorized, bool IsScanning);

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
    public Guid? VulnerabilityId { get; set; }
    public VulnerabilityStatus? VulnerabilityStatus { get; set; }
    public OccurrenceTag? OccurrenceTag { get; set; }
}

public sealed class VulnerabilityFacetsModel
{
    public IReadOnlyList<string> FindingTypes { get; set; } = [];
    public IReadOnlyDictionary<Severity, int> BySeverity { get; set; } = new Dictionary<Severity, int>();
}

public sealed class AuditStatsModel
{
    public int Last7Days { get; set; }
    public int Blocked { get; set; }
    public int FailedLogins { get; set; }
    /// <summary>Oldest first, one entry per UTC day (yyyy-MM-dd), zero-filled.</summary>
    public IReadOnlyList<AuditDayCount> ByDay { get; set; } = [];
    public IReadOnlyDictionary<string, int> ByEntityType { get; set; } = new Dictionary<string, int>();
}

public sealed record AuditDayCount(string Date, int Count);

public sealed class DashboardSummaryModel
{
    public int Projects { get; init; }
    public int Targets { get; init; }
    public int Scans { get; init; }
    public int Findings { get; init; }
    public IReadOnlyDictionary<Severity, int> FindingsBySeverity { get; init; } = new Dictionary<Severity, int>();
    public int OpenVulnerabilities { get; init; }
    public IReadOnlyDictionary<Severity, int> OpenBySeverity { get; init; } = new Dictionary<Severity, int>();
    public IReadOnlyDictionary<VulnerabilityStatus, int> ByStatus { get; init; } = new Dictionary<VulnerabilityStatus, int>();
    public int Reappeared { get; init; }
    public int Unassigned { get; init; }
    /// <summary>0–100, see docs/DATA_MODEL.md (risk score).</summary>
    public int RiskScore { get; init; }
}

public sealed class UserAdminModel
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    /// <summary>From the audit trail (last LOGIN_SUCCEEDED).</summary>
    public DateTimeOffset? LastLoginAt { get; set; }
}

public sealed class RolePermissionsModel
{
    public string Role { get; set; } = string.Empty;
    public IReadOnlyList<string> Permissions { get; set; } = [];
}

public sealed class AuditLogModel
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public AuditResult Result { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string? DetailJson { get; set; }
    public string? IpAddress { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ReportModel
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public ReportTemplate Template { get; set; }
    public ReportStatus Status { get; set; }
    public string? ErrorSafe { get; set; }
    public string? CreatedByName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public sealed class ReportDetailModel : ReportModel
{
    public ReportSnapshotModel? Snapshot { get; set; }
}

/// <summary>System data frozen at generation time. Contains no AI-generated text.</summary>
public sealed class ReportSnapshotModel
{
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public DateTimeOffset GeneratedAt { get; set; }
    public int Targets { get; set; }
    public int Scans { get; set; }
    public DateTimeOffset? LastScanAt { get; set; }
    public int OpenVulnerabilities { get; set; }
    public int RiskScore { get; set; }
    public Dictionary<Severity, int> OpenBySeverity { get; set; } = [];
    public Dictionary<VulnerabilityStatus, int> ByStatus { get; set; } = [];
    public List<ReportVulnerabilityRow> Vulnerabilities { get; set; } = [];
}

public sealed class ReportVulnerabilityRow
{
    public string Title { get; set; } = string.Empty;
    public string FindingType { get; set; } = string.Empty;
    public Severity Severity { get; set; }
    public VulnerabilityStatus Status { get; set; }
    public string TargetName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? AssigneeName { get; set; }
    public DateTimeOffset FirstDetectedAt { get; set; }
}

public class VulnerabilityModel
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public Guid TargetId { get; set; }
    public string TargetName { get; set; } = string.Empty;
    public string FindingType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? ParameterName { get; set; }
    public Severity Severity { get; set; }
    public VulnerabilityStatus Status { get; set; }
    public bool IsReappeared { get; set; }
    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public DateTimeOffset FirstDetectedAt { get; set; }
    public DateTimeOffset LastDetectedAt { get; set; }
}

public sealed class VulnerabilityDetailModel : VulnerabilityModel
{
    public string TargetBaseUrl { get; set; } = string.Empty;
    public string? CloseReason { get; set; }
    public DateTimeOffset? ReviewAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public int Occurrences { get; set; }
    /// <summary>Latest occurrence; evidence is already redacted at write time.</summary>
    public ScanFindingModel? LatestFinding { get; set; }
    /// <summary>Statuses the caller may move to right now (UI shows only these buttons).</summary>
    public IReadOnlyList<VulnerabilityStatus> AllowedTransitions { get; set; } = [];
}

public sealed class VulnerabilityCommentModel
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsAiNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class VulnerabilityHistoryModel
{
    public Guid Id { get; set; }
    public string? ChangedByName { get; set; }
    public VulnerabilityStatus? OldStatus { get; set; }
    public VulnerabilityStatus? NewStatus { get; set; }
    public string Summary { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class UserLookupModel
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

/// <summary>Exactly what would be sent to the AI provider (already redacted and truncated).</summary>
public sealed class AiContextModel
{
    public string FindingType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public Severity Severity { get; set; }
    public string EvidenceSummary { get; set; } = string.Empty;
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

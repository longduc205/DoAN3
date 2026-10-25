using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Scanning.Abstractions;

/// <summary>Immutable, already-validated scan input handed to an engine. Engines never pick their own targets.</summary>
public sealed record ScanRequest(Guid ScanId, Guid TargetId, Uri BaseUri, ScopeMode ScopeMode, ScanType ScanType);

public sealed record DiscoveredUrl(string Url, string HttpMethod, int? StatusCode, string? ContentType, bool IsInScope);

public sealed record DetectedFinding(
    string FindingType, string Title, string Url, string? ParameterName, Severity Severity, Confidence Confidence,
    string EvidenceSummary, string DetectorName);

/// <summary>Receives engine output and persists it. Implementations throw OperationCanceledException when the scan was cancelled.</summary>
public interface IScanProgressReporter
{
    Task ReportProgressAsync(int percent, CancellationToken ct);
    Task ReportUrlsAsync(IReadOnlyList<DiscoveredUrl> urls, CancellationToken ct);
    Task ReportFindingsAsync(IReadOnlyList<DetectedFinding> findings, CancellationToken ct);
}

public interface IScanEngine
{
    Task RunAsync(ScanRequest request, IScanProgressReporter reporter, CancellationToken ct);
}

public interface ITargetScopeValidator
{
    /// <summary>Returns null when the target may be scanned, otherwise a client-safe reason.</summary>
    Task<string?> ValidateAsync(Target target, CancellationToken ct);
}

public interface IScanJobQueue
{
    /// <summary>Atomically claims the next available job (safe for multiple workers). Returns null if none.</summary>
    Task<ScanJob?> ClaimNextAsync(string workerId, CancellationToken ct);
}

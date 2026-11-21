using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Scanning;
using WebSec.Infrastructure.Services;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;

namespace WebSec.Infrastructure.AI;

public sealed class AiOptions
{
    /// <summary>"mock" (default) or a real provider name once an adapter exists.</summary>
    public string Provider { get; set; } = "mock";
}

/// <summary>Sanitized, bounded context handed to an AI provider. Evidence is untrusted data, never instructions.</summary>
public sealed record AiFindingContext(string FindingType, string Title, string Url, Severity Severity, string EvidenceSummary);

public interface IAiAdvisor
{
    string ProviderName { get; }
    Task<AiAdviceModel> ExplainVulnerabilityAsync(AiFindingContext context, CancellationToken ct);
    Task<AiAdviceModel> SuggestRemediationAsync(AiFindingContext context, CancellationToken ct);
    /// <summary>Free-text question about one finding. The question is untrusted user input, never instructions to the system.</summary>
    Task<AiAdviceModel> AskAsync(AiFindingContext context, string question, CancellationToken ct);
}

/// <summary>Deterministic offline advisor for development and tests. Read-only: it never touches the database.</summary>
public sealed class MockAiAdvisor : IAiAdvisor
{
    public string ProviderName => "mock";

    public Task<AiAdviceModel> ExplainVulnerabilityAsync(AiFindingContext c, CancellationToken ct) =>
        Task.FromResult(Advice($"""
            [Mock AI – advisory only] "{c.Title}" ({c.Severity}) was reported at {c.Url}.
            {Explain(c.FindingType)}
            Verify the finding manually before changing its status.
            """));

    public Task<AiAdviceModel> SuggestRemediationAsync(AiFindingContext c, CancellationToken ct) =>
        Task.FromResult(Advice($"""
            [Mock AI – advisory only] Suggested remediation for "{c.Title}":
            {Remediate(c.FindingType)}
            Re-run a scan after deploying the fix to confirm.
            """));

    // shortcut: keyword routing stands in for a model; a real adapter sends context + question to the provider.
    public Task<AiAdviceModel> AskAsync(AiFindingContext c, string question, CancellationToken ct)
    {
        var q = question.ToLowerInvariant();
        // "How do I verify after fixing?" mentions both; verification wins because it is the more specific intent.
        var body = q.Contains("kiểm tra") || q.Contains("verify") || q.Contains("retest") || q.Contains("test") ? Verify(c.FindingType)
            : q.Contains("sửa") || q.Contains("fix") || q.Contains("remediat") || q.Contains("khắc phục") ? Remediate(c.FindingType)
            : Explain(c.FindingType);
        return Task.FromResult(Advice($"""
            [Mock AI – advisory only] About "{c.Title}" ({c.Severity}) at {c.Url}:
            {body}
            This answer only uses the finding shown in the context panel. Verify it before acting.
            """));
    }

    private static string Verify(string type) => type switch
    {
        "MissingContentSecurityPolicy" or "MissingHsts" or "ServerBannerDisclosure" =>
            "Request the page again and check the response headers (browser dev tools → Network), then run a new scan on the same target.",
        _ => "Re-test the same URL and parameter manually, then run a new scan; the finding should not reappear.",
    };

    private static string Explain(string type) => type switch
    {
        "MissingContentSecurityPolicy" => "Without a Content-Security-Policy, the browser has no allowlist for scripts, which makes XSS easier to exploit.",
        "MissingHsts" => "Without HSTS, a user's first request may go over plain HTTP and can be downgraded by a network attacker.",
        "ServerBannerDisclosure" => "Exposing server software versions helps attackers pick known exploits for that version.",
        _ => "This finding type has no canned explanation in the mock advisor.",
    };

    private static string Remediate(string type) => type switch
    {
        "MissingContentSecurityPolicy" => "Add a Content-Security-Policy header, e.g. default-src 'self'; start in Report-Only mode and tighten it.",
        "MissingHsts" => "Serve the site over HTTPS only and add Strict-Transport-Security: max-age=31536000; includeSubDomains.",
        "ServerBannerDisclosure" => "Remove or genericize the Server / X-Powered-By headers in the web server or reverse proxy config.",
        _ => "Review the evidence and apply the relevant OWASP guidance.",
    };

    private AiAdviceModel Advice(string content) => new()
    {
        Content = content, Provider = ProviderName, Model = "mock-deterministic-v1", IsAiAssisted = true, GeneratedAt = DateTimeOffset.UtcNow,
    };
}

/// <summary>Loads only findings the caller can access, sanitizes context, then delegates to the configured advisor.</summary>
public class AiService(AppDbContext db, ICurrentUser currentUser, IAiAdvisor? advisor = null) : IAiService
{
    private const int MaxEvidenceChars = 1000;

    public async Task<AiContextModel> GetContextAsync(AiFindingRequest request, CancellationToken ct)
    {
        var c = await LoadContextAsync(request, ct);
        return new AiContextModel { FindingType = c.FindingType, Title = c.Title, Url = c.Url, Severity = c.Severity, EvidenceSummary = c.EvidenceSummary };
    }

    public async Task<AiAdviceModel> ExplainFindingAsync(AiFindingRequest request, CancellationToken ct) =>
        await RequireAdvisor().ExplainVulnerabilityAsync(await LoadContextAsync(request, ct), ct);

    public async Task<AiAdviceModel> SuggestRemediationAsync(AiFindingRequest request, CancellationToken ct) =>
        await RequireAdvisor().SuggestRemediationAsync(await LoadContextAsync(request, ct), ct);

    public async Task<AiAdviceModel> AskAsync(AiAskRequest request, CancellationToken ct)
    {
        var question = request.Question.Trim();
        if (question.Length == 0) throw AppException.Validation("Question is empty.");
        var context = await LoadContextAsync(new AiFindingRequest { VulnerabilityId = request.VulnerabilityId }, ct);
        return await RequireAdvisor().AskAsync(context, question, ct);
    }

    private IAiAdvisor RequireAdvisor() => advisor
        ?? throw new AppException(ErrorCodes.AiProviderUnavailable, "AI provider is not configured.", 503);

    private async Task<AiFindingContext> LoadContextAsync(AiFindingRequest request, CancellationToken ct)
    {
        var projectIds = db.AccessibleProjects(currentUser).Select(p => p.Id);
        var me = currentUser.UserId ?? Guid.Empty;
        // Same access rule as VulnerabilityService: own projects, or vulnerabilities assigned to the caller.
        var vulnIds = db.Vulnerabilities.Where(v => projectIds.Contains(v.ProjectId) || v.AssigneeId == me).Select(v => v.Id);
        var scanIds = db.Scans.Where(s => projectIds.Contains(s.ProjectId)).Select(s => s.Id);
        var query = db.ScanFindings.AsNoTracking();
        query = request.VulnerabilityId is { } vid
            ? query.Where(x => x.VulnerabilityId == vid && vulnIds.Contains(vid)).OrderByDescending(x => x.DetectedAt)
            : query.Where(x => x.Id == request.FindingId && scanIds.Contains(x.ScanId));
        var f = await query.FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("finding");

        var evidence = EvidenceRedactor.Redact(f.EvidenceSummary, out _);
        if (evidence.Length > MaxEvidenceChars) evidence = evidence[..MaxEvidenceChars];
        return new AiFindingContext(f.FindingType, f.Title, f.Url, f.Severity, evidence);
    }
}

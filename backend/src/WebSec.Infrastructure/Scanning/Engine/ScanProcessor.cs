using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;

namespace WebSec.Infrastructure.Scanning.Engine;

/// <summary>Runs one claimed job end-to-end: re-validates scope, drives the engine, persists results and terminal state.</summary>
public class ScanProcessor(AppDbContext db, ITargetScopeValidator scopeValidator, IScanEngine engine, ILogger<ScanProcessor> logger)
{
    public async Task ProcessAsync(ScanJob claimedJob, CancellationToken stoppingToken)
    {
        var job = await db.ScanJobs.FirstAsync(j => j.Id == claimedJob.Id, stoppingToken);
        var scan = await db.Scans.IgnoreQueryFilters().Include(s => s.Target).FirstAsync(s => s.Id == job.ScanId, stoppingToken);
        var sw = Stopwatch.StartNew();

        if (scan.Status != ScanStatus.Queued)
        {
            // Cancelled (or otherwise moved) before the worker picked it up.
            job.Status = scan.Status == ScanStatus.Cancelled ? ScanJobStatus.Cancelled : ScanJobStatus.Failed;
            await db.SaveChangesAsync(stoppingToken);
            return;
        }

        // Defense in depth: the API validated scope when queueing, but the target may have changed since.
        var scopeError = await scopeValidator.ValidateAsync(scan.Target, stoppingToken);
        if (scopeError is not null)
        {
            await FinishAsync(scan, job, ScanStatus.Failed, ErrorCodes.ScanScopeRejected, scopeError, stoppingToken);
            return;
        }

        scan.Status = ScanStatus.Running;
        scan.StartedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(stoppingToken);
        logger.LogInformation("Scan {ScanId} Queued -> Running", scan.Id);

        var request = new ScanRequest(scan.Id, scan.TargetId, new Uri(scan.Target.BaseUrl), scan.Target.ScopeMode, scan.ScanType);
        try
        {
            await engine.RunAsync(request, new Reporter(db, scan), stoppingToken);
            await FinishAsync(scan, job, ScanStatus.Completed, null, null, CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            // Either user cancellation (status Cancelling) or worker shutdown: both end as Cancelled, not silently lost.
            var message = stoppingToken.IsCancellationRequested ? "Worker shut down during the scan." : null;
            await FinishAsync(scan, job, ScanStatus.Cancelled, null, message, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Scan {ScanId} failed", scan.Id);
            await FinishAsync(scan, job, ScanStatus.Failed, ErrorCodes.InternalError, "The scan failed due to an internal error.", CancellationToken.None);
        }
        logger.LogInformation("Scan {ScanId} finished as {Status} in {ElapsedMs} ms (urls={Urls}, findings={Findings})",
            scan.Id, scan.Status, sw.ElapsedMilliseconds, scan.TotalUrls, scan.TotalFindings);
    }

    private async Task FinishAsync(Scan scan, ScanJob job, ScanStatus status, string? errorCode, string? errorMessage, CancellationToken ct)
    {
        scan.Status = status;
        scan.CompletedAt = DateTimeOffset.UtcNow;
        scan.ErrorCode = errorCode;
        scan.ErrorMessageSafe = errorMessage;
        if (status == ScanStatus.Completed) scan.ProgressPercent = 100;
        job.Status = status switch
        {
            ScanStatus.Completed => ScanJobStatus.Done,
            ScanStatus.Cancelled => ScanJobStatus.Cancelled,
            _ => ScanJobStatus.Failed,
        };
        job.LastErrorSafe = errorMessage;
        scan.Target.LastScanAt = scan.CompletedAt;
        await db.SaveChangesAsync(ct);
    }

    private sealed class Reporter(AppDbContext db, Scan scan) : IScanProgressReporter
    {
        public async Task ReportProgressAsync(int percent, CancellationToken ct)
        {
            await ThrowIfCancelRequestedAsync(ct);
            scan.ProgressPercent = Math.Clamp(percent, 0, 100);
            await db.SaveChangesAsync(ct);
        }

        public async Task ReportUrlsAsync(IReadOnlyList<DiscoveredUrl> urls, CancellationToken ct)
        {
            await ThrowIfCancelRequestedAsync(ct);
            var now = DateTimeOffset.UtcNow;
            db.ScanUrls.AddRange(urls.Select(u => new ScanUrl
            {
                Id = Guid.NewGuid(), ScanId = scan.Id, Url = u.Url, HttpMethod = u.HttpMethod, StatusCode = u.StatusCode,
                ContentType = u.ContentType, IsInScope = u.IsInScope, DiscoveredAt = now,
            }));
            scan.TotalUrls += urls.Count;
            scan.TotalRequests += urls.Count;
            await db.SaveChangesAsync(ct);
        }

        public async Task ReportFindingsAsync(IReadOnlyList<DetectedFinding> findings, CancellationToken ct)
        {
            await ThrowIfCancelRequestedAsync(ct);
            var now = DateTimeOffset.UtcNow;
            db.ScanFindings.AddRange(findings.Select(f => new ScanFinding
            {
                Id = Guid.NewGuid(), ScanId = scan.Id, TargetId = scan.TargetId, FindingType = f.FindingType, Title = f.Title,
                Url = f.Url, ParameterName = f.ParameterName, Severity = f.Severity, Confidence = f.Confidence,
                EvidenceSummary = EvidenceRedactor.Redact(f.EvidenceSummary, out var redacted), EvidenceRedacted = redacted,
                DetectorName = f.DetectorName, Fingerprint = Fingerprint(scan.TargetId, f), DetectedAt = now,
            }));
            scan.TotalFindings += findings.Count;
            await db.SaveChangesAsync(ct);
        }

        private async Task ThrowIfCancelRequestedAsync(CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();
            var status = await db.Scans.IgnoreQueryFilters().Where(s => s.Id == scan.Id).Select(s => s.Status).FirstAsync(ct);
            if (status == ScanStatus.Cancelling) throw new OperationCanceledException("Scan cancelled by user.");
        }

        private static string Fingerprint(Guid targetId, DetectedFinding f) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{targetId}|{f.FindingType}|{f.Url}|{f.ParameterName}")));
    }
}

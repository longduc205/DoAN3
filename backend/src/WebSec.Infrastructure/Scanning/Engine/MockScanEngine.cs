using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Scanning.Engine;

/// <summary>
/// Deterministic demo engine. Sends NO network traffic: it fabricates in-scope URLs under the
/// validated base URL and emits fixed sample findings so the full pipeline can be exercised safely.
/// </summary>
public class MockScanEngine(TimeSpan? stepDelay = null) : IScanEngine
{
    public const string DetectorName = "MockPassiveHeaders";
    private readonly TimeSpan _delay = stepDelay ?? TimeSpan.FromSeconds(1.5);

    public async Task RunAsync(ScanRequest request, IScanProgressReporter reporter, CancellationToken ct)
    {
        var root = request.BaseUri.GetLeftPart(UriPartial.Path).TrimEnd('/');
        await reporter.ReportProgressAsync(10, ct);
        await Task.Delay(_delay, ct);

        var urls = request.ScopeMode == ScopeMode.ExactUrl
            ? [new DiscoveredUrl(root + "/", "GET", 200, "text/html", true)]
            : new List<DiscoveredUrl>
            {
                new(root + "/", "GET", 200, "text/html", true),
                new(root + "/login", "GET", 200, "text/html", true),
                new(root + "/search?q=", "GET", 200, "text/html", true),
            };
        await reporter.ReportUrlsAsync(urls, ct);
        await reporter.ReportProgressAsync(40, ct);
        await Task.Delay(_delay, ct);

        await reporter.ReportFindingsAsync(
        [
            new("MissingContentSecurityPolicy", "Missing Content-Security-Policy header", root + "/", null,
                Severity.Medium, Confidence.High, "[sample] Response has no Content-Security-Policy header.", DetectorName),
            new("MissingHsts", "Missing Strict-Transport-Security header", root + "/", null,
                Severity.Low, Confidence.High, "[sample] Response has no Strict-Transport-Security header.", DetectorName),
        ], ct);
        await reporter.ReportProgressAsync(75, ct);
        await Task.Delay(_delay, ct);

        await reporter.ReportFindingsAsync(
        [
            new("ServerBannerDisclosure", "Server version disclosed in response header", root + "/", null,
                Severity.Info, Confidence.Medium, "[sample] Server: demo-server/1.0", DetectorName),
        ], ct);
        await reporter.ReportProgressAsync(100, ct);
    }
}

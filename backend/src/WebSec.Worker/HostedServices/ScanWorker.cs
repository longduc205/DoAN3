using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Infrastructure.Scanning.Engine;

namespace WebSec.Worker.HostedServices;

/// <summary>Polls the persistent job table, claims one job at a time and hands it to <see cref="ScanProcessor"/>.</summary>
public class ScanWorker(IServiceScopeFactory scopes, ILogger<ScanWorker> logger) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(2);
    private readonly string _workerId = $"{Environment.MachineName}:{Environment.ProcessId}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Scan worker {WorkerId} started", _workerId);
        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = false;
            try
            {
                using var scope = scopes.CreateScope();
                var job = await scope.ServiceProvider.GetRequiredService<IScanJobQueue>().ClaimNextAsync(_workerId, stoppingToken);
                if (job is not null)
                {
                    logger.LogInformation("Claimed job {JobId} for scan {ScanId}", job.Id, job.ScanId);
                    await scope.ServiceProvider.GetRequiredService<ScanProcessor>().ProcessAsync(job, stoppingToken);
                    processed = true;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Keep the loop alive (e.g. database briefly unavailable).
                logger.LogError(ex, "Scan worker loop error");
            }

            if (!processed)
            {
                try { await Task.Delay(IdleDelay, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }
        logger.LogInformation("Scan worker {WorkerId} stopped", _workerId);
    }
}

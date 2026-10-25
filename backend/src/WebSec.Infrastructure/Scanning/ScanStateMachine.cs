using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Scanning;

public static class ScanStateMachine
{
    private static readonly Dictionary<ScanStatus, ScanStatus[]> Allowed = new()
    {
        [ScanStatus.Pending] = [ScanStatus.Queued, ScanStatus.Cancelled],
        [ScanStatus.Queued] = [ScanStatus.Running, ScanStatus.Cancelled],
        [ScanStatus.Running] = [ScanStatus.Completed, ScanStatus.Failed, ScanStatus.Cancelling, ScanStatus.Cancelled],
        [ScanStatus.Cancelling] = [ScanStatus.Cancelled, ScanStatus.Failed, ScanStatus.Completed],
    };

    public static bool CanTransition(ScanStatus from, ScanStatus to) => Allowed.TryGetValue(from, out var next) && next.Contains(to);

    public static bool IsTerminal(ScanStatus status) =>
        status is ScanStatus.Completed or ScanStatus.Failed or ScanStatus.Cancelled;

    public static void EnsureTransition(ScanStatus from, ScanStatus to)
    {
        if (!CanTransition(from, to)) throw new InvalidOperationException($"Invalid scan transition {from} -> {to}.");
    }
}

using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Shared.Entities;

namespace WebSec.Infrastructure.Scanning.Queue;

/// <summary>PostgreSQL-backed queue: FOR UPDATE SKIP LOCKED guarantees one worker per job.</summary>
public class DbScanJobQueue(AppDbContext db) : IScanJobQueue
{
    public async Task<ScanJob?> ClaimNextAsync(string workerId, CancellationToken ct)
    {
        var claimed = await db.ScanJobs.FromSqlInterpolated($"""
            UPDATE scan_jobs SET status = 'Running', locked_at = now(), locked_by = {workerId}, attempt_count = attempt_count + 1
            WHERE id = (
                SELECT id FROM scan_jobs
                WHERE status = 'Queued' AND available_at <= now()
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1)
            RETURNING *
            """).AsNoTracking().ToListAsync(ct);
        return claimed.FirstOrDefault();
    }
}

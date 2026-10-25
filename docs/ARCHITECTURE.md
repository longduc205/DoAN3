# Architecture

```text
Angular 21 (frontend/)  ──/api (dev proxy)──▶  WebSec.Api (ASP.NET Core)
                                               Controllers → Services → EF Core
                                                      │
                                                      ▼
                                                 PostgreSQL ◀──── WebSec.Worker (BackgroundService)
                                                 scan_jobs  claim (FOR UPDATE SKIP LOCKED)
                                                                   ├── TargetScopeValidator (re-check)
                                                                   ├── IScanEngine (MockScanEngine)
                                                                   └── progress / urls / findings
```

## Projects

| Project | Responsibility | References |
|---|---|---|
| `WebSec.Shared` | Entities, enums, DTOs (requests), Models (responses), search params, `ApiResponse`, error codes, permission matrix | – |
| `WebSec.Infrastructure` | `AppDbContext` + configurations + migrations + seed, services, Mapperly mapper, JWT, scanning (scope validator, queue, engine, processor, redactor), AI advisor | Shared |
| `WebSec.Api` | Controllers, exception middleware, auth/policies, rate limiting, CORS, health checks, Swagger | Shared, Infrastructure |
| `WebSec.Worker` | `ScanWorker` hosted service polling the job table | Shared, Infrastructure |
| `WebSec.UnitTests` | xUnit tests (pure logic + EF InMemory service tests) | Shared, Infrastructure |

## Dependency injection
- `AddInfrastructure(config, env)` – DbContext, scope validator, job queue, scan engine, `ScanProcessor`, AI advisor, password hasher. Used by API **and** Worker.
- `AddApplicationServices()` – auth/project/target/scan/dashboard/AI services. API only.
- `AddApiServices(...)` – controllers, JSON (enums as strings), validation response, JWT, permission policies, rate limiter, CORS, health checks.

## Request flow
Controller (`[Authorize(Policy = "<Permission>")]`) → service (access check via `AccessibleProjects`: Admin sees all, others only projects they own) → EF Core → Mapperly model → `ApiResponse<T>` / `PaginatedResponse<T>`. Errors are thrown as `AppException` and mapped by `ExceptionMiddleware`.

## Scan flow
1. `scans/create`: authorize target via project access → `TargetScopeValidator` → insert `Scan(Queued)` + `ScanJob(Queued)` in one `SaveChanges` (single transaction) → return immediately.
2. Worker claims a job with `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` (safe with several workers).
3. `ScanProcessor` re-validates scope, sets Running, runs `IScanEngine` with an `IScanProgressReporter` that persists progress/URLs/findings in small saves and checks for `Cancelling` between steps.
4. Terminal state (Completed / Failed / Cancelled) is written for scan and job; worker shutdown mid-scan ends as Cancelled with a safe message.
5. Frontend polls `scans/get-progress` every 1.5 s until `isTerminal`.

## Deviations from the specification (and why)
| Spec | Implemented | Reason |
|---|---|---|
| .NET 10 LTS | **.NET 8 (`net8.0`)** | Only the .NET 8 SDK is installed on the dev machine; whole solution pinned via `backend/Directory.Build.props`. Upgrade = change `TargetFramework` + bump EF/ASP.NET packages to 10.x. |
| Repo root `websec-platform/` | Repo root is `DoAN3/` | Existing repository. |
| `WebSec.IntegrationTests` | Not created | Vertical slice verified by a scripted curl smoke test and a headless-browser walkthrough instead; see ROADMAP. |
| `ICrawler`, `IVulnerabilityDetector` | Not created | Mock engine neither crawls nor detects; empty abstractions were avoided. Add them with the first real passive detector. |
| Refresh tokens | Not implemented | Short-lived JWT only (60 min), stored in `sessionStorage`; `auth/logout` is client-side. |
| Vulnerability tables, comments, history, audit logs, reports, AI conversations | Not created yet | Findings (`scan_findings`) are the vertical slice; see `DATA_MODEL.md` for the planned tables. |
| `src/assets/i18n` | `public/i18n` | Angular 21 serves static files from `public/`. |
| Feature-local API services | One file `features/api.services.ts` | Five small typed services; split per feature when they grow. |
| ProjectMembers | Ownership only | Non-admin users see projects they own. |

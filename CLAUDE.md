# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

AGENTS.md (imported above) is the source of truth for commands, layer boundaries, conventions and scanner/AI rules. This file adds what you need on top of it. Deeper docs: `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_BOUNDARIES.md`, `docs/DEVELOPMENT.md`, `docs/ROADMAP.md`. The README and most user-facing text are in Vietnamese.

## Extra commands
- Single backend test: `dotnet test backend/WebSecPlatform.sln --filter "FullyQualifiedName~CoreRulesTests"` (xUnit, in `backend/tests/WebSec.UnitTests`)
- Single frontend spec: `cd frontend && npx ng test --watch=false --include src/app/core/auth.spec.ts` (Vitest via `@angular/build`)
- CI (`.github/workflows/build.yml`) runs `dotnet build` + `dotnet test --no-build`, then `npm ci`, `ng build` and `ng test` on Node 22.
- Integration tests (`backend/tests/WebSec.IntegrationTests`) need PostgreSQL: `docker compose up -d postgres`, or point `TEST_DATABASE_URL` at a server where the user may `CREATE DATABASE`.
- No `dotnet` on the host? Run the SDK in Docker: `docker run --rm -v "$PWD/backend":/src -w /src mcr.microsoft.com/dotnet/sdk:8.0 dotnet test WebSecPlatform.sln`
- macOS: Docker Desktop's CLI may be missing from `PATH`; it lives at `/Applications/Docker.app/Contents/Resources/bin`.
- `dotnet run` for the API and the compose `api` container both bind `127.0.0.1:5080`, so stop one before starting the other.

## Big picture
- **Stack:** Angular 21 SPA → `WebSec.Api` (ASP.NET Core, .NET 8, pinned in `backend/Directory.Build.props`) → PostgreSQL. `WebSec.Worker` shares the same DB and `AddInfrastructure(...)` DI and processes scans.
- **The DB is the queue.** `scans/create` writes `Scan(Queued)` + `ScanJob(Queued)` in one `SaveChanges`. The worker claims jobs with `FOR UPDATE SKIP LOCKED` (`Scanning/Queue/DbScanJobQueue.cs`). `ScanProcessor` re-runs `TargetScopeValidator`, drives `IScanEngine` and persists progress, URLs and findings through `IScanProgressReporter`, checking for `Cancelling` between steps. Status changes go through `ScanStateMachine`. The frontend polls `scans/get-progress` until `isTerminal`.
- **Scope is checked twice:** in the API before queuing and again in the worker. `MockScanEngine` is the only engine and sends no network traffic. Findings are deduplicated by `Fingerprint = SHA256(targetId|type|url|param)`.
- **Access model:** controllers use `[Authorize(Policy = "<Permission>")]`, with the permission matrix in `Shared/Enums/Permissions.cs` (`Roles.DefaultPermissions`). Row access goes through `db.AccessibleProjects(currentUser)` (Admin sees everything, others only projects whose `OwnerId` is them). There are no project members. Every new query on projects, targets, scans or findings must go through it.
- **Responses and errors:** services throw `AppException` (codes in `Shared/Errors/ErrorCodes.cs`), which `ExceptionMiddleware` maps to `ApiResponse`/`PaginatedResponse`.
- **Entity bases** (`Shared/Entities/BaseEntities.cs`): `AuditEntity` gets `CreatedDate`/`UpdatedDate`/`CreatedBy`/`UpdatedBy` filled automatically in `AppDbContext.SaveChanges` and has soft delete (`IsDeleted`, global query filter, so use `IgnoreQueryFilters()` to see deleted rows). Scan tables are append-only history on purpose and have no audit/soft-delete base.
- **Startup (`Api/Program.cs`):** in Development it migrates, seeds roles and permissions, seeds dev users, then seeds sample data (`Data/Seed/DevDataSeeder.cs`: `DEMO-*` projects on `.test` hosts with finished scans and no queued jobs; skipped if they already exist). Other environments opt in with `APPLY_MIGRATIONS` / `SEED_DEV_DATA`.
- **Evidence:** `EvidenceRedactor` strips secrets before evidence is stored and again before it goes to `AI/AiAdvisor.cs`. AI responses carry `isAiAssisted: true`.

## Frontend specifics
- All HTTP goes through `core/services/base-api.service.ts` (`post(action, body)` → `/api/<resource>/<action>`). The typed per-resource services live together in `features/api.services.ts`, and models in `shared/models/api.models.ts`.
- The JWT is kept in `sessionStorage` and attached by `core/interceptors/auth.interceptor.ts`. Routes are guarded by `core/guards/auth.guard.ts`. There is no refresh token, so log in again after an API restart that used an ephemeral key.
- i18n files are `public/i18n/{vi,en}.json`, not `src/assets`. Keep `frontend/.npmrc` (`legacy-peer-deps`) because it works around an npm 10 resolver crash.
- Reference designs for screens live in `design/`.

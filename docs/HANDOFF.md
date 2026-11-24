# Handoff checklist (spec §16)

Status on 2026-11-24, branch `claude/determined-bohr-sx2gfe`. Results below are from real runs; anything not run is marked **Not verified**.

## Checklist
| Item | Status | Where / result |
|---|---|---|
| Repository tree and projects | Done | See [Repository](#repository) below |
| Working solution, no pseudocode in the vertical slice | Done | `backend/WebSecPlatform.sln`, `frontend/` |
| Backend build | Done | `dotnet build backend/WebSecPlatform.sln` → succeeded (local SDK 8.0.134) |
| Frontend install / build | Done | `cd frontend && npm ci && npx ng build` → succeeded |
| Unit / integration tests | Done | `dotnet test backend/WebSecPlatform.sln` → UnitTests 51 passed, IntegrationTests 9 passed (PostgreSQL 16, local). `npx ng test --watch=false` → 11 passed (3 files) |
| EF migrations + DB init | Done | `docs/DATA_MODEL.md` (Migrations); the API migrates and seeds on startup in Development |
| Docker Compose | Partly | `docker compose config -q` → valid. **Not verified:** `docker compose up --build` (no Docker daemon in the build container). Run it on a machine with Docker and record the result here |
| Dev login / seed procedure | Done | `README.md` (dev accounts, Development only) |
| `docs/ARCHITECTURE.md`, `API_CONTRACT.md`, `DATA_MODEL.md`, `DEVELOPMENT.md`, `SECURITY_BOUNDARIES.md`, `ROADMAP.md` | Done | `docs/` |
| Implemented / mocked / scaffolded / not-yet list | Done | [Feature status](#feature-status) below |
| Decisions and deviations | Done | `docs/ARCHITECTURE.md` → "Deviations from the specification" |
| No secrets, no plaintext passwords, no arbitrary scanning | Done | Only `.env.example` with placeholders, no key patterns found in tracked files. Passwords use ASP.NET Core `PasswordHasher`. Scans require an enabled, authorized target, checked in the API and again in the worker; the mock engine sends no traffic |
| CI | Done | GitHub Actions `build` is green on `main` (`2f87167`). The Postgres service for integration tests was added after that run and has **not run in CI yet** |

## Repository
| Path | What it is |
|---|---|
| `backend/src/WebSec.Shared` | Entities, enums, permissions, DTOs, params, response wrappers, error codes. No EF/ASP.NET dependency |
| `backend/src/WebSec.Infrastructure` | `AppDbContext` + migrations + seed, services, scanning (queue, state machine, scope validator, mock engine, redactor), AI advisor, audit, mapping |
| `backend/src/WebSec.Api` | Thin controllers (`POST /api/<resource>/<action>`), JWT auth, permission policies, rate limits, health checks |
| `backend/src/WebSec.Worker` | Background service that claims `scan_jobs` (`FOR UPDATE SKIP LOCKED`) and runs `ScanProcessor` |
| `backend/tests/WebSec.UnitTests` | Core rules: params, validation, permissions, state machines, scope, redaction, AI mock |
| `backend/tests/WebSec.IntegrationTests` | Real API + throwaway PostgreSQL database: health, auth, 401/403, project CRUD, scan lifecycle, scope rejection |
| `frontend/` | Angular 21 SPA: `core` (auth, guards, interceptors, layout), `shared` (models, UI), `features` (13 screens W01–W13) |
| `design/` | Reference designs (`design/source/*.dc.html` synced with the design artifact) |

## Feature status
**Implemented (real logic, persisted):** login/JWT, RBAC with 4 roles; projects and targets CRUD with paging, search and soft delete; scan queue + worker + progress + cancel; scope validation in the API and worker; findings deduplicated into vulnerabilities with lifecycle, assign, comments and history; dashboard; reports (snapshot, print to PDF); users (change role, lock/unlock); audit log with stats and CSV export; i18n VI/EN.

**Mocked:** scan engine (`MockScanEngine`, sample findings, no network traffic); AI advisor (`MockAiAdvisor`, keyword-routed answers, marked `isAiAssisted`).

**Scaffolded (contract exists, single implementation):** `IScanEngine`, `IScanJobQueue`, `IScanProgressReporter`, `ITargetScopeValidator`, `IAiAdvisor`.

**Not yet:** passive detectors (`ICrawler`, `IVulnerabilityDetector`) and request limits; real AI provider; refresh tokens; creating users; AI conversation storage; scan event table; CVSS/priority/SLA; report date range / AI summary / stored PDF; target path rules; `project_members`; audit of policy 403s; .NET 10 upgrade (.NET 8 is past end of support). Order and detail: `docs/ROADMAP.md`.

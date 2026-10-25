# Roadmap

## Milestones

| # | Milestone | Status | Notes |
|---|---|---|---|
| 0 | Repository discovery & plan | Done | Repo contained only `design/` and agent skills. Only .NET 8 SDK available → `net8.0` (see ARCHITECTURE deviations). |
| 1 | Monorepo & infrastructure skeleton | Done | Solution, Angular app, docker-compose, Dockerfiles, health checks, docs. |
| 2 | Shared conventions & database | Done | Base entities, responses, params, errors, `AppDbContext`, `InitialCreate` migration, seed, Mapperly. |
| 3 | Auth & RBAC | Done | JWT login/me/logout, permission policies, 401/403 wrappers, login rate limit, Angular guard/interceptor. Refresh tokens: Planned. |
| 4 | Project/Target vertical slice | Done | CRUD + paging/search/soft delete through UI → API → PostgreSQL. |
| 5 | Scan queue & safe worker | Done | Persistent `scan_jobs` queue with SKIP LOCKED claim, mock engine, progress polling, cancel, scope rejection. |
| 6 | Vulnerability & AI abstractions | In progress | Done: `IAiAdvisor` + `MockAiAdvisor`, explain/remediate endpoints + UI. Planned: vulnerability tables/statuses, dedup by fingerprint, assignment, comments, history. |
| 7 | QA, docs & handoff | In progress | Builds/tests/smoke tests run; integration test project and CI on GitHub not yet verified. |

## Known limitations
- No `WebSec.IntegrationTests` project; the vertical slice was verified by a curl smoke test and a headless-browser walkthrough (not committed as automated tests).
- Mock scan engine only; no real HTTP requests or passive header checks yet.
- No refresh token; token in `sessionStorage` (60 min).
- Project access is owner-based; `project_members` not implemented.
- Vulnerabilities, Reports, Users, Roles, AI Assistant pages are "coming later" placeholders.
- Audit log table not implemented (audit fields on entities only).

## Next steps
1. Integration tests (WebApplicationFactory + disposable PostgreSQL / Testcontainers) for auth, project CRUD and scan lifecycle.
2. Passive `SecurityHeadersDetector` with `ICrawler`/`IVulnerabilityDetector`, request limits and redirect scope checks.
3. Vulnerability module: normalize findings by fingerprint, status workflow, assignment, comments, history.
4. Audit log, refresh tokens (HttpOnly cookie), user/role management screens.
5. Real AI provider adapter behind `IAiAdvisor` with timeouts and safe error mapping; AI conversations.
6. Report generation.
7. Upgrade to .NET 10 LTS before .NET 8 end of support (10 Nov 2026).

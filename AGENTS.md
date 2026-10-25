# AGENTS.md – rules for coding agents in this repo

## Commands
| Task | Command (from repo root) |
|---|---|
| Start DB | `docker compose up -d postgres` |
| Backend build | `dotnet build backend/WebSecPlatform.sln` |
| Backend tests | `dotnet test backend/WebSecPlatform.sln` |
| Run API (applies migrations + dev seed) | `dotnet run --project backend/src/WebSec.Api --launch-profile http` |
| Run Worker | `dotnet run --project backend/src/WebSec.Worker` |
| New migration | `cd backend && dotnet tool restore && dotnet ef migrations add <Name> -p src/WebSec.Infrastructure -s src/WebSec.Infrastructure -o Data/Migrations` |
| Frontend install / build / test | `cd frontend && npm ci && npx ng build && npx ng test --watch=false` |
| Frontend dev server | `cd frontend && npx ng serve` (proxies `/api` to `localhost:5080`) |
| Full stack in Docker | `docker compose up --build` |

## Architecture boundaries
- `WebSec.Shared` → no references to other projects, EF Core or ASP.NET Core.
- `WebSec.Infrastructure` → Shared only. Holds DbContext, services, scanning, AI, security.
- `WebSec.Api` and `WebSec.Worker` → Shared + Infrastructure. Worker never references Api.
- Controllers are thin: validate → call service → wrap in `ApiResponse`. No `DbContext` in controllers.
- Frontend: `core` (auth, guards, interceptors, layout), `shared` (models, reusable UI), `features` (pages + API services). Components never build URLs or call `HttpClient` directly.

## Conventions
- Business endpoints are `POST /api/<resource>/<action>` (see `docs/API_CONTRACT.md`).
- C#: PascalCase public members, nullable enabled. DB: snake_case (EFCore.NamingConventions). Enums stored as strings.
- Mapping: Riok.Mapperly (`Infrastructure/Mapping/AppMapper.cs`). No AutoMapper.
- Angular: standalone components, `inject()`, signals, `@if/@for` with `track`, Reactive Forms, Transloco keys for every visible string (`public/i18n/vi.json` + `en.json` must stay in sync), Tailwind tokens from `src/styles.css` (no raw hex in components).
- No `any`/`dynamic`/`object` as blanket types.

## Rules
- Run the relevant build/tests before saying something is done. Report real command output; never invent results.
- Never commit secrets. Only `.env.example` with placeholders. Dev seed accounts are local-only.
- Scanner scope: only targets stored in a project, enabled **and** explicitly authorized. No exploitation, brute force, payload flooding or scanning of arbitrary/public hosts. Private/loopback targets only with `ALLOW_PRIVATE_TARGETS=true` in Development.
- AI output is advisory: AI code paths must not change finding/vulnerability status or severity, or start scans.
- Make small, focused changes. Do not overwrite or delete user data, migrations or existing code without understanding it.

# Development guide

## Prerequisites
- .NET SDK 8.0.x (`dotnet --list-sdks`)
- Node.js 22 LTS + npm 10
- Docker Desktop (for PostgreSQL, or the whole stack)

## Setup
```bash
git clone <repo> && cd DoAN3
cp .env.example .env            # optional: docker compose works with built-in defaults
cd backend && dotnet tool restore && cd ..
cd frontend && npm ci && cd ..   # .npmrc sets legacy-peer-deps (works around an npm 10 resolver crash)
```

## Configuration
Backend reads environment variables (they override `appsettings*.json`):

| Variable | Default (dev) | Notes |
|---|---|---|
| `DATABASE_URL` | `appsettings.Development.json` → `Host=localhost;…;Password=change_me_local_only` | Npgsql connection string |
| `JWT_SIGNING_KEY` | none → ephemeral random key in Development | ≥ 32 chars; **required** outside Development |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `WebSecPlatform` / `WebSecPlatformClient` | |
| `JWT_ACCESS_TOKEN_MINUTES` | 60 | |
| `FRONTEND_ORIGIN` | `http://localhost:4200` | CORS allowlist (comma-separated) |
| `AI_PROVIDER` | `mock` | anything else → AI endpoints return 503 `AI_PROVIDER_UNAVAILABLE` until an adapter exists |
| `ALLOW_PRIVATE_TARGETS` | `true` in `appsettings.Development.json` | ignored (forced false) outside Development |
| `APPLY_MIGRATIONS` / `SEED_DEV_DATA` | implied in Development | opt-in flags for other environments |

With an ephemeral JWT key, restarting the API invalidates existing tokens – just log in again.

## Run locally
```bash
docker compose up -d postgres                                        # 127.0.0.1:5432
dotnet run --project backend/src/WebSec.Api --launch-profile http    # :5080, migrates + seeds
dotnet run --project backend/src/WebSec.Worker                       # processes scan jobs
cd frontend && npx ng serve                                          # :4200, /api proxied to :5080
```

## Run with Docker
```bash
docker compose up --build        # postgres, api (:5080), worker, frontend (:4200)
docker compose down              # keep data;  add -v to drop the pgdata volume
```
All ports bind to `127.0.0.1` only.

## Tests
```bash
dotnet test backend/WebSecPlatform.sln                 # xUnit
cd frontend && npx ng test --watch=false               # Vitest (auth guard/interceptor)
cd frontend && npx ng build                            # production build
```
Service tests use EF InMemory; PostgreSQL-specific SQL (job claim, `ILIKE`) is covered by running the stack.

## Troubleshooting
- **`npm install` fails with `Cannot read properties of null (reading 'edgesOut')`** – npm 10 bug; keep `frontend/.npmrc` (`legacy-peer-deps=true`).
- **API exits with a Npgsql connection error** – PostgreSQL is not up: `docker compose up -d postgres`, check `docker compose ps`.
- **Port 5432 already in use** – stop the other PostgreSQL or change the host port in `docker-compose.yml` and `DATABASE_URL`.
- **Scan stays `Queued`** – the Worker is not running.
- **Scan rejected with `SCAN_SCOPE_REJECTED`** – target is disabled, not marked authorized, unresolvable, or resolves to a private address while `ALLOW_PRIVATE_TARGETS` is off.
- **Frontend shows "Cannot reach the API"** – API not running on :5080 (or set `API_PROXY_TARGET` for `ng serve`).

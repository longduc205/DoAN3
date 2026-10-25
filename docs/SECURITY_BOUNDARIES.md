# Security boundaries

## Authorized targets only
- A scan can only reference a `targetId` stored in a project the caller can access (Admin: all; others: projects they own). The API never accepts a free-form URL for scanning.
- The target must be `is_enabled` **and** `is_authorized` (explicit "I own / am authorized to test" checkbox).
- `TargetScopeValidator` runs **before** the scan + job are created (API) and **again** when the worker picks up the job.

## URL / network validation
- Scheme must be `http` or `https`; embedded credentials (`user:pass@`), query strings and fragments in the base URL are rejected.
- The host is resolved; if any address is loopback, RFC1918 private, link-local (incl. `169.254.169.254` metadata), CGNAT, unspecified, or IPv6 ULA/link/site-local, the scan is rejected unless `ALLOW_PRIVATE_TARGETS=true` **and** the environment is Development.
- Unresolvable hosts are rejected.

## What the scanner does / does not do
- Current engine: `MockScanEngine` – **sends no network traffic**, produces deterministic sample URLs/findings under the validated base URL.
- Not implemented and out of scope: exploitation, brute force, credential attacks, payload flooding, destructive checks, scanning arbitrary or public Internet hosts.
- When a real passive engine is added it must enforce: request timeout, max URL count/depth, concurrency limit, request delay, max response size, redirect re-validation against the same scope. These limits are planned, not yet implemented (no real requests are made today).

## Rate limits
- `auth/login`: 10 requests/min per client IP.
- `ai/*`: 20 requests/min per user.
- Exceeded → 429 `RATE_LIMITED`.

## Secrets
- No secrets in source control: only `.env.example` with placeholders; `.env` is git-ignored.
- `JWT_SIGNING_KEY` is mandatory outside Development; in Development a random ephemeral key is generated and never logged.
- Passwords are hashed with ASP.NET Core `PasswordHasher` (PBKDF2). Dev seed accounts are created only in Development or with `SEED_DEV_DATA=true`.
- CORS: only origins listed in `FRONTEND_ORIGIN`; no wildcard with credentials.
- Error responses never contain stack traces, SQL, connection strings or tokens.

## Evidence redaction
`EvidenceRedactor` strips `Authorization`/`Cookie`/`Set-Cookie`/API-key headers, `Bearer` tokens and `password|token|secret|session…=` parameters before evidence is stored, and again before it is sent to the AI advisor. `evidence_redacted` records whether anything was removed. Logs contain IDs, states, timings and counters only.

## AI data boundaries
- AI endpoints load only findings inside the caller's accessible projects.
- Context sent to the advisor is a fixed record (type, title, URL, severity, redacted evidence ≤ 1000 chars); evidence is treated as untrusted data, not instructions.
- AI output is returned with `isAiAssisted: true` and shown with an "advisory only" label. AI code paths are read-only: they cannot change severity/status or start scans (covered by a unit test).
- With `AI_PROVIDER` other than `mock` and no adapter, endpoints return 503 `AI_PROVIDER_UNAVAILABLE` instead of a fake success. API keys are never placed in prompts, logs or messages.

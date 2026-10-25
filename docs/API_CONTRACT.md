# API contract

Base URL: `http://localhost:5080`. All business endpoints are **POST** with a JSON body (empty `{}` when there is no input). Enums are strings. Swagger (Development): `/swagger`.

Auth: `Authorization: Bearer <accessToken>` from `auth/login`. Every endpoint except `auth/login` and `/health/*` requires authentication.

## Response shapes

```json
{ "success": true, "data": { }, "message": null, "code": null, "traceId": "…" }
{ "success": true, "data": [ ], "paging": { "page": 1, "pageSize": 10, "totalItems": 0, "totalPages": 0 }, "message": null, "code": null, "traceId": "…" }
{ "success": false, "data": null, "message": "The requested project was not found.", "code": "NOT_FOUND", "traceId": "…" }
```

Validation errors (400, `VALIDATION_ERROR`) put field errors in `data`: `{ "Code": ["The Code field is required."] }`.

| HTTP | code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` (also returned for records outside the caller's projects) |
| 409 | `CONFLICT` |
| 422 | `SCAN_SCOPE_REJECTED` |
| 429 | `RATE_LIMITED` |
| 503 | `AI_PROVIDER_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` (no stack traces / SQL in body) |

Search params (`BaseSearchParam`): `page` (default 1), `pageSize` (default 10, max 100 – out-of-range values are **normalized**, not rejected), `keyword`, `sortBy` (allowlisted per service, unknown values fall back to the default), `sortDirection` (`Asc`/`Desc`), `isActive`.

## Implemented endpoints

| Path | Request | Response `data` | Permission |
|---|---|---|---|
| `POST /api/auth/login` | `{ userName, password }` | `LoginResult { accessToken, expiresAt, user }` | anonymous, rate-limited 10/min/IP |
| `POST /api/auth/me` | `{}` | `CurrentUserModel` | authenticated |
| `POST /api/auth/logout` | `{}` | `true` (client drops token) | authenticated |
| `POST /api/dashboard/get-summary` | `{}` | `{ projects, targets, scans, findings, findingsBySeverity }` | `Project.View` |
| `POST /api/projects/get-all` | `ProjectSearchParam` | `ProjectModel[]` + paging | `Project.View` |
| `POST /api/projects/get-by-id` | `{ id }` | `ProjectModel` | `Project.View` |
| `POST /api/projects/create` | `{ code, name, description? }` | `ProjectModel` | `Project.Create` |
| `POST /api/projects/update` | `{ id, code, name, description?, status }` | `ProjectModel` | `Project.Update` |
| `POST /api/projects/delete` | `{ id }` | `true` (soft delete) | `Project.Update` |
| `POST /api/targets/get-all` | `TargetSearchParam { projectId? }` | `TargetModel[]` + paging | `Project.View` |
| `POST /api/targets/get-by-id` | `{ id }` | `TargetModel` | `Project.View` |
| `POST /api/targets/create` | `{ projectId, name, baseUrl, environment, scopeMode, isEnabled, isAuthorized }` | `TargetModel` | `Project.Update` |
| `POST /api/targets/update` | create fields + `id` (project cannot change) | `TargetModel` | `Project.Update` |
| `POST /api/targets/delete` | `{ id }` | `true` (soft delete + disable, scans kept) | `Project.Update` |
| `POST /api/scans/get-all` | `ScanSearchParam { projectId?, targetId?, status? }` | `ScanModel[]` + paging | `Scan.View` |
| `POST /api/scans/get-by-id` | `{ id }` | `ScanModel` | `Scan.View` |
| `POST /api/scans/create` | `{ targetId, scanType: "Mock" }` | `ScanModel` (status `Queued`) | `Scan.Create` |
| `POST /api/scans/get-progress` | `{ id }` | `{ id, status, progressPercent, totalUrls, totalRequests, totalFindings, isTerminal }` | `Scan.View` |
| `POST /api/scans/cancel` | `{ id }` | `ScanModel` (Queued→Cancelled, Running→Cancelling) | `Scan.Create` |
| `POST /api/scans/get-findings` | `FindingSearchParam { scanId, severity? }` | `ScanFindingModel[]` + paging (ordered by severity) | `Scan.View` |
| `POST /api/ai/explain-vulnerability` | `{ findingId }` | `AiAdviceModel { content, provider, model, isAiAssisted: true, generatedAt }` | `AI.Ask`, rate-limited 20/min/user |
| `POST /api/ai/suggest-remediation` | `{ findingId }` | `AiAdviceModel` | `AI.Ask`, rate-limited 20/min/user |
| `GET /health/live` | – | `Healthy` | anonymous |
| `GET /health/ready` | – | `Healthy` / `Unhealthy` (database check) | anonymous |

Example:

```http
POST /api/scans/create
Authorization: Bearer eyJ…
{ "targetId": "31c3141d-b298-49e2-897b-b04fab6d6abd" }

422 { "success": false, "code": "SCAN_SCOPE_REJECTED", "message": "Target has not been confirmed as authorized for testing.", … }
```

## Planned (not implemented – routes do not exist yet)
`auth/refresh`, `vulnerabilities/get-all|get-by-id|update-status|assign|add-comment`, `ai/ask`, `reports/*`, `users/*`, `roles/*`.

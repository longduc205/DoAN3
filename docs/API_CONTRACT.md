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
| `POST /api/dashboard/get-summary` | `{}` | `{ projects, targets, scans, findings, findingsBySeverity, openVulnerabilities, openBySeverity, byStatus, reappeared, unassigned, riskScore }` | `Project.View` |
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
| `POST /api/vulnerabilities/get-all` | `VulnerabilitySearchParam { projectId?, severity?, status?, isOpen?, findingType?, assigneeId?, assignedToMe, keyword?, sortBy: severity\|lastDetected\|firstDetected\|status\|title }` | `VulnerabilityModel[]` + paging | `Vulnerability.View` (own projects + items assigned to me) |
| `POST /api/vulnerabilities/get-by-id` | `{ id }` | `VulnerabilityDetailModel` (+ `latestFinding`, `occurrences`, `allowedTransitions` for the caller) | `Vulnerability.View` |
| `POST /api/vulnerabilities/update-status` | `{ id, status, reason?, reviewAt? }` | `VulnerabilityDetailModel`; 409 for a transition not allowed by `VulnerabilityStateMachine`, 400 when the reason / review date is missing | `Vulnerability.Update` (+ `Vulnerability.Triage` or being the assignee, per transition) |
| `POST /api/vulnerabilities/assign` | `{ ids: [...], assigneeId }` (bulk) | number assigned; Open/Triaged → Assigned, re-assign keeps status | `Vulnerability.Triage` |
| `POST /api/vulnerabilities/get-assignees` | `{}` | `UserLookupModel[]` (active Developers / Analysts) | `Vulnerability.Triage` |
| `POST /api/vulnerabilities/add-comment` | `{ vulnerabilityId, content, isAiNote }` | `VulnerabilityCommentModel` | `Vulnerability.View` |
| `POST /api/vulnerabilities/get-comments` / `get-history` | `{ id }` | comments (oldest first) / history (newest first) | `Vulnerability.View` |
| `POST /api/reports/get-all` | `ReportSearchParam { projectId? }` | `ReportModel[]` + paging (newest first) | `Report.View` |
| `POST /api/reports/get-by-id` | `{ id }` | `ReportDetailModel` with `snapshot` (system data only) | `Report.View` |
| `POST /api/reports/create` | `{ projectId, title?, template: Executive\|Technical }` | `ReportDetailModel` (`Ready`, or `Failed` with a safe error); 400 when the project has no scans | `Report.Generate` |
| `POST /api/reports/retry` | `{ id }` | `ReportDetailModel`; 409 unless the report is `Failed` (Ready reports are immutable) | `Report.Generate` |
| `POST /api/users/get-all` | `UserSearchParam { role?, keyword? }` | `UserAdminModel[]` (+ `lastLoginAt` from the audit trail) | `User.Manage` |
| `POST /api/users/change-role` | `{ userId, role }` (one role per user) | `UserAdminModel`; 409 when changing your own role | `User.Manage` |
| `POST /api/users/get-role-permissions` | `{}` | `RolePermissionsModel[]` (read-only matrix from the database) | `User.Manage` |
| `POST /api/audit-logs/get-all` | `AuditLogSearchParam { userId?, action?, entityType?, result?, from?, to?, keyword? }` | `AuditLogModel[]` + paging (newest first). Read-only: no update/delete endpoint exists | `AuditLog.View` |
| `POST /api/ai/get-context` | `{ findingId }` or `{ vulnerabilityId }` | `AiContextModel` – exactly what would be sent (redacted, ≤1000 chars evidence); does not call the provider | `AI.Ask`, rate-limited 20/min/user |
| `POST /api/ai/ask` | `{ vulnerabilityId, question }` (question ≤ 1000 chars; a vulnerability must be chosen as context) | `AiAdviceModel`; read-only, never changes status/severity | `AI.Ask`, rate-limited 20/min/user |
| `POST /api/ai/explain-vulnerability` | `{ findingId }` or `{ vulnerabilityId }` (latest occurrence) | `AiAdviceModel { content, provider, model, isAiAssisted: true, generatedAt }` | `AI.Ask`, rate-limited 20/min/user |
| `POST /api/ai/suggest-remediation` | `{ findingId }` or `{ vulnerabilityId }` | `AiAdviceModel` | `AI.Ask`, rate-limited 20/min/user |
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
`auth/refresh`, creating / locking users, stored AI conversations.

# ĐẶC TẢ DỰNG CODEBASE – WEB SECURITY PLATFORM TÍCH HỢP AI

**Tên đề tài:** Xây dựng nền tảng quản lý và đánh giá lỗ hổng bảo mật ứng dụng Web tích hợp trí tuệ nhân tạo  
**Loại tài liệu:** Technical specification + implementation brief dành cho AI Coding Agent  
**Phiên bản:** 1.0  
**Mục tiêu của giai đoạn này:** Dựng codebase có kiến trúc rõ ràng, chạy được từ đầu đến cuối và có một vertical slice hoạt động; chưa xây dựng scanner tấn công toàn diện.

---

## 0. Chỉ dẫn quan trọng cho AI Coding Agent

Bạn được giao nhiệm vụ **tạo codebase nền tảng**, không chỉ viết kế hoạch hay tạo code minh họa trong câu trả lời. Hãy thao tác trên repository/workspace hiện có.

### Quy trình bắt buộc

1. Kiểm tra repository hiện tại trước khi thay đổi: xem cấu trúc, git status, các file đã có, phiên bản SDK/runtime và quy ước hiện hữu. Không xóa hoặc ghi đè code có sẵn nếu chưa hiểu chức năng của nó.
2. Nếu repository trống, tạo cấu trúc theo tài liệu này. Nếu đã có code, lập kế hoạch điều chỉnh và bảo toàn những phần đang hoạt động.
3. Tạo `AGENTS.md` ở root để ghi các quy tắc làm việc của coding agent; tạo các tài liệu kiến trúc được liệt kê ở phần 17.
4. Triển khai theo milestone nhỏ. Sau mỗi milestone, chạy build/test phù hợp và sửa lỗi trước khi tiếp tục.
5. Không tạo một file khổng lồ chứa toàn bộ logic. Chia module, DTO, service, component và test theo trách nhiệm.
6. Không bịa kết quả kiểm thử. Báo cáo chính xác command đã chạy, kết quả thành công/thất bại và phần nào chưa hoàn thành.
7. Không tự ý mở rộng scope thành một công cụ pentest toàn diện. Giai đoạn đầu chỉ tạo nền tảng, scan queue/worker dạng an toàn và mock/passive scanner.
8. Không sử dụng domain, API key, mật khẩu hoặc dữ liệu thật của người dùng trong seed/config. Không commit secrets.

### Kết quả mong đợi

Khi kết thúc giai đoạn đầu, một developer có thể clone/mở repository, đọc README, khởi động các thành phần bằng hướng dẫn rõ ràng, đăng nhập bằng tài khoản phát triển được seed, tạo project/target, khởi tạo một scan demo, theo dõi trạng thái scan, xem finding mẫu và gọi AI advisor dạng mock. Chưa yêu cầu các detector chủ động SQL Injection/XSS phải hoàn chỉnh ở giai đoạn này.

---

## 1. Tổng quan sản phẩm

### 1.1. Bài toán

Hệ thống quản lý quy trình đánh giá bảo mật cho các ứng dụng Web do người dùng sở hữu hoặc được ủy quyền kiểm thử. Nền tảng quản lý Project, Target, Scan, Finding, Vulnerability, người xử lý, trạng thái khắc phục, lịch sử và báo cáo. AI đóng vai trò cố vấn để giải thích kết quả, đề xuất biện pháp khắc phục và hỗ trợ soạn báo cáo; AI không phải nguồn duy nhất quyết định một phát hiện có phải lỗ hổng thật hay không.

### 1.2. Vai trò người dùng

- **Admin:** quản lý người dùng, role/permission, cấu hình hệ thống và xem audit log.
- **Security Analyst:** tạo project/target, khởi chạy scan trong scope được phép, xem xét findings, quản lý vulnerability, phân công xử lý và tạo report.
- **Developer:** xem vulnerability được giao, đọc evidence/recommendation, cập nhật tiến độ, ghi comment và gửi yêu cầu phân tích tới AI.
- **Viewer (có thể bật sau):** chỉ xem các project và report được cấp quyền.

Trong bản bootstrap, tối thiểu triển khai Admin và Security Analyst; Developer có thể là role seed sẵn nếu vertical slice đủ thời gian.

### 1.3. Luồng nghiệp vụ chính

```text
Login
  -> Dashboard
  -> Create Project
  -> Add Target (authorized target only)
  -> Create Scan
  -> Persist Scan + enqueue job
  -> Background Worker processes scan
  -> Save ScanUrl / ScanFinding
  -> Normalize finding into Vulnerability (later milestone)
  -> Review / Assign / Track remediation
  -> AI explanation and remediation advice
  -> Generate report
```

### 1.4. Mục tiêu của codebase giai đoạn đầu

- Tạo nền kiến trúc dễ mở rộng theo convention Angular + .NET được mô tả trong tài liệu này.
- Có một vertical slice hoạt động: **Auth -> Project/Target CRUD -> tạo scan demo -> worker xử lý -> xem progress/findings**.
- Có migration database, seed development, config qua environment variables, logging và health checks.
- Có test cho các phần nghiệp vụ cốt lõi.
- Tạo interface cho Scanner và AI để có thể thay mock implementation bằng implementation thật trong các milestone sau.

---

## 2. Phạm vi và ngoài phạm vi

### 2.1. Phải triển khai trong giai đoạn codebase đầu tiên

1. Monorepo Backend + Frontend.
2. PostgreSQL và EF Core migrations.
3. Base entities, DTOs, params, enums, response wrappers và error codes.
4. Authentication và role-based authorization cơ bản.
5. User/Role/Permission foundation.
6. Project và Target CRUD có pagination/search/soft delete.
7. Scan record, status lifecycle, persistent queue hoặc queue đơn giản được thiết kế để có thể nâng cấp.
8. Worker chạy scan demo an toàn và cập nhật progress.
9. Findings mẫu từ mock/passive checks; chưa chạy payload khai thác.
10. AI advisor interface cùng mock adapter; không bắt buộc gọi nhà cung cấp AI thật ở giai đoạn này.
11. Angular layout, routing, auth guard, HTTP interceptor, shared components và các màn hình vertical slice.
12. Docker Compose, `.env.example`, README, architecture docs, tests và CI build cơ bản nếu thời gian cho phép.

### 2.2. Chưa triển khai ở giai đoạn đầu

- Scanner chủ động đầy đủ cho mọi nhóm OWASP Top 10.
- Exploit tự động, brute force, payload flooding hoặc scan diện rộng.
- Scan các website Internet không được cấp quyền.
- Distributed worker phức tạp, Kubernetes, RabbitMQ/Kafka hoặc microservices.
- AI agent tự quyết định severity, tự thay đổi dữ liệu nghiệp vụ hoặc tự sửa code production.
- Billing/subscription, multi-tenant enterprise đầy đủ, notification gateway hoặc tích hợp CI/CD hoàn chỉnh.

Những chức năng này chỉ được đưa vào roadmap, không cần giả vờ đã hoạt động.

---

## 3. Quyết định công nghệ

### 3.1. Frontend

- Angular 21, Standalone Components, lazy-loaded feature routes.
- TypeScript theo phiên bản tương thích Angular 21.
- Reactive Forms.
- Tailwind CSS v4 với design tokens; tránh custom CSS khi utility class giải quyết tốt.
- Transloco (`@jsverse/transloco`) cho text giao diện; mặc định tiếng Việt, có English locale.
- RxJS 7.x theo compatibility của Angular 21.
- Dùng `inject()` cho dependency injection khi phù hợp.
- Dùng cú pháp template mới `@if`, `@else`, `@for`; `track item.id` cho danh sách.
- Không dùng NgModule cho feature mới.

Tại thời điểm viết tài liệu, Angular 21 yêu cầu Node.js thuộc một trong các range được tài liệu Angular công bố, TypeScript `>=5.9.0 <6.0.0` và RxJS `^6.5.3 || ^7.4.0`. Ưu tiên một bản Node 22 LTS tương thích và pin dependency bằng lockfile. Tham khảo: https://angular.dev/reference/versions

### 3.2. Backend

- ASP.NET Core Web API, C# với Nullable Reference Types bật.
- EF Core + Npgsql provider.
- Riok.Mapperly cho mapping source-generator; không dùng AutoMapper.
- Dependency Injection mặc định của .NET.
- Background Worker chạy bằng `BackgroundService`/host riêng.
- OpenAPI/Swagger cho tài liệu API trong development.
- Unit test: xUnit; integration test: WebApplicationFactory khi phù hợp.

**Quyết định phiên bản:** Tài liệu kiến trúc tham khảo ban đầu nhắc đến .NET 8. Tuy nhiên, theo lịch hỗ trợ chính thức của Microsoft, .NET 8 kết thúc hỗ trợ ngày **10/11/2026**, trong khi .NET 10 là LTS được hỗ trợ tới **14/11/2028**. Vì đây là codebase mới tạo vào cuối năm 2026, mặc định sử dụng **.NET 10 LTS (`net10.0`)**, giữ nguyên phong cách kiến trúc và conventions. Chỉ dùng `net8.0` nếu môn học, repository tham chiếu hoặc giảng viên bắt buộc tương thích với .NET 8; không được âm thầm trộn target framework. Nguồn chính thức: https://dotnet.microsoft.com/en-us/platform/support/policy

### 3.3. Database và triển khai

- PostgreSQL.
- Docker Compose cho database, API, Worker và frontend trong môi trường dev.
- Config bằng environment variables và `.env` cục bộ; chỉ commit `.env.example`.
- EF Core migrations là nguồn quản lý schema.
- Log có cấu trúc; thêm health checks cho API và database.

### 3.4. Quy ước API

Để tương thích với coding style guide tham khảo, **endpoint nghiệp vụ mặc định sử dụng POST** với route rõ nghĩa như `/api/projects/get-all`, `/api/projects/create`, `/api/projects/update`, `/api/projects/delete`. Endpoint health check và OpenAPI có thể dùng cách thức tiêu chuẩn tương ứng. Không để một phần API tự dùng quy ước khác mà không ghi trong `docs/API_CONTRACT.md`.

### 3.5. Quy ước đặt tên

- C#: PascalCase cho class/property/method public; camelCase cho biến local/parameter.
- Angular: class/interface PascalCase, file name kebab-case, member theo coding convention Angular và service API có thể giữ PascalCase nếu cần tương thích style tham khảo.
- Database: `snake_case` cho table/column.
- Enum lưu dạng string hoặc mã ổn định nếu có lý do; phải thống nhất và ghi rõ trong migration.
- Không viết business logic trong Controller hoặc Angular component template.

---

## 4. Kiến trúc tổng thể

```text
┌──────────────────────────────────────────────────────────────────┐
│ Angular 21                                                       │
│ Login | Dashboard | Projects | Targets | Scans | Vulnerabilities │
│ Reports | Users/Roles | AI Assistant                              │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / JSON
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ ASP.NET Core API                                                 │
│ Controllers -> Validation -> Services -> Infrastructure          │
│ Authentication / Authorization / Error handling / OpenAPI         │
└───────────────────┬───────────────────────────┬──────────────────┘
                    │                           │
                    ▼                           ▼
              PostgreSQL                  Persistent Scan Jobs
                                                │
                                                ▼
                                      WebSec.Worker Service
                                      ├── Scope Guard
                                      ├── Crawler abstraction
                                      ├── Detector abstraction
                                      ├── Finding normalizer
                                      └── Progress + status updates
                                                │
                                                ▼
                                      Scan findings / vulnerabilities
                                                │
                                                ▼
                                          AI Advisor
                                  Explain / Remediation / Report text
```

### 4.1. Layer responsibilities

**Shared (Domain/Contracts):** entities, DTOs/models, search parameters, enums, error code, response models và các abstraction thực sự dùng chung. Không phụ thuộc ASP.NET Core, EF Core hoặc Angular.

**Infrastructure (Data + Core + Implementations):** `DbContext`, EF configurations, migrations support, service implementations, Mapperly mappers, authorization support, scan engine abstractions/implementations, AI adapters, audit service và background job persistence.

**API (Presentation):** Controllers mỏng, authentication/authorization setup, middleware, validation, API version/configuration, dependency registration. Controller nhận request, validate, gọi service và trả response.

**Worker (Host riêng):** tiến trình xử lý job scan; dùng cùng Infrastructure và Shared, không phụ thuộc vào API project. Worker không tự nhận mục tiêu mới ngoài job hợp lệ đã lưu trong database.

**Frontend:** `core`, `shared`, `features`; route-level lazy loading; API clients và models không trộn với UI components.

### 4.2. Nguyên tắc phụ thuộc

- `Shared` không tham chiếu `Infrastructure`, `Api` hoặc `Worker`.
- `Infrastructure` được phép tham chiếu `Shared`.
- `Api` tham chiếu `Shared` và `Infrastructure`.
- `Worker` tham chiếu `Shared` và `Infrastructure`.
- Không để API Controller gọi thẳng `DbContext` để tự viết business logic.
- Không cho frontend truy cập database hoặc gọi trực tiếp provider AI.
- Tránh generic repository quá trừu tượng nếu nó chỉ bọc lại EF Core mà không tạo giá trị.

---

## 5. Cấu trúc repository mục tiêu

```text
websec-platform/
├── AGENTS.md
├── README.md
├── .gitignore
├── .editorconfig
├── .env.example
├── docker-compose.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATA_MODEL.md
│   ├── DEVELOPMENT.md
│   ├── SECURITY_BOUNDARIES.md
│   └── ROADMAP.md
├── backend/
│   ├── WebSecPlatform.sln
│   ├── Directory.Build.props
│   ├── src/
│   │   ├── WebSec.Shared/
│   │   │   ├── Entities/
│   │   │   ├── DTOs/
│   │   │   ├── Models/
│   │   │   ├── Params/
│   │   │   ├── Enums/
│   │   │   ├── Errors/
│   │   │   └── Responses/
│   │   ├── WebSec.Infrastructure/
│   │   │   ├── Data/
│   │   │   │   ├── AppDbContext.cs
│   │   │   │   ├── Configurations/
│   │   │   │   ├── Migrations/
│   │   │   │   └── Seed/
│   │   │   ├── Interfaces/
│   │   │   ├── Services/
│   │   │   ├── Mapping/
│   │   │   ├── Security/
│   │   │   ├── Scanning/
│   │   │   │   ├── Abstractions/
│   │   │   │   ├── Queue/
│   │   │   │   ├── Crawler/
│   │   │   │   ├── Detectors/
│   │   │   │   └── Engine/
│   │   │   ├── AI/
│   │   │   └── Audit/
│   │   ├── WebSec.Api/
│   │   │   ├── Controllers/
│   │   │   ├── Middleware/
│   │   │   ├── Filters/
│   │   │   ├── Extensions/
│   │   │   ├── Program.cs
│   │   │   └── appsettings.json
│   │   └── WebSec.Worker/
│   │       ├── HostedServices/
│   │       ├── Extensions/
│   │       └── Program.cs
│   └── tests/
│       ├── WebSec.UnitTests/
│       └── WebSec.IntegrationTests/
├── frontend/
│   ├── package.json
│   ├── angular.json
│   ├── tailwind.config.* (only if required by the installed Tailwind v4 setup)
│   └── src/
│       ├── app/
│       │   ├── core/
│       │   │   ├── auth/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── services/
│       │   │   └── layout/
│       │   ├── shared/
│       │   │   ├── components/
│       │   │   ├── models/
│       │   │   ├── pipes/
│       │   │   └── utils/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── projects/
│       │   │   ├── targets/
│       │   │   ├── scans/
│       │   │   ├── vulnerabilities/
│       │   │   ├── reports/
│       │   │   ├── users/
│       │   │   ├── roles/
│       │   │   └── ai-assistant/
│       │   ├── app.config.ts
│       │   └── app.routes.ts
│       ├── assets/i18n/
│       │   ├── vi.json
│       │   └── en.json
│       └── styles.css
└── .github/workflows/ (optional but recommended)
    └── build.yml
```

Agent may adjust names to match existing repository, but must document all deviations in `docs/ARCHITECTURE.md`.

---

## 6. Backend conventions and common infrastructure

### 6.1. Base entities

Create these shared generic base types, adapting generics to the actual codebase:

- `BaseEntity<TId>`: `Id` only.
- `DeleteEntity<TId> : BaseEntity<TId>`: `IsDeleted`, `Deletable`, `IsActive`.
- `AuditEntity<TId> : DeleteEntity<TId>`: `CreatedDate`, `CreatedBy`, `UpdatedDate`, `UpdatedBy`.
- `TempEntity<TId> : AuditEntity<TId>`: master-data fields `Code`, `NameL`, `NameE`.

Use `Guid` for most transactional entities. Use UTC timestamps (`DateTimeOffset` recommended for new code) consistently. Do not add all audit/soft-delete fields to immutable log/history records without considering the purpose of those records.

Soft delete behavior:
- Business entities marked `Deletable` may be soft-deleted.
- Query filters should exclude `IsDeleted = true` by default, while providing an explicit administrative path where needed.
- Do not physically delete entities using `DbContext.Remove()` in normal CRUD flows.
- Ensure audit fields are set centrally or consistently in `SaveChanges` interception/service logic.

### 6.2. Response models

Create a consistent wrapper:

```csharp
public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public string? Code { get; init; }
    public string? TraceId { get; init; }
}
```

And paginated response:

```csharp
public sealed class PagingInfo
{
    public int Page { get; init; }
    public int PageSize { get; init; }
    public long TotalItems { get; init; }
    public int TotalPages { get; init; }
}

public sealed class PaginatedResponse<T> : ApiResponse<T>
{
    public PagingInfo? Paging { get; init; }
}
```

Keep the shared base response inheritable so `PaginatedResponse<T>` can extend it; the actual implementation must compile. Keep success/error response shapes consistent and document them in `API_CONTRACT.md`.

### 6.3. Search parameters

`BaseSearchParam` should support:
- `Page` (1-based, default 1).
- `PageSize` (default 10, max 100).
- `Keyword` optional.
- `SortBy` optional, allowlisted by service rather than interpolated into SQL.
- `SortDirection` (`asc`/`desc`) with validation.
- `IsActive` optional where applicable.

Feature params extend this class. Reject invalid paging values or normalize them consistently; document the choice.

### 6.4. Error handling

- Central exception middleware.
- Stable error codes such as `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `SCAN_SCOPE_REJECTED`, `AI_PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`.
- Return safe messages to clients; keep stack traces and secrets out of production responses.
- Include correlation/trace ID in response/logging.
- Use correct HTTP status codes even when the response body uses a common wrapper.

### 6.5. Validation and mapping

- Validate request DTOs at the API boundary.
- Do not bind EF entities directly from HTTP request bodies.
- Use Riok.Mapperly for mappings between entities and output/input models where it adds value.
- Keep mapping code generated at build time and ensure the generator actually runs. Do not claim Mapperly was used if mapping is still handwritten.
- Avoid returning navigation properties or internal fields through API DTOs.

### 6.6. Service and controller pattern

- Controller must be thin: validate/authorize, invoke service, map to response.
- Business rules belong in Infrastructure service classes.
- Use async/await for I/O; pass `CancellationToken` through API/service/database calls where appropriate.
- Do not use `.Result`, `.Wait()` or blocking I/O.
- Register dependencies in explicit extension methods, for example `AddInfrastructure(...)` and `AddApplicationServices(...)`.

---

## 7. Domain model and database foundation

Create schema/migrations for the initial entities below. You may implement only the first vertical-slice subset initially, but define the intended relationships in `docs/DATA_MODEL.md` and avoid conflicting table designs.

### 7.1. Identity and permissions

**Users**
- `Id`, `UserName`, `Email`, `PasswordHash`, `FullName`, `IsActive`, audit fields.
- Never store plaintext passwords.

**Roles**
- `Id`, `Code`, `Name`, `Description`, audit fields.

**Permissions**
- `Id`, `Code`, `Name`, `Module`, `Description`.

**UserRoles**
- `UserId`, `RoleId`.

**RolePermissions**
- `RoleId`, `PermissionId`.

**RefreshTokens** (if refresh-token authentication is implemented)
- `Id`, `UserId`, `TokenHash`, `ExpiresAt`, `RevokedAt`, `CreatedAt`, optional client metadata. Store the hash, not the raw refresh token.

### 7.2. Projects and targets

**Projects**
- `Id`, `Code`, `Name`, `Description`, `OwnerId`, `Status`, audit/soft-delete fields.

**ProjectMembers** (may be deferred)
- `ProjectId`, `UserId`, `ProjectRole`.

**Targets**
- `Id`, `ProjectId`, `Name`, `BaseUrl`, `Environment`, `ScopeMode`, `IsEnabled`, `LastScanAt`, audit/soft-delete fields.
- Store an explicit authorization/scope configuration. Do not treat every arbitrary URL entered into a form as automatically authorized to scan.

### 7.3. Scanning

**Scans**
- `Id`, `ProjectId`, `TargetId`, `RequestedBy`, `ScanType`, `Status`, `ProgressPercent`, `StartedAt`, `CompletedAt`, `ErrorCode`, `ErrorMessageSafe`, `TotalUrls`, `TotalRequests`, `TotalFindings`, `CreatedAt`.

**ScanJobs** (recommended persistent queue)
- `Id`, `ScanId`, `Status`, `AttemptCount`, `AvailableAt`, `LockedAt`, `LockedBy`, `LastErrorSafe`, `CreatedAt`.
- Use transactional creation of Scan + ScanJob so a scan record is not orphaned from its job.
- Worker should claim a job safely and avoid two workers processing the same job concurrently.

**ScanUrls**
- `Id`, `ScanId`, `Url`, `HttpMethod`, `StatusCode`, `ContentType`, `DiscoveredAt`, `IsInScope`.

**ScanFindings**
- `Id`, `ScanId`, `TargetId`, `FindingType`, `Title`, `Url`, `ParameterName`, `Severity`, `Confidence`, `EvidenceSummary`, `EvidenceRedacted`, `DetectorName`, `Fingerprint`, `DetectedAt`.

### 7.4. Vulnerability management

**Vulnerabilities**
- `Id`, `ProjectId`, `TargetId`, `Type`, `Title`, `Description`, `Severity`, optional `CvssScore`, optional `CvssVector`, `RiskScore`, `Status`, `AssignedTo`, `FirstDetectedAt`, `LastDetectedAt`, `ResolvedAt`, audit fields.

**VulnerabilityScanFindings** (join, if one vulnerability maps to multiple findings/scans)
- `VulnerabilityId`, `ScanFindingId`.

**VulnerabilityComments**
- `Id`, `VulnerabilityId`, `UserId`, `Content`, `CreatedAt`.

**VulnerabilityHistory**
- `Id`, `VulnerabilityId`, `ChangedBy`, `OldStatus`, `NewStatus`, `ChangeSummary`, `CreatedAt`.

### 7.5. Audit, reports and AI

**AuditLogs**
- `Id`, `UserId`, `Action`, `EntityType`, `EntityId`, `OldValueJson`, `NewValueJson`, `IpAddress` if available, `CreatedAt`.
- Do not log passwords, tokens, session secrets, or raw exploit payloads.

**Reports**
- `Id`, `ProjectId`, optional `ScanId`, `Title`, `Format`, `Status`, `StoragePath` or object key, `CreatedBy`, `CreatedAt`, `CompletedAt`.

**AiConversations**
- `Id`, `UserId`, optional `ProjectId`, optional `VulnerabilityId`, `Title`, `CreatedAt`, `UpdatedAt`.

**AiMessages**
- `Id`, `ConversationId`, `Role`, `Content`, `Provider`, `Model`, `CreatedAt`, `UsageMetadataJson` optional.
- Apply limits and redact secrets before sending context to an AI provider.

### 7.6. Relationships and indexes

- Project 1—N Targets.
- Target 1—N Scans.
- Scan 1—N ScanUrls, ScanFindings and ScanJobs (normally one job per scan attempt/queue record, as defined in implementation).
- Project/Target 1—N Vulnerabilities.
- Vulnerability N—N ScanFindings through `VulnerabilityScanFindings`, if deduplication is implemented.
- Vulnerability 1—N Comments and History.
- User N—N Role; Role N—N Permission.
- Add indexes for foreign keys, `Scans.Status`, `Scans.CreatedAt`, `Vulnerabilities.Status`, `Vulnerabilities.Severity`, `Vulnerabilities.ProjectId`, and target URL/fingerprint lookup as appropriate.
- Define cascade-delete rules deliberately. Avoid cascading deletion that erases audit history or findings unexpectedly.

---

## 8. Authentication and authorization

### 8.1. Requirements

- Passwords are hashed using a vetted ASP.NET password hasher; never implement custom cryptographic password hashing.
- Use a signed access token with short expiry and issuer/audience/signature validation if JWT is selected.
- Do not hardcode signing keys in source control.
- If refresh tokens are used, rotate and revoke them, storing only hashes. Prefer a secure HttpOnly cookie for refresh tokens and document the CSRF/origin strategy.
- Add role/policy authorization to endpoints; hiding a frontend button is not authorization.
- Apply project/target ownership or membership authorization before reading or modifying those records.
- Rate-limit login and sensitive AI endpoints in a simple, documented way.
- Add CORS policy restricted to configured frontend origins, not wildcard credentials.
- Return 401 for unauthenticated and 403 for authenticated but unauthorized requests.

### 8.2. Seed development user

- Seed roles: `Admin`, `SecurityAnalyst`, `Developer`, `Viewer`.
- Seed permissions as stable codes, e.g. `Project.View`, `Project.Create`, `Project.Update`, `Scan.Create`, `Scan.View`, `Vulnerability.View`, `Vulnerability.Update`, `Report.Generate`, `AI.Ask`, `User.Manage`, `Role.Manage`.
- Development account may be seeded only when `ASPNETCORE_ENVIRONMENT=Development` or an explicit development seed flag is enabled.
- Put development credentials in README as disposable local-only credentials, never reused for production. If credentials are generated randomly, print them once to startup log only in Development and never log the password hash/token.

---

## 9. Scan lifecycle, queue and scope safety

### 9.1. State machine

Allowed scan states:

```text
Pending -> Queued -> Running -> Completed
                         ├── Failed
                         └── Cancelled
Running -> Cancelling -> Cancelled (if graceful cancellation is supported)
```

Paused may be listed in the future roadmap, but do not expose a Pause button until the worker can truly pause/resume safely.

### 9.2. Scan request flow

1. API authenticates user and authorizes access to the project/target.
2. API checks that the target is enabled and explicitly in scope.
3. API creates a Scan record and ScanJob in one database transaction.
4. API returns the scan ID and initial status promptly.
5. Worker claims a queued job and updates status to Running.
6. Worker calls `IScanEngine` with a cancellation token and immutable, validated target scope.
7. Engine emits progress and findings; worker persists them in small, safe transactions.
8. Worker updates terminal state and totals.
9. Frontend polls `/api/scans/get-progress` initially. SignalR may be added later, not required for scaffold.

### 9.3. Scanner safety boundary

This is a defensive assessment platform. Implement strict safeguards:

- Only process targets explicitly stored and approved in the project.
- Do not accept a scan URL that differs from the configured target scope.
- Validate URL schemes and reject embedded credentials, malformed URLs and disallowed redirects.
- Prevent redirects from escaping the approved host/scope.
- Re-check resolved addresses and reject loopback/private/link-local destinations unless explicit development configuration authorizes a local lab target. Make this configuration opt-in and Development-only.
- Add conservative request timeout, maximum URL count, maximum depth, concurrency limit, request delay and maximum response size.
- Respect cancellation and shut down cleanly.
- Redact cookies, authorization headers, passwords, tokens and personal data from persisted evidence/logging.
- Never scan public websites by default; the default seed target is a placeholder and scanning is disabled until the user configures an authorized lab target.
- Do not implement automated exploitation, brute force, credential attacks or destructive checks.
- For this foundation, use a `MockScanEngine` and/or passive `SecurityHeadersDetector` only. Active SQLi/XSS testing is a later milestone subject to explicit authorization, test fixtures and rate limits.

### 9.4. Interfaces to create

Define clean contracts such as:

- `IScanEngine` — process one validated scan request and report progress/findings.
- `IScanJobQueue` or a database-backed job claim service.
- `ICrawler` — discover in-scope URLs.
- `IVulnerabilityDetector` — passive detector contract.
- `IScanProgressReporter` — persist/report progress.
- `ITargetScopeValidator` — central authorization/scope validation.

Names can vary; do not create meaningless empty abstractions. Provide a mock implementation that proves the contracts work end-to-end.

---

## 10. AI Advisor foundation

### 10.1. Required design

Create `IAiAdvisor` (or equivalent) in an appropriate abstraction layer, with service methods such as:

- `ExplainVulnerabilityAsync(...)`
- `SuggestRemediationAsync(...)`
- `PrioritizeFindingsAsync(...)` (advisory output only)
- `GenerateReportSummaryAsync(...)`
- `AskAboutVulnerabilityAsync(...)`

Not every method has to connect to a real provider in the first milestone. Implement a deterministic `MockAiAdvisor` for local development and tests. Place the real provider adapter behind configuration so it can be added later without changing Controllers or feature components.

### 10.2. AI security rules

- AI text is advisory; do not let it directly change severity/status or launch a scan.
- Use only authorized project/finding context from the database.
- Sanitize and bound context length. Redact credentials, cookies, tokens, personal data and unnecessary source data.
- Treat evidence and target content as untrusted input, not instructions to the AI system.
- Do not include API keys or secrets in prompts, logs or AI messages.
- Handle provider timeout, rate limit and errors with safe user messages.
- Mark generated text as AI-assisted and allow users to review it before including in a final report.
- If an AI feature is unavailable without a provider key, show a clear disabled/configuration state rather than a fake success.

### 10.3. AI endpoint foundation

Example route convention:

- `POST /api/ai/explain-vulnerability`
- `POST /api/ai/suggest-remediation`
- `POST /api/ai/ask`

Use typed request/response DTOs. Require authentication and permission `AI.Ask`; enforce rate limits and context access checks.

---

## 11. API contract for the first vertical slice

All request DTOs and outputs must be typed. Do not use `object`, `dynamic` or `any` as a blanket shortcut.

### 11.1. Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh` (only if refresh token is implemented)
- `POST /api/auth/logout`
- `POST /api/auth/me`

### 11.2. Projects

- `POST /api/projects/get-all` — `ProjectSearchParam` -> paginated project models.
- `POST /api/projects/get-by-id` — `{ id }` -> project model.
- `POST /api/projects/create` — `CreateProjectRequest` -> created model.
- `POST /api/projects/update` — `UpdateProjectRequest` -> updated model.
- `POST /api/projects/delete` — `{ id }` -> soft-delete result.

### 11.3. Targets

- `POST /api/targets/get-all` — paginated targets filtered by project.
- `POST /api/targets/get-by-id`
- `POST /api/targets/create`
- `POST /api/targets/update`
- `POST /api/targets/delete` — soft delete/disable; never delete scan history.

### 11.4. Scans

- `POST /api/scans/get-all`
- `POST /api/scans/get-by-id`
- `POST /api/scans/create` — validates scope; creates queue job.
- `POST /api/scans/get-progress` — returns status, percentage and safe counters.
- `POST /api/scans/cancel` — cooperative cancel if supported.
- `POST /api/scans/get-findings` — paginated finding list for a scan.

### 11.5. Vulnerabilities and AI scaffolding

- `POST /api/vulnerabilities/get-all`
- `POST /api/vulnerabilities/get-by-id`
- `POST /api/vulnerabilities/update-status`
- `POST /api/vulnerabilities/assign`
- `POST /api/vulnerabilities/add-comment`
- `POST /api/ai/explain-vulnerability`
- `POST /api/ai/suggest-remediation`

These may be implemented in later milestones; if a route is scaffolded, return an explicit not-implemented/configuration response rather than a successful fake payload.

### 11.6. API response examples

Success:

```json
{
  "success": true,
  "data": { "id": "...", "name": "Demo project" },
  "message": null,
  "code": null,
  "traceId": "..."
}
```

Paged success:

```json
{
  "success": true,
  "data": [],
  "paging": { "page": 1, "pageSize": 10, "totalItems": 0, "totalPages": 0 },
  "message": null,
  "code": null,
  "traceId": "..."
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "message": "The requested resource was not found.",
  "code": "NOT_FOUND",
  "traceId": "..."
}
```

Do not expose exception stack traces, SQL statements, connection strings or tokens to clients.

---

## 12. Frontend structure and UI conventions

### 12.1. Routes

- `/login`
- `/dashboard`
- `/projects`
- `/projects/new`
- `/projects/:id`
- `/targets` (filtered by selected project as appropriate)
- `/scans`
- `/scans/:id`
- `/vulnerabilities`
- `/vulnerabilities/:id`
- `/reports`
- `/users`
- `/roles`
- `/ai-assistant`

For the bootstrap, fully implement Login, Dashboard shell, Projects list/create/edit/detail, Targets list/create/edit, Scans list/detail/progress and a basic Findings/Vulnerability view. Other pages may be route placeholders with explicit “Coming later” text, not dead buttons pretending to work.

### 12.2. Frontend layering

- `core`: auth session, route guards, HTTP interceptors, app shell/layout, global API/error handling.
- `shared`: reusable button, modal, input field, select, textarea, data table, pagination, loading state, empty state, error state, status badge and severity badge.
- `features`: feature-local routes, pages, forms, models and API services.
- Each API service calls the backend; components must not directly construct URLs or own HTTP logic.
- Use Reactive Forms for add/edit/search forms.
- Use `formSearch`, `formAddEdit`, `items`, `paging`, `modalState` conventions where it fits the page design.
- A shared modal helper may support `add | edit | view`; read-only view must disable the form.
- Handle loading, empty, error and success states on every data-driven screen.
- Avoid giant components. Prefer container/page component + small presentation components where useful.

### 12.3. UI design direction

Enterprise security dashboard, clean and calm; light mode by default. Use neutral background, white surfaces, readable typography and a restrained teal/blue accent. Severity colors must be consistent (Info, Low, Medium, High, Critical) and accompanied by text/icon, not color alone. Use responsive layout and accessible labels/focus states.

Define design tokens in the global Tailwind v4 entry stylesheet. Do not scatter raw hex values through components. Reusable components must use the tokens.

### 12.4. i18n

- All user-visible labels, buttons, toast messages, navigation labels, validation messages and empty states must be translated through Transloco keys.
- Provide `vi.json` and `en.json` with equivalent keys for screens that exist.
- Do not place an untranslated hardcoded English string in a shared component.
- Master data may carry `NameL`/`NameE`; use a dedicated localized-name pipe/helper where applicable.

### 12.5. API client convention

Create a `BaseService` or a small equivalent abstraction for configured API base URL and standard error handling. Feature services use typed return types, e.g. `Observable<ApiResponse<ProjectModel>>` or `Observable<PaginatedResponse<ProjectModel[]>>`. Use PascalCase API method names only if consistently required by the reference style; otherwise follow Angular conventions consistently. Do not use `any` for request/response models except at a narrow third-party boundary.

### 12.6. Dashboard

The first version can display actual counts from the database and empty states. Do not hardcode fake totals like “128 scans” as if real. If demo seed values are shown, label them as sample data. Suggested cards: Projects, Targets, Scans, Open Vulnerabilities. Add recent scans and severity distribution after real data aggregation exists.

---

## 13. Configuration, observability and deployment

### 13.1. Configuration

Create `.env.example` with keys similar to:

```env
POSTGRES_DB=websec_dev
POSTGRES_USER=websec_dev
POSTGRES_PASSWORD=change_me_local_only
DATABASE_URL=Host=postgres;Port=5432;Database=websec_dev;Username=websec_dev;Password=change_me_local_only
JWT_ISSUER=WebSecPlatform
JWT_AUDIENCE=WebSecPlatformClient
JWT_SIGNING_KEY=replace_with_a_long_random_development_key
FRONTEND_ORIGIN=http://localhost:4200
AI_PROVIDER=mock
AI_API_KEY=
ALLOW_PRIVATE_TARGETS=false
```

Adapt naming to configuration binding. `.env.example` must contain placeholders, not production secrets. Docker Compose must not silently expose PostgreSQL to all network interfaces unless needed for local development.

### 13.2. Logging

- Structured logs with timestamp, level, trace/correlation ID and safe entity identifiers.
- Never log Authorization headers, raw tokens, password inputs, refresh tokens or secrets.
- Scan logs should include scan ID, state transition, elapsed time and counters, not raw sensitive request/response content.

### 13.3. Health and readiness

- API liveness endpoint (for example `/health/live`).
- API readiness endpoint checking database connectivity (for example `/health/ready`).
- Worker startup logs and graceful shutdown.
- Docker health checks and dependency ordering where supported.

### 13.4. Docker Compose

Minimum services:
- `postgres` — named volume and health check.
- `api` — depends on healthy database.
- `worker` — shares configuration/database and runs background jobs.
- `frontend` — Angular dev server in development, or a documented build/serve setup.

Provide a simple development workflow. Do not claim the containerized stack works until `docker compose config` and a startup smoke test succeed in the available environment.

---

## 14. Testing requirements

### 14.1. Backend unit tests

At minimum test:
- Search parameter normalization / max page size.
- Project create/update validation.
- Soft delete behavior.
- Permission policy mapping.
- Scan state transition validation.
- Target scope validator rejects targets outside authorized scope.
- Worker marks scan Completed/Failed consistently.
- AI mock returns a typed response and does not modify vulnerability status.

### 14.2. Backend integration tests

Where practical, test:
- Health endpoint.
- Login success/failure.
- Authenticated/unauthenticated access.
- Project create/list/update/delete flow.
- Scan create -> queued -> worker processing -> completed -> findings available.

Use a disposable test database or a test-friendly provider. If provider behavior differs from PostgreSQL, document it and run a migration smoke test against PostgreSQL as well.

### 14.3. Frontend tests and build

- `ng build` succeeds.
- Add focused tests for auth guard/interceptor and one representative feature service/component if test harness is available.
- Check navigation after login/logout.
- Verify forms show validation, loading, error and empty states.
- Avoid snapshot tests that only duplicate the entire DOM without useful assertions.

### 14.4. Manual acceptance walkthrough

1. Start the app using README instructions.
2. Login using development-only credentials.
3. Open dashboard.
4. Create a project.
5. Add an explicitly authorized local/lab target.
6. Create a scan.
7. See it move through Queued -> Running -> Completed (mock/passive engine).
8. Open scan details and view findings.
9. Confirm an out-of-scope target is rejected before a job is queued.
10. Call the AI mock feature and see the response marked as AI-assisted/advisory.

---

## 15. Milestones – implementation order

### Milestone 0 – Repository discovery and planning

- Inspect existing files and tools.
- Confirm SDK and package versions.
- Write a short execution plan in `docs/ROADMAP.md`.
- Decide .NET target per section 3.2; document the decision.

**Acceptance:** no existing work overwritten; repo state and plan documented.

### Milestone 1 – Monorepo and infrastructure skeleton

- Create solution/projects and Angular app.
- Add `.editorconfig`, `AGENTS.md`, README skeleton and docs.
- Add Docker Compose/PostgreSQL config and health checks.
- Ensure API and frontend can run with a simple health/home screen.

**Acceptance:** backend builds; frontend builds; configuration has no committed secrets.

### Milestone 2 – Shared backend conventions and database

- Base entities, enums, response wrappers, errors, params.
- `AppDbContext` and EF configurations.
- Initial migrations, dev seed, audit timestamp rules.
- Mapperly setup and one verified mapper.

**Acceptance:** migration applies to PostgreSQL and basic DB smoke test passes.

### Milestone 3 – Auth and RBAC foundation

- Login and current-user endpoint.
- Password hashing, token configuration and policy/role authorization.
- Seed roles/permissions/user only in development.
- Angular login page, auth session, guard and interceptor.

**Acceptance:** valid login succeeds, invalid login fails, protected API returns 401 without credentials, unauthorized role returns 403.

### Milestone 4 – Project/Target vertical slice

- Project/Target DTOs, Params, services, controllers and mapping.
- Pagination, search, validation and soft delete.
- Angular projects and targets list/form/detail flow.

**Acceptance:** create/list/update/soft-delete works from UI through API to PostgreSQL.

### Milestone 5 – Scan queue and safe worker vertical slice

- Scan and ScanJob entities/services.
- Persistent job claim or a documented single-process queue strategy.
- Mock/passive `IScanEngine` with progress updates and deterministic sample findings.
- Angular scan list, start scan, progress and findings.
- Scope validation and cancellation support if implemented.

**Acceptance:** scan executes asynchronously; API request returns quickly; job state and findings persist; out-of-scope target is rejected.

### Milestone 6 – Vulnerability and AI abstractions

- Vulnerability/finding mapping foundation and status enums.
- AI abstraction and deterministic mock adapter.
- Basic detail view and “Explain”/“Suggest remediation” UI state.
- No real provider key required to run local development.

**Acceptance:** AI mock can explain a known test finding and output is clearly advisory; it cannot alter status/severity.

### Milestone 7 – QA, docs and handoff

- Run builds/tests/migration smoke test.
- Fix all known blockers or document them precisely.
- Complete README commands and configuration docs.
- Confirm code does not contain secrets and no scanner can run against arbitrary URLs.

**Acceptance:** checklist in section 16 is reported item by item.

Do not skip ahead to build all advanced modules before Milestones 1–5 are stable.

---

## 16. Definition of Done / handoff checklist

The work is considered complete only when the agent provides:

- [ ] Repository tree and explanation of each project.
- [ ] Working solution/project files; no pseudocode in the core vertical slice.
- [ ] Backend build command and actual result.
- [ ] Frontend install/build commands and actual result.
- [ ] Unit/integration test command and actual result.
- [ ] EF migration command and database initialization instructions.
- [ ] Docker Compose instructions and validation results, if Docker is available.
- [ ] Development-only login information or documented seed procedure.
- [ ] `docs/ARCHITECTURE.md`.
- [ ] `docs/API_CONTRACT.md`.
- [ ] `docs/DATA_MODEL.md`.
- [ ] `docs/DEVELOPMENT.md`.
- [ ] `docs/SECURITY_BOUNDARIES.md`.
- [ ] `docs/ROADMAP.md` with completed/pending work.
- [ ] A clear list of implemented, mocked, scaffolded and not-yet-implemented features.
- [ ] A list of important decisions/deviations from this specification.
- [ ] No exposed secrets, no plaintext password storage, no arbitrary target scanning.

Do not report “complete” if the code does not compile or an acceptance criterion has not been tested. State blockers honestly.

---

## 17. Required documentation files

### `AGENTS.md`

Include repository commands, architecture boundaries, naming conventions, test-before-done rule, no-secrets rule, scanner scope restrictions, and instructions to make small changes without overwriting user data.

### `docs/ARCHITECTURE.md`

Include architecture diagram, layer/project responsibilities, dependency directions, DI approach, worker flow and rationale for decisions.

### `docs/API_CONTRACT.md`

List implemented endpoints, HTTP method/path, request DTO, response DTO, permission requirement, status codes and sample payload. Clearly separate implemented endpoints from planned endpoints.

### `docs/DATA_MODEL.md`

Include ERD in Mermaid or another text-based format, table descriptions, key relationships, indexes, delete behavior and migration instructions.

### `docs/DEVELOPMENT.md`

Document prerequisites, clone/setup, environment configuration, migration, seed, run API, run Worker, run Angular, Docker commands and common troubleshooting.

### `docs/SECURITY_BOUNDARIES.md`

Document authorized targets only, scope validation, rate limits, blocked target types, secrets handling, evidence redaction and AI data boundaries.

### `docs/ROADMAP.md`

List milestones, status (`Done`, `In progress`, `Planned`), known limitations and next steps. Do not label a planned feature as done.

---

## 18. Prompt để giao cho AI Coding Agent

Copy toàn bộ nội dung trong khối dưới đây hoặc gửi file này kèm câu lệnh “hãy thực thi đặc tả”.

> Bạn là senior full-stack engineer phụ trách khởi tạo codebase cho đề tài “Xây dựng nền tảng quản lý và đánh giá lỗ hổng bảo mật ứng dụng Web tích hợp trí tuệ nhân tạo”. Hãy đọc toàn bộ tài liệu đặc tả này trước khi sửa file.
>
> **Nhiệm vụ:** dựng codebase thật trong workspace, có cấu trúc rõ ràng, build được và có một vertical slice end-to-end. Không chỉ trả lời bằng hướng dẫn hoặc code block. Trước tiên kiểm tra repository hiện có, giữ nguyên những gì đang hoạt động, sau đó thực hiện theo Milestone 0–7.
>
> **Kiến trúc:** monorepo Angular 21 + ASP.NET Core Web API + Shared + Infrastructure + Worker + PostgreSQL. Dùng Angular standalone, Reactive Forms, `inject()`, `@if/@for`, Tailwind CSS v4, Transloco; backend dùng EF Core, Npgsql, Mapperly, service layer, response wrapper, pagination/search params, soft delete và audit fields. Tuân thủ quyết định framework tại mục 3.2; vì đây là dự án mới ở thời điểm cuối năm 2026, chọn .NET 10 LTS mặc định, trừ khi repository/môn học bắt buộc .NET 8.
>
> **Vertical slice bắt buộc:** login/RBAC cơ bản, Project CRUD, Target CRUD, tạo scan record + job, Background Worker xử lý scan demo an toàn, progress, findings mẫu, giao diện scan detail và AI mock advisor. Không cần triển khai detector SQL Injection/XSS chủ động hoàn chỉnh ở giai đoạn đầu.
>
> **Bảo mật bắt buộc:** không hardcode secrets; không lưu plaintext password; seed tài khoản chỉ trong Development; validate project access/target scope trước khi queue scan; không scan URL tùy ý hoặc website Internet không được ủy quyền; không thực hiện exploit/brute force/destructive checks; redact token/cookie/password khỏi logs và evidence; AI chỉ đưa khuyến nghị và không tự thay đổi trạng thái vulnerability.
>
> **Cách làm:** chia thành các milestone nhỏ; sau mỗi milestone hãy chạy build/test liên quan, sửa lỗi rồi mới tiếp tục. Không thêm hàng loạt dependency nếu không cần; pin package bằng lockfile; ưu tiên API và code có kiểu dữ liệu rõ ràng; không dùng `any`/`dynamic` tràn lan; không bỏ business logic vào Controller hay Angular component. Các endpoint nghiệp vụ tuân theo POST convention của tài liệu tham chiếu, và mọi khác biệt phải được ghi trong `docs/API_CONTRACT.md`.
>
> **Tài liệu bàn giao:** tạo đầy đủ `AGENTS.md`, `README.md`, `.env.example`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/DEVELOPMENT.md`, `docs/SECURITY_BOUNDARIES.md`, `docs/ROADMAP.md`. Thêm migrations và tests cần thiết.
>
> **Nghiệm thu:** từ trạng thái sạch, hướng dẫn phải cho phép chạy backend, frontend và database; login được; tạo/list/update/soft-delete project/target được; tạo scan trả về nhanh; worker xử lý bất đồng bộ; xem được progress và findings; target ngoài scope bị từ chối; test/build có kết quả thật. Nếu một phần không thể chạy do giới hạn môi trường, nêu chính xác phần đó, đừng giả vờ thành công.
>
> Khi hoàn tất, hãy trả lời bằng báo cáo ngắn gồm: (1) những gì đã tạo, (2) cấu trúc repository, (3) lệnh để chạy, (4) lệnh build/test và kết quả thực tế, (5) tài khoản dev hoặc seed procedure, (6) tính năng đang dùng mock, (7) hạn chế/blocker, (8) bước tiếp theo được đề xuất. Không tự triển khai bước tiếp theo nếu vertical slice chưa build/test sạch.

---

## 19. Tài liệu tham chiếu công nghệ

- Angular version compatibility: https://angular.dev/reference/versions
- Microsoft .NET support policy: https://dotnet.microsoft.com/en-us/platform/support/policy
- PostgreSQL documentation: https://www.postgresql.org/docs/
- ASP.NET Core documentation: https://learn.microsoft.com/aspnet/core/
- EF Core documentation: https://learn.microsoft.com/ef/core/
- OWASP Top 10 project: https://owasp.org/www-project-top-ten/

Các liên kết trên là điểm bắt đầu để kiểm tra compatibility và hướng dẫn chính thức. Agent cần kiểm tra phiên bản thực tế của package trước khi thêm dependency; không chọn phiên bản chỉ dựa vào một ví dụ cũ.

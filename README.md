# WebSec AI – Web security assessment platform (DoAN3)

Nền tảng quản lý và đánh giá lỗ hổng bảo mật ứng dụng Web tích hợp AI. Giai đoạn hiện tại: codebase nền tảng với một vertical slice chạy được end-to-end:

**Login → Dashboard → Project → Target (đã xác nhận ủy quyền) → Scan (queue + worker, mock engine) → Findings → AI advisor (mock).**

- `backend/` – ASP.NET Core (.NET 8) API + Worker, EF Core + PostgreSQL
- `frontend/` – Angular 21, Tailwind v4, Transloco (vi/en)
- `design/` – thiết kế tham chiếu (HTML/PNG)
- `docs/` – kiến trúc, API, data model, dev guide, security boundaries, roadmap

## Chạy nhanh (local)

Yêu cầu: .NET SDK 8, Node 22, Docker.

```bash
# 1. Database
docker compose up -d postgres

# 2. API (tự chạy migration + seed tài khoản dev) – http://localhost:5080/swagger
dotnet run --project backend/src/WebSec.Api --launch-profile http

# 3. Worker (terminal khác)
dotnet run --project backend/src/WebSec.Worker

# 4. Frontend (terminal khác) – http://localhost:4200
cd frontend && npm ci && npx ng serve
```

Hoặc chạy toàn bộ bằng Docker: `docker compose up --build` rồi mở http://localhost:4200.

## Tài khoản phát triển (CHỈ dùng local)

Được seed tự động khi `ASPNETCORE_ENVIRONMENT=Development` (hoặc `SEED_DEV_DATA=true`). Không dùng lại ở bất kỳ môi trường nào khác.

| User | Password | Role |
|---|---|---|
| `admin` | `Admin@12345` | Admin |
| `analyst` | `Analyst@12345` | SecurityAnalyst |
| `developer` | `Developer@12345` | Developer (chỉ xem, không tạo scan) |
| `viewer` | `Viewer@12345` | Viewer (chỉ xem) |

## Thử luồng chính

1. Đăng nhập `analyst`.
2. Projects → **Tạo project**.
3. Mở project → **Thêm target**, ví dụ `http://localhost:3000`, tick **"Tôi sở hữu hoặc được ủy quyền…"**.
4. Bấm **Quét** → trang scan tự cập nhật Queued → Running → Completed, hiện 3 finding mẫu.
5. Bấm **AI giải thích** / **AI gợi ý khắc phục** → phản hồi mock, gắn nhãn AI-assisted.
6. Target chưa tick ủy quyền → bấm Quét bị từ chối (`SCAN_SCOPE_REJECTED`), không có job nào được tạo.

Mock engine **không gửi request mạng nào**; findings là dữ liệu mẫu.

## Build & test

```bash
dotnet build backend/WebSecPlatform.sln
dotnet test backend/WebSecPlatform.sln
cd frontend && npx ng build && npx ng test --watch=false
```

Chi tiết: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · Quy tắc cho coding agent: [AGENTS.md](AGENTS.md)

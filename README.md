# 🎓 AcaSchedule — Personal Academic Hub & AI Advisor

Nền tảng quản trị học tập cho sinh viên và quản trị viên: tính CPA chính xác theo quy tắc học lại/cải thiện, lộ trình học theo chương trình đào tạo (kéo thả theo học kỳ), giả lập đăng ký lớp học phần, học phí theo kỳ, kho tài liệu cộng đồng và cố vấn AI cá nhân hóa.

> **Trạng thái dữ liệu:** Hệ thống bắt đầu từ trạng thái sạch — chỉ có **một tài khoản admin** được tạo lúc seed. Học kỳ, khoa/ngành, môn học, sinh viên, học phí… do admin cấu hình qua giao diện.

## Chức năng chính

- **Tổng quan (sinh viên):** GPA/CPA, tín chỉ, biểu đồ xu hướng GPA, học phí theo học kỳ.
- **Bảng điểm & CPA:** chi tiết từng học kỳ; tự động nhận diện **Lần 1 / Học lại / Cải thiện**, trượt/đạt, điểm nào đang tính CPA; dự báo CPA.
- **Lộ trình học (tab riêng):** môn học xếp theo học kỳ của chương trình đào tạo do admin setup, lọc theo ngành của sinh viên; sinh viên có thể **kéo thả** môn sang học kỳ khác và lưu lại (mặc định theo CTĐT gốc nếu chưa sắp xếp).
- **Thời khóa biểu:** mô phỏng đăng ký, phát hiện trùng thứ/giao tiết, lịch cá nhân kéo-thả.
- **Học kỳ dùng chung:** admin cấu hình học kỳ 1 lần tại tab **Học kỳ**; mọi combo box (lịch học, học phí, môn học theo kỳ, đăng ký) đều lấy dữ liệu đồng bộ từ đây.
- **Học phí:** admin cấu hình mức thu/tín chỉ theo học kỳ (chung hoặc theo ngành); sinh viên xem tổng theo tín chỉ đã học.
- **Bộ môn quản lý:** mỗi môn học có bộ môn phụ trách, cấu hình ở tab **Ngành & khoa** (và show trên Chương trình đào tạo/Lộ trình học).
- **Admin – Môn học theo kỳ:** thêm môn vào học kỳ cho từng sinh viên (có hoặc không kèm điểm), sửa điểm, xóa lượt học — tự đồng bộ CPA.
- **Nhập & xuất CSV:** nhập/xuất hàng loạt **bảng điểm**, **chương trình đào tạo** và **cấu hình lịch học** từ trang Nhập & xuất — có nút "Kiểm tra trước (không ghi)". Xem [docs/data-import-export.md](docs/data-import-export.md).
- **Tài liệu:** upload qua presigned URL lên MinIO, vote, tìm kiếm.
- **Thông báo hệ thống:** admin gửi thông báo tới toàn bộ sinh viên; mỗi lần sinh viên đăng nhập sẽ hiện lớp thông báo (đóng bằng nút X), không hiện lại khi chuyển trang. Xem [docs/notifications.md](docs/notifications.md).
- **Email mật khẩu tạm thời:** gửi qua HTTP API (Brevo hoặc Resend — Render free chặn SMTP). Hướng dẫn cấu hình từng bước: [docs/mail-setup.md](docs/mail-setup.md).
- **AI:** tư vấn định hướng, tóm tắt tài liệu, Q&A — **không giới hạn lượt hỏi**, câu trả lời không bị cắt giữa câu (tự nối khi chạm giới hạn token).

## Chạy thử (local, Docker)

**Yêu cầu:** Docker Desktop (Engine ≥ 20.10, Compose ≥ v2), Git.

```shell
git clone <repo-url>
cd AcaSchedule
cp .env.example .env
# Đặt JWT_ACCESS_SECRET / JWT_REFRESH_SECRET ngẫu nhiên (khuyến nghị 32+ ký tự)
# Điền GEMINI_API_KEY để bật AI (để trống sẽ dùng gợi ý offline)
docker compose up --build -d
```

- Web: http://localhost
- API: http://localhost/api/health
- Swagger: http://localhost/api/docs
- MinIO console: http://localhost:9001

**Tài khoản duy nhất** (tạo tự động lúc seed):

| Role | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@acaschedule.local` | Giá trị của biến môi trường `SEED_ADMIN_PASSWORD` |

- **Local dev:** mật khẩu mặc định trong `.env.example` là `Admin@123`.
- **Render:** `SEED_ADMIN_PASSWORD` được tạo tự động (`generateValue`) trong `render.yaml` — lấy giá trị tại **Render Dashboard → Environment** để đăng nhập (khôngHard-code trong repo).

> ⚠️ Đổi mật khẩu admin và các secret khi deploy production (xem [Bảo mật](#bảo-mật)).

**Thứ tự cấu hình sau khi đăng nhập admin:** Học kỳ → Khoa/Ngành → Môn học & CTĐT (kèm bộ môn quản lý) → Học phí → Lịch học → thêm sinh viên & môn theo kỳ.

## Kiến trúc

```
Browser → Nginx (webserver) → /api/* → Backend (Node/Express)
                              → /ai-api/* → AI service (FastAPI/Gemini)
                              → / → Frontend (React/Vite, static)
Backend → PostgreSQL 16 (dữ liệu) · Redis 7 (cache/phiên) · MinIO (tệp)
```

| Tầng | Công nghệ |
| --- | --- |
| Frontend | React + TypeScript + Tailwind + Vite |
| Backend | Node.js/Express/TypeScript + Zod + Vitest |
| AI service | Python/FastAPI + Gemini REST (httpx) |
| Hạ tầng | Docker Compose (7 services), Nginx, Render Blueprint |

Chi tiết kiến trúc/API/CSDL: [`docs/`](docs/) — [SRS](docs/SRS_BUSINESS_ANALYSIS.md), [API](docs/API_SPECIFICATION.md), [CSDL](docs/DATABASE_DESIGN.md), [ADR](docs/adr/).

## Bảo mật

- Mật khẩu băm **bcrypt (12 rounds)**; JWT access (15 phút) + refresh rotation (7 ngày) lưu hash trong DB.
- **Production fail-fast:** backend từ chối khởi động nếu dùng secret mặc định (`dev-*`) hoặc mật khẩu admin mặc định.
- Helmet (CSP), CORS whitelist theo `CORS_ORIGIN`, JSON body giới hạn 1MB.
- Rate-limit: đăng nhập 10 lần/15 phút/IP (chống brute-force); upload tài liệu 60 lần/giờ. AI **không** giới hạn lượt hỏi.
- PII (email/sđt/họ tên/UUID) được redact trước khi gửi cho AI và khi ghi log.
- SQL dùng tham số hóa (parameterized queries); upload tệp qua presigned URL, kiểm tra MIME/kích thước (≤ 20MB), chặn tệp thực thi.
- File `.env` nằm trong `.gitignore` (không commit); chỉ commit `.env.example`.

## Kiểm thử

```shell
cd backend && npm test   # 100 tests (GPA engine, schedule engine, PII, contract, integration)
```

## Triển khai Render

Blueprint sẵn tại [`render.yaml`](render.yaml): frontend (static), backend (Node) + Postgres, AI (Python). Backend chạy `migrate:compiled && seed:compiled && npm start` khi khởi động.

## Cấu trúc repo

```
├── backend/        # Express API (+ migrations, seed tối thiểu: admin + tham chiếu)
├── frontend/       # React SPA
├── ai/             # FastAPI AI service
├── docker/         # Nginx + Dockerfiles
├── docs/           # SRS, API, CSDL, ADR
├── docker-compose.yml / docker-compose.override.yml
├── render.yaml     # Render Blueprint
└── Makefile
```

## Liên hệ

- Developer: Mai Quang Vũ — maiquangvu.work@gmail.com

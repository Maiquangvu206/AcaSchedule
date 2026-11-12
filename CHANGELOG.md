# Changelog - AcaSchedule

Tất cả các thay đổi đáng chú ý cho dự án AcaSchedule sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Auth — Quên mật khẩu 2 bước (xác nhận email):** migration `029_password_reset_codes.sql`, trang `/forgot-password`, `POST /api/auth/forgot-password` (gửi mã 6 số, TTL 15 phút, hash SHA-256, 1 mã hiệu lực/user) và `POST /api/auth/reset-password` (xác nhận mã + đặt mật khẩu mới, thu hồi toàn bộ phiên, giới hạn 5 lần sai/thu hồi mã). Không đổi mật khẩu ở bước 1 và không lộ sự tồn tại/trạng thái tài khoản.
- **Auth — Thông báo tài khoản bị khóa:** đăng nhập đúng mật khẩu nhưng `is_active=false` trả `403` với thông báo rõ; sai mật khẩu/không tồn tại vẫn trả `401` chung.
- **Mail:** ưu tiên gửi qua HTTP API (Brevo/Resend, cổng 443) rồi fallback SMTP; dùng chung cho mã xác nhận quên mật khẩu và mật khẩu tạm do admin.
- **Quản trị tài liệu cộng đồng:** migration `030_document_moderation.sql` thêm `subject_documents.is_hidden`, `is_locked`; admin `GET/PATCH/DELETE /api/admin/documents` (ẩn/khóa/xóa, xóa object storage best-effort). Sinh viên không thấy/không truy cập tài liệu ẩn; tài liệu bị khóa vẫn hiển thị nhưng không xem/tải/bình chọn.
- **Sprint 4: AI Advisor & RAG**
  - `POST /api/ai/advice` - tư vấn học tập từ dữ liệu điểm thật của sinh viên
  - `POST /api/ai/documents/summarize` - tóm tắt nội dung tài liệu
  - `POST /api/ai/qa` - trả lời câu hỏi dựa trên ngữ cảnh tài liệu
  - `GET /api/ai/status` - tình trạng dịch vụ AI
  - PII redaction (email, SĐT, UUID, họ tên) trước khi gửi mô hình AI
  - Cache câu trả lời theo hash (TTL 10 phút)
  - Fallback cục bộ khi dịch vụ AI không khả dụng

- **Sprint 3: Crowdsourced Document Hub**
  - `POST /api/documents/uploads/presign` - cấp URL presigned PUT lên object storage
  - `POST /api/documents` - lưu metadata tài liệu
  - `GET /api/documents` - danh sách tài liệu (filter, search, sort)
  - `POST /api/documents/:id/vote` - upvote/downvote (1 user 1 vote)
  - `GET /api/documents/:id/download` - presigned download URL
  - `GET /api/documents/subjects` - danh sách môn học có thể đóng góp
  - Migration `004_documents.sql`: bảng `subject_documents` mở rộng, bảng `document_votes`
  - Validation file: MIME, extension, kích thước, chặn executable

- **Sprint 2: Schedule Planner**
  - `POST /api/schedule/simulate` - mô phỏng đăng ký, phát hiện xung đột
  - `GET /api/schedule/periods` - cấu hình tiết → giờ
  - `GET /api/schedule/sections` - danh sách lớp học phần
  - `GET/POST/PATCH/DELETE /api/schedule/items` - CRUD lịch cá nhân
  - Migration `003_schedule.sql`: `period_slots`, `course_sections`, mở rộng `schedule_items`
  - Conflict Detection Engine (kể từ period 1, kề tiết không xung đột)
  - UI weekly calendar với drag-and-drop lịch cá nhân

- **Sprint 1: Academic Core: GPA/CPA**
  - `POST /api/gpa/calculate` - tính GPA/CPA
  - `POST /api/gpa/forecast` - dự báo CPA
  - `GET /api/student/transcript` - bảng điểm
  - CRUD `student_enrollments`
  - Quy tắc Học lại (F → Pass) và Học cải thiện
  - Admin CRUD `grade_scales`, `subjects`

- **Sprint 0: Nền tảng & hạ tầng**
  - Auth: JWT (access + refresh rotation), RBAC (student/admin)
  - Migration `001_init.sql`: users, grade_scales, subjects, student_enrollments, schedule_items, refresh_tokens
  - Health endpoints: `/api/health`, `/api/health/live`
  - Swagger/OpenAPI (`/api/docs`)
  - Chuẩn hóa lỗi + request logging + X-Request-Id
  - MinIO/R2-compatible bucket initialization, Redis client
  - Docker Compose 7 services

### Changed
- AI: không giới hạn lượt hỏi; tự nối câu trả lời khi chạm giới hạn token (không cắt giữa câu).
- Frontend: trang admin tài liệu có bộ lọc/căn chỉnh bảng; layout/footer căn đáy trang ngắn.
- Frontend: chuyển giao diện từ dark mode sang light mode
- Frontend: tách data layer thành hooks (`useGPA`, `useSchedule`, `useDocuments`, `useAI`, `useTranslation`)
- Frontend: thêm i18n (vi/en) với `LanguageToggle` component
- Frontend: thêm biểu đồ CPA xu hướng theo kỳ (CSS-only)
- Backend: thêm `MINIO_PUBLIC_ENDPOINT/PORT/USE_SSL` cho presigned URL
- Backend: thêm PII redaction lib (`backend/src/lib/pii.ts`)
- Backend: thêm rate limiting (`backend/src/lib/rate-limit.ts`)

### Fixed
- **Object storage:** sửa lỗi xác nhận upload tài liệu trả 503 `Object storage is unavailable` — ghi log lỗi gốc và `statObject` fallback thử public client khi cần; cải thiện chẩn đoán (presign 201, PUT 200 nhưng confirm 503).
- **Schedule/GPA range:** chuẩn hoá cột `date` (node-pg trả Date) tại ranh giới repository/range, tính tuần nghỉ/tuần theo thời gian học kỳ; sửa lỗi 500 mô phỏng đăng ký khi `value.split is not a function` và chuẩn hoá buổi học 1 lần/tuần.
- Frontend: sửa lỗi import `useState` trong Transcript.tsx
- Backend: sửa type errors trong `schedule.repository.ts`

### Deprecated
- Không có

### Removed
- Không có

### Security
- Quên mật khẩu: mã 6 số lưu hash, hiệu lực ngắn, giới hạn lần sai, dùng 1 lần, thu hồi phiên sau khi đổi mật khẩu; phản hồi không tiết lộ tài khoản.
- PII redaction trước khi gửi mô hình AI
- Rate limiting trên auth (login/register), document upload
- File upload validation (MIME, extension, kích thước, chặn executable) và xác minh object trên storage
- Presigned URL thay vì upload trực tiếp qua backend

## [0.1.0] - 2026-11-05

### Added
- Initial release: skeleton AcaSchedule
- Auth: đăng ký/đăng nhập JWT, refresh rotation
- GPA/CPA engine với quy tắc Học lại/Học cải thiện
- Transcript UI
- Docker Compose 7 services
- Swagger/OpenAPI docs

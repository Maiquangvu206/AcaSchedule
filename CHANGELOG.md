# Changelog - AcaSchedule

Tất cả các thay đổi đáng chú ý cho dự án AcaSchedule sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Sprint 4: AI Advisor & RAG**
  - `POST /api/ai/advice` - tư vấn học tập từ dữ liệu điểm thật của sinh viên
  - `POST /api/ai/documents/summarize` - tóm tắt nội dung tài liệu
  - `POST /api/ai/qa` - trả lời câu hỏi dựa trên ngữ cảnh tài liệu
  - `GET /api/ai/status` - tình trạng dịch vụ AI
  - PII redaction (email, SĐT, UUID, họ tên) trước khi gửi Gemini
  - Quota per-user (20 lần/giờ qua Redis)
  - Cache câu trả lời theo hash (TTL 10 phút)
  - Fallback cục bộ khi Gemini không khả dụng

- **Sprint 3: Crowdsourced Document Hub**
  - `POST /api/documents/uploads/presign` - cấp URL presigned PUT lên MinIO
  - `POST /api/documents` - lưu metadata tài liệu
  - `GET /api/documents` - danh sách tài liệu (filter, search, sort)
  - `POST /api/documents/:id/vote` - upvote/downvote (1 user 1 vote)
  - `GET /api/documents/:id/download` - presigned download URL
  - `GET /api/documents/subjects` - danh sách môn học có thể đóng góp
  - Migration `004_documents.sql`: bảng `subject_documents` mở rộng, bảng `document_votes`
  - Validation file: MIME, extension, kích thước (20 MB), chặn executable

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
  - MinIO bucket initialization, Redis client
  - Docker Compose 7 services

### Changed
- Frontend: chuyển giao diện từ dark mode sang light mode
- Frontend: tách data layer thành hooks (`useGPA`, `useSchedule`, `useDocuments`, `useAI`, `useTranslation`)
- Frontend: thêm i18n (vi/en) với `LanguageToggle` component
- Frontend: thêm biểu đồ CPA xu hướng theo kỳ (CSS-only)
- Backend: thêm `MINIO_PUBLIC_ENDPOINT/PORT/USE_SSL` cho presigned URL
- Backend: thêm PII redaction lib (`backend/src/lib/pii.ts`)
- Backend: thêm rate limiting (`backend/src/lib/rate-limit.ts`)

### Fixed
- Frontend: sửa lỗi import `useState` trong Transcript.tsx
- Backend: sửa type errors trong `schedule.repository.ts`

### Deprecated
- Không có

### Removed
- Không có

### Security
- PII redaction trước khi gửi Gemini
- Rate limiting trên auth (login/register), document upload, AI advice
- File upload validation (MIME, extension, kích thước, chặn executable)
- Presigned URL thay vì upload trực tiếp qua backend

## [0.1.0] - 2026-11-05

### Added
- Initial release: skeleton AcaSchedule
- Auth: đăng ký/đăng nhập JWT, refresh rotation
- GPA/CPA engine với quy tắc Học lại/Học cải thiện
- Transcript UI
- Docker Compose 7 services
- Swagger/OpenAPI docs

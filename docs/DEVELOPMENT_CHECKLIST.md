# Development Checklist — AcaSchedule

Checklist phát triển theo sprint, ưu tiên và tiêu chí hoàn thành. Đánh dấu `[x]` khi đã merge
vào `main` và pass CI.

**Quy ước**

- `P0` — bắt buộc cho bản chạy được; `P1` — quan trọng; `P2` — nice-to-have.
- Mỗi task chỉ được tick khi: code đã review, có test (nếu là logic), CI xanh, docs cập nhật.
- Thứ tự sprint dưới đây là thứ tự phụ thuộc, không nhất thiết chạy song song.

---

## 0. Foundation — đã hoàn thành

- [x] Cấu trúc monorepo: `backend/`, `frontend/`, `ai/`, `docker/`, `docs/`
- [x] Backend Express + TypeScript, validate env bằng Zod, graceful shutdown
- [x] Health endpoints: `/api/health/live`, `/api/health`
- [x] Frontend React 18 + Vite + Tailwind, dashboard skeleton
- [x] AI service FastAPI: advice / summarize / QA + fallback khi chưa có Gemini key
- [x] Backend proxy `/api/ai/*` → AI service
- [x] Docker Compose 7 services + Nginx dev/prod config
- [x] CI: typecheck/build backend & frontend, smoke test AI, build 3 images
- [x] Tài liệu khung: SRS, API spec, Database design

---

## 1. Sprint 0 — Nền tảng & hạ tầng `P0`

- [x] Viết migration runner (`backend/src/database/migrate.ts`) + lệnh `npm run migrate`
- [x] Migration `001`: `users`, `grade_scales`, `subjects`, `student_enrollments`, `subject_documents`, `schedule_items`, `refresh_tokens`
- [x] Seed data: thang điểm Hệ 10 → chữ → Hệ 4, môn demo, admin + sinh viên demo
- [x] Auth: đăng ký/đăng nhập JWT (access + refresh rotation), middleware xác thực
- [x] RBAC: role `student` / `admin`, guard theo route
- [x] Chuẩn hoá response lỗi + request logging + `X-Request-Id`
- [x] Swagger/OpenAPI cho backend (`/api/docs`)
- [x] Khởi tạo bucket MinIO khi boot (idempotent, có retry)
- [x] Redis client + helper session/quota
- [x] `.env` validation cho mọi biến mới, cập nhật `.env.example`

**Exit criteria:** `make dev` lên đủ 7 service; đăng nhập được; migration + seed chạy tự động; Swagger truy cập được.

> Đã kiểm thử với PostgreSQL + Redis thật: migrate/seed idempotent, login, `/me`, refresh rotation,
> logout, RBAC 403, validation 400, Swagger 200, request-id echo.

---

## 2. Sprint 1 — Academic Core: GPA/CPA `P0`

- [x] Admin CRUD `grade_scales` (validate khoảng điểm không chồng lấn)
- [x] Admin CRUD `subjects` (mã môn unique, tín chỉ, khối kiến thức)
- [x] Student CRUD `student_enrollments` (điểm QT, điểm thi, học kỳ, lần học)
- [x] Quy đổi Hệ 10 → điểm chữ → Hệ 4 theo `grade_scales`
- [x] **BR-RETENTION — Học lại:** lượt F cũ `is_counted_in_cpa = false`, lượt đạt mới `true`
- [x] **BR-RETENTION — Học cải thiện:** chỉ giữ lượt có điểm Hệ 4 cao nhất
- [x] Tín chỉ tích lũy chỉ đếm 1 lần/môn
- [x] `POST /api/gpa/calculate` trả GPA kỳ, CPA tích lũy, tín chỉ tích lũy
- [x] `POST /api/gpa/forecast`: điểm cần đạt để chạm mục tiêu
- [x] `GET /api/student/transcript` + UI bảng điểm
- [x] Unit test: F → Pass, cải thiện, nhiều lượt, môn 0 tín chỉ, làm tròn
- [x] Property test: CPA luôn trong `[0, 4]`

**Exit criteria:** bộ test GPA cover 100% business rule; số liệu khớp file tính tay mẫu.

> Đã kiểm thử end-to-end với PostgreSQL + Redis thật (43 check): CRUD admin, RBAC, cô lập dữ liệu
> giữa sinh viên, quy đổi điểm, học lại/học cải thiện, calculate/forecast/transcript. `npm test`
> chạy 17 test cho engine, gồm property test 500 bộ dữ liệu ngẫu nhiên.

---

## 3. Sprint 2 — Schedule Planner `P1`

- [x] Model `course_sections` (môn, mã lớp, thứ, tiết bắt đầu/kết thúc, phòng)
- [x] API danh sách lớp học phần theo học kỳ
- [x] Conflict Detection Engine: trùng thứ + giao tiết
- [x] `POST /api/schedule/simulate`: nhận danh sách lớp, trả lịch + danh sách xung đột
- [x] CRUD `schedule_items` cá nhân
- [x] UI weekly calendar (drag-and-drop, hiển thị xung đột)
- [x] UI chọn lớp + mô phỏng trước khi đăng ký
- [x] Test: kề tiết (không xung đột), giao 1 tiết, cùng thứ khác ca, lớp đã huỷ
- [x] Cấu hình tiết → giờ (tránh hard-code)

**Exit criteria:** mô phỏng 20 lớp không trùng trả lịch hợp lệ; mọi case biên có test.

> Đã kiểm thử engine bằng 12 unit test và E2E với PostgreSQL + Redis thật (31 check): danh sách lớp,
> cấu hình tiết, kề tiết/giao 1 tiết/khác ca, lớp đã huỷ, sai học kỳ, CRUD lịch cá nhân và cô lập dữ
> liệu giữa sinh viên; có test riêng cho 20 lớp không trùng. UI đã được kiểm thử thủ công: chọn lớp,
> hiển thị xung đột, thêm/kéo-thả/xoá lịch cá nhân.

---

## 4. Sprint 3 — Crowdsourced Document Hub `P1`

- [x] Presigned upload URL tới MinIO (stream, không qua backend)
- [x] Kiểm tra quyền upload: môn phải có trong `student_enrollments`
- [x] Validate file: MIME, dung lượng, extension; chặn executable
- [x] Lưu metadata `subject_documents` + object key
- [x] `GET /api/documents?subjectId=&q=&sort=` (ranking + tìm kiếm)
- [x] Upvote/downvote: 1 user 1 vote, đổi vote hợp lệ
- [x] Công thức ranking + tie-break theo thời gian
- [x] Presigned download URL + kiểm tra quyền
- [x] UI kho tài liệu: filter môn, sort, vote, upload
- [x] UI document viewer (PDF)
- [x] Test: upload môn không đăng ký bị chặn, vote trùng, file quá lớn

**Exit criteria:** upload/download end-to-end qua MinIO; không lộ bucket public.

> Đã kiểm thử bằng 23 check E2E với PostgreSQL + Redis thật + MinIO mock (moto S3): đăng nhập, danh sách môn đã đăng ký, presigned PUT URL, tải trực tiếp lên MinIO, xác minh kích thước/MIME, lưu metadata, danh sách tài liệu, upvote/dowvote/hủy vote, URL tải xuống (inline), cô lập dữ liệu giữa sinh viên (sinh viên khác không bị bỏ phiếu/tải tài liệu môn chưa đăng ký). Unit test validateUploadMetadata (MIME, kích thước, extension bị chặn, file quá lớn) và ranking (điểm, upvotes, thời gian).

> **Tiến độ (chưa merge, chưa tick):** code đã có trong working copy, chưa commit.
> - Đã code + unit test (`backend/tests/document.engine.test.ts`, `backend/tests/document.service.test.ts`, 47/47 pass): presign upload + kiểm tra enrollment, validate MIME/extension/size/executable, xác minh object trên MinIO sau upload, lưu metadata, vote (upsert/đổi/bỏ, 404 khi không có quyền), ranking + tie-break, presigned download + kiểm tra quyền.
> - Đã code, chưa có test: `GET /api/documents` (filter/search/sort) ở tầng SQL, UI kho tài liệu + viewer PDF (`frontend/src/pages/Documents.tsx`, build pass).
> - Chưa kiểm chứng: end-to-end qua PostgreSQL + MinIO thật (môi trường hiện chưa chạy Docker/DB), migration `004_documents.sql` trên DB thật, không lộ bucket public.
> - Sẽ tick các ô trên sau khi commit, CI xanh và chạy e2e thành công.

---

## 5. Sprint 4 — AI Advisor & RAG `P1`

- [ ] Prompt templates + guardrails (không bịa, trả lời tiếng Việt, nêu nguồn)
- [ ] `POST /api/ai/advice` lấy dữ liệu điểm thật từ DB thay vì client gửi lên
- [ ] Pipeline trích xuất text PDF/DOCX từ MinIO (`pypdf`, `python-docx`)
- [ ] Chunking + embeddings + lưu vector (pgvector hoặc Qdrant)
- [ ] Retrieval cải tiến: hybrid keyword + vector, `top_k` cấu hình được
- [ ] Trả `sources` kèm trích đoạn + link tài liệu
- [ ] Cache câu trả lời theo hash (Redis), quota theo user
- [ ] Streaming response (SSE) cho chat
- [ ] Bộ eval: 20–30 câu hỏi mẫu + đáp án kỳ vọng, đo retrieval hit rate
- [ ] Redact PII trước khi gửi Gemini; log không chứa nội dung nhạy cảm
- [ ] Test fallback: thiếu key, Gemini timeout, 429, response rỗng

**Exit criteria:** eval hit rate ≥ 80%; mọi lỗi Gemini đều có fallback, không 500.

---

## 6. Frontend `P1`

- [x] React Router + layout (sidebar/header), route guard theo role
- [ ] Trang đăng nhập/đăng ký + lưu/refresh token an toàn
- [ ] Dashboard GPA: thẻ CPA, biểu đồ xu hướng theo kỳ
- [x] Bảng điểm + chi tiết môn (các lượt học, cờ CPA)
- [x] Weekly calendar + mô phỏng đăng ký
- [ ] Document Hub + Document Viewer
- [ ] AI chat panel (streaming, citations)
- [ ] Loading / empty / error states cho mọi màn hình
- [ ] Responsive mobile; accessibility (label, focus, contrast)
- [ ] Tách data layer (`hooks/` + typed API client), bỏ fetch rải rác
- [ ] i18n vi/en (tối thiểu chuỗi UI)

**Exit criteria:** luồng chính dùng được trên mobile; không còn màn hình trắng khi API lỗi.

---

## 7. Quality & Testing `P0`

- [ ] Backend: unit test (Vitest) + integration (Supertest) cho mọi module
- [ ] AI: pytest cho rag/gemini/router, mock HTTP
- [ ] Frontend: Vitest + Testing Library cho hooks/component chính
- [ ] E2E Playwright: đăng nhập → nhập điểm → xem CPA → upload → hỏi AI
- [ ] Coverage gate backend ≥ 80%, AI ≥ 70%
- [ ] ESLint + Prettier (TS), Ruff + Black (Python)
- [ ] Pre-commit hook (lint-staged) + Conventional Commits
- [ ] Load test k6 cho endpoint tính CPA và upload
- [ ] Contract test backend ↔ AI service (schema request/response)
- [ ] Test data builder/factory dùng chung

---

## 8. Security `P0`

- [ ] Validate toàn bộ input bằng Zod/Pydantic, không tin client
- [ ] Rate limiting (login, upload, AI) + chống brute force
- [ ] Upload security: giới hạn size, MIME sniffing, tên file an toàn
- [ ] Secrets chỉ qua env/secret manager, không commit
- [ ] CORS whitelist theo môi trường
- [ ] Parameterized query/ORM, không nối chuỗi SQL
- [ ] Authorization test: student A không đọc/sửa dữ liệu student B
- [ ] `npm audit` / `pip-audit` trong CI, chặn high severity
- [ ] HTTPS + security headers ở Nginx (HSTS, CSP cơ bản)
- [ ] Backup & restore drill cho PostgreSQL và MinIO

---

## 9. DevOps & Release `P1`

- [ ] Migration tự động khi deploy (job một lần, có rollback)
- [ ] Môi trường staging riêng + seed dữ liệu demo
- [ ] Push image lên registry (GHCR) + tag theo commit SHA
- [ ] CD: deploy staging khi merge `main`, production khi tag
- [ ] Healthcheck + restart policy cho mọi service
- [ ] Observability: structured logs, Prometheus metrics, tracing (OpenTelemetry)
- [ ] Alerting: 5xx rate, latency p95, container down
- [ ] Backup định kỳ + lưu offsite
- [ ] Runbook sự cố + quy trình rollback

---

## 10. Tài liệu & Portfolio `P2`

- [ ] API docs đầy đủ ví dụ request/response
- [ ] Cập nhật ERD + sequence diagram AI/RAG, upload flow
- [ ] Seed demo + screenshot cho từng màn hình
- [ ] README: badge CI, ảnh demo, quick demo 3 bước
- [ ] Video demo 2–3 phút
- [ ] CHANGELOG + versioning
- [ ] Ghi chú kiến trúc quyết định (ADR) cho các lựa chọn chính

---

## Milestones

| Mốc | Nội dung | Điều kiện thoát |
| --- | --- | --- |
| **M0 — Done** | Skeleton, health, AI service, Docker, CI | `make dev` chạy, CI xanh |
| **M1 — Done** | Auth + DB schema + GPA engine | Tính đúng CPA theo BR-RETENTION, có test |
| **M2** | Schedule + Document Hub | Hai luồng end-to-end qua UI |
| **M3** | AI Advisor với RAG thật | Eval hit rate ≥ 80%, có citations |
| **M4** | Hardening & release | Security checklist + E2E + staging |

---

## 10 việc nên làm tiếp theo

1. Migration runner + schema PostgreSQL (`001_init.sql`)
2. Auth JWT + RBAC + route guard
3. GPA engine + unit test BR-RETENTION
4. Seed grade scales + môn học demo
5. API `POST /api/gpa/calculate` + UI bảng điểm
6. Swagger + chuẩn lỗi/logging
7. Schedule conflict engine + test biên
8. Upload MinIO presigned + kiểm tra quyền theo enrollment
9. Nâng RAG lên pgvector + eval set
10. Playwright E2E cho luồng chính + coverage gate trong CI

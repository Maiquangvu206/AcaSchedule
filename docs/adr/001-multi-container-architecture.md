# ADR-001: Kiến trúc multi-container với Docker Compose

## Trạng thái

Accepted

## Ngữ cảnh

AcaSchedule cần hỗ trợ nhiều dịch vụ khác nhau: Backend (Node/Express), Frontend (React/Vite), AI Service (Python/FastAI), PostgreSQL, Redis, MinIO. Cần một cách triển khai đơn giản, dễ phát triển local và dễ deploy production.

## Quyết định

Sử dụng Docker Compose với 7 containers:
- webserver (Nginx): reverse proxy, static assets
- frontend (React): SPA
- backend (Node/Express): API
- ai (Python/FastAPI): AI Advisor & RAG
- db (PostgreSQL 16): relational data
- redis (Redis 7): session & quota cache
- minio (MinIO): object storage

Mạng nội bộ `data` cho các service nội bộ, mạng `edge` cho các service exposes ra ngoài.

## Quyết định thay thế

- **Không dùng Kubernetes**: quá phức tạp cho project showcase, Docker Compose đủ dùng.
- **Không dùng service mesh**: over-engineering cho quy mô hiện tại.

## Hệ quả

### Tích cực
- Dễ phát triển local (`docker compose up`)
- Mỗi service cách ly, dễ scale riêng
- Healthchecks tự động
- Network isolation (data network internal)

### Tiêu cực
- Overhead chạy nhiều container cùng lúc
- Cần Docker Desktop

## Xác nhận

Thành công khi `docker compose up` chạy được tất cả 7 services và health checks pass.

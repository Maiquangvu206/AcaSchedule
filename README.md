# 🎓 AcaSchedule - Personal Academic, Crowdsourced Hub & AI Advisor Platform

## 📌 1. Executive Summary

AcaSchedule là nền tảng quản trị học tập, chia sẻ tri thức cộng đồng và cố vấn AI cá nhân hóa dành cho sinh viên đại học. Hệ thống hợp nhất 4 phân hệ cốt lõi:

- **Tính toán GPA/CPA chính xác 100%**: Tự động xử lý các quy tắc nghiệp vụ phức tạp như Học lại (loại bỏ cờ CPA của lượt F cũ khi học đạt) và Học cải thiện (tự động giữ cờ CPA cho `max(Điểm cũ, Điểm mới)`).
- **AI Academic Advisor (RAG Engine)**: Phân tích xu hướng điểm số, dự báo điểm thi cần đạt, đề xuất lộ trình đăng ký môn học và hỗ trợ Q&A/Tóm tắt thông minh trên file tài liệu bài giảng.
- **Crowdsourced Document Hub**: Kho lưu trữ tài liệu học tập cộng đồng (Đề thi các năm, Slide, Bài tập lớn mẫu) phân loại theo môn học với cơ chế Upvote/Downvote và bảo mật phân quyền tải lên.
- **Registration Simulator & Schedule Planner**: Giả lập xếp lịch học không trùng ca (Conflict Detection Engine) kết hợp quản lý lịch trình cá nhân theo ngày và tuần.

## 🏗 2. System Architecture & AI Pipeline

Hệ thống được thiết kế theo kiến trúc **Multi-container Microservices-ready**, tích hợp AI RAG Pipeline và Object Storage cách ly trong mạng nội bộ:

```
                              ┌───────────────────────────┐
                              │    Users / Web Browser    │
                              └─────────────┬─────────────┘
                                            │ HTTP/HTTPS (Port 80/443)
                                            ▼
                              ┌───────────────────────────┐
                              │    Nginx Reverse Proxy    │
                              │   (Container: webserver)  │
                              └──────┬─────────────┬──────┘
                                     │             │
              /api/* (Internal Port 8000)          │ Static Assets (Internal Port 80)
                                     │             │
                                     ▼             ▼
                          ┌────────────────┐ ┌────────────────┐
                          │  Backend API   │ │  Frontend App  │
                          │ (Node/Express) │ │ (React/TS SPA) │
                          └───────┬────────┘ └────────────────┘
                                  │
             ┌────────────────────┼────────────────────┬────────────────────┐
             │                    │                    │                    │
             ▼                    ▼                    ▼                    ▼
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
   │ PostgreSQL DB 16   │ │ Redis 7 Cache      │ │ MinIO S3 Storage   │ │ AI Service Engine  │
   │ (Relational Data)  │ │ (Session/Quota)    │ │ (File Documents)   │ │ (Gemini RAG API)   │
   └────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘
```

## 📊 3. Entity-Relationship Diagram (ERD Schema)

Cơ sở dữ liệu được thiết kế chuẩn hóa trên **PostgreSQL**, hỗ trợ lưu vết lịch sử môn học và kho tài liệu cộng đồng:

```
  ┌───────────────────────────┐
  │       grade_scales        │  (Admin: Mốc quy đổi Hệ 10 -> Chữ -> Hệ 4)
  └───────────────────────────┘

  ┌───────────────────────────┐         1:N         ┌───────────────────────────┐
  │         subjects          │────────────────────►│    student_enrollments    │
  │  (Admin: Khung đào tạo)   │                     │ (Điểm QT & Thi, Cờ CPA)   │
  └─────────────┬─────────────┘                     └─────────────┬─────────────┘
                │                                                 │ 1
                │ 1:N                                             │
                ▼                                                 │ N
  ┌───────────────────────────┐                     ┌─────────────┴─────────────┐
  │     subject_documents     │                     │      schedule_items       │
  │  (Kho tài liệu cộng đồng) │                     │ (Lịch cố định & Cá nhân)  │
  └───────────────────────────┘                     └───────────────────────────┘
```

## 🛠 4. Tech Stack & Services Breakdown

| Tầng / Service | Công nghệ sử dụng | Chức năng cốt lõi |
| --- | --- | --- |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Vite | Atomic Component Design, Drag-and-Drop Weekly Calendar, Document Viewer. |
| **Backend API** | Node.js, Express, TypeScript, Zod | Clean Architecture, Grade Engines, Schedule Conflict Detector, File Upload Streaming. |
| **AI Advisor Engine** | Gemini API, LangChain / RAG Pipeline | Contextual Student Advice, Document Summarization, Intelligent QA System. |
| **Storage & Database** | PostgreSQL 16, Redis 7, MinIO (S3) | Persistent Relational Data, In-Memory Session Caching, Scalable Blob File Storage. |
| **DevOps & Infra** | Docker Compose, Nginx, GitHub Actions | Multi-stage Docker Builds, Isolated Subnets, Automated CI/CD Workflows. |

## ⚡ 5. Quick Start & Docker Deployment

Hệ thống bao gồm **5 containers** khởi chạy bằng Docker Compose.

### Yêu cầu môi trường

- Docker Desktop (Docker Engine ≥ 20.10 & Docker Compose ≥ v2.0)
- Git

### Các bước khởi chạy (One-Command Setup)

**1. Clone Repository:**

```shell
git clone https://github.com/your-username/acaschedule-platform.git
cd acaschedule-platform
```

**2. Cấu hình biến môi trường (Environment Variables):**

```shell
cp .env.example .env
```

> **Lưu ý:** Điền `GEMINI_API_KEY` trong file `.env` để kích hoạt AI Service.

**3. Khởi chạy toàn bộ hệ thống:**

- Môi trường Development (Hot-reload):

```shell
make dev
# Hoặc: docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build -d
```

- Môi trường Production:

```shell
make prod
# Hoặc: docker-compose up --build -d
```

**4. Truy cập các Services:**

- Web Application: http://localhost
- Backend API Health Check: http://localhost/api/health
- MinIO Object Storage Console: http://localhost:9001 (User: `minioadmin` / Pass: `minioadmin`)
- PostgreSQL (Dev mode): `localhost:5432`

## 📑 6. Technical Highlights & Business Logic

### 1. CPA & Retention Engine (BR-RETENTION)

- **Logic Học lại (F → Pass):** Giữ vết lịch sử lượt trượt F ở kỳ cũ nhưng tự động cập nhật `is_counted_in_cpa = false` cho lượt F và bật `is_counted_in_cpa = true` cho lượt đạt mới.
- **Logic Học cải thiện (Improvement):** So sánh tự động điểm số giữa các lượt học, chỉ giữ cờ `is_counted_in_cpa = true` cho lượt đạt điểm Point hệ 4 cao nhất. Tín chỉ tích lũy chỉ đếm **1 lần duy nhất**.

### 2. Crowdsourced Document Hub (BR-DOCS)

- **Ràng buộc đóng góp:** Sinh viên chỉ có quyền upload tài liệu cho các môn học mà mình đã/đang đăng ký trong dữ liệu `student_enrollments`.
- **Cơ chế Upvote/Downvote:** Tự động ưu tiên hiển thị các tài liệu hữu ích lên đầu bảng tin tìm kiếm.

### 3. AI Academic Advisor & Document RAG (BR-AI)

- **Phân tích bảng điểm:** Quét toàn bộ điểm thành phần theo từng khối kiến thức để đưa ra gợi ý mục tiêu điểm thi cần đạt.
- **File RAG System:** Trích xuất nội dung văn bản từ các tài liệu PDF/DOCX lưu trữ trên MinIO để tạo tóm tắt đề cương và trả lời thắc mắc ôn thi của sinh viên.

## 📁 7. Repository Structure

```
acaschedule-platform/
├── .github/workflows/            # CI/CD Automated Pipelines
│   └── ci-cd.yml
├── docs/                         # Comprehensive Architecture Documents
│   ├── SRS_BUSINESS_ANALYSIS.md
│   ├── API_SPECIFICATION.md
│   └── DATABASE_DESIGN.md
├── docker/                       # Container Configuration Files
│   ├── nginx/
│   │   └── default.conf
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── backend/                      # Node.js/TypeScript Source Code
│   ├── src/
│   │   ├── modules/              # Admin, Student, GPA Engine, Schedule, Document, AI Advisor
│   │   ├── database/             # Migrations & Seed Data
│   │   └── main.ts
│   └── package.json
├── frontend/                     # React/TypeScript UI Source Code
│   ├── src/
│   │   ├── components/           # Atomic UI Components & Document Viewer
│   │   ├── hooks/                # Custom Hooks (useGPA, useConflict, useAI)
│   │   └── pages/                # App Routing
│   └── package.json
├── docker-compose.yml            # Production Orchestration (5 Services)
├── docker-compose.override.yml   # Local Dev Orchestration
├── Makefile                      # CLI Short-cut Commands
└── README.md
```

## 📬 Author & Contact

- **Developer:** Mai Quang Vũ (Full-Stack / Software Engineer)
- **Email:** maiquangvu.work@gmail.com
- **GitHub:** [@maiquangvu](https://github.com/maiquangvu)

> Showcase Project built with ❤ for Software Engineering Portfolio.

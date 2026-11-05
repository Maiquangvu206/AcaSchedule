# API Specification — AcaSchedule

Base URL: `/api` (qua Nginx) · Backend nội bộ: `http://backend:8000`

## Response conventions

- JSON, UTF-8.
- Lỗi: `{ "error": "ErrorCode", "message": "..." }`.
- Thời gian: ISO 8601 UTC.

## Health

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/health/live` | Liveness, không kiểm tra dependency. |
| GET | `/api/health` | Readiness, kiểm tra PostgreSQL; `503` nếu degraded. |

## Admin

| Method | Path | Trạng thái |
| --- | --- | --- |
| GET/POST | `/api/admin/grade-scales` | Planned |
| GET/POST | `/api/admin/subjects` | Planned |
| GET/PATCH | `/api/admin/users` | Planned |

## Student

| Method | Path | Trạng thái |
| --- | --- | --- |
| GET | `/api/student/enrollments` | Planned |
| GET | `/api/student/transcript` | Planned |

## GPA / CPA

| Method | Path | Trạng thái |
| --- | --- | --- |
| POST | `/api/gpa/calculate` | Planned |
| POST | `/api/gpa/forecast` | Planned |

## Schedule

| Method | Path | Trạng thái |
| --- | --- | --- |
| GET | `/api/schedule/items` | Planned |
| POST | `/api/schedule/simulate` | Planned |

## Documents

| Method | Path | Trạng thái |
| --- | --- | --- |
| GET | `/api/documents?subjectId=` | Planned |
| POST | `/api/documents` | Planned |
| POST | `/api/documents/:id/vote` | Planned |
| GET | `/api/documents/:id/download` | Planned |

## AI Advisor

| Method | Path | Trạng thái |
| --- | --- | --- |
| GET | `/api/ai/status` | Implemented (proxy tới AI service) |
| POST | `/api/ai/advice` | Implemented |
| POST | `/api/ai/documents/summarize` | Implemented |
| POST | `/api/ai/qa` | Implemented |

Backend proxy `/api/ai/*` tới service Python (`ai/`) qua `AI_SERVICE_URL`.
Service này gọi Gemini khi có `GEMINI_API_KEY`, ngược lại trả kết quả fallback cục bộ
(`used_fallback: true`) nên hệ thống vẫn chạy được khi chưa cấu hình AI.

> Các endpoint `Planned` hiện trả `501 Not Implemented` kèm danh sách route dự kiến.

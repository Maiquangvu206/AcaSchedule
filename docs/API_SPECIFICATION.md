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
| POST | `/api/ai/advice` | Planned |
| POST | `/api/ai/documents/:id/summarize` | Planned |
| POST | `/api/ai/qa` | Planned |

> Các endpoint `Planned` hiện trả `501 Not Implemented` kèm danh sách route dự kiến.

# API Specification — AcaSchedule

Base URL: `/api` (qua Nginx) · Backend nội bộ: `http://backend:8000`

## Response conventions

- JSON, UTF-8.
- Lỗi: `{ "error": "ErrorCode", "message": "...", "details": ..., "requestId": "..." }`.
- Mọi response có header `X-Request-Id` (dùng lại header client gửi nếu có).
- Thời gian: ISO 8601 UTC.

## Health

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/health/live` | Liveness, không kiểm tra dependency. |
| GET | `/api/health` | Readiness, kiểm tra PostgreSQL + Redis + MinIO; `503` nếu degraded. |

## Auth

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/api/auth/register` | Đăng ký tài khoản sinh viên; trả access + refresh token. |
| POST | `/api/auth/login` | Đăng nhập bằng email/mật khẩu. |
| POST | `/api/auth/refresh` | Rotation: thu hồi refresh token cũ, cấp cặp token mới. |
| POST | `/api/auth/logout` | Thu hồi refresh token (idempotent). |
| GET | `/api/auth/me` | Thông tin user hiện tại (Bearer token). |

Mọi route dưới `/api/admin`, `/api/student`, `/api/gpa`, `/api/schedule`,
`/api/documents`, `/api/ai` yêu cầu `Authorization: Bearer <accessToken>`.
`/api/admin/*` yêu cầu role `admin`.

## Admin

Yêu cầu role `admin`.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/admin/grade-scales` | Danh sách thang điểm (sắp giảm dần theo `minScore10`). |
| POST | `/api/admin/grade-scales` | Tạo mốc quy đổi; `409` nếu trùng `minScore10`. |
| PATCH | `/api/admin/grade-scales/:id` | Cập nhật một phần; vẫn kiểm tra trùng mốc. |
| DELETE | `/api/admin/grade-scales/:id` | Xoá mốc quy đổi. |
| GET | `/api/admin/subjects` | Danh sách môn học. |
| POST | `/api/admin/subjects` | Tạo môn; mã unique, `processWeight + finalWeight = 1`. |
| PATCH | `/api/admin/subjects/:id` | Cập nhật môn (mã, tên, tín chỉ, khối, trọng số, `isActive`). |
| DELETE | `/api/admin/subjects/:id` | Vô hiệu hoá môn (`is_active = false`). |
| GET | `/api/admin/users` | Danh sách tài khoản. |

`grade_scales` body:

```json
{ "minScore10": 8.0, "letterGrade": "B+", "grade4": 3.5, "isPass": true }
```

`subjects` body:

```json
{
  "code": "INT2204",
  "name": "Lập trình hướng đối tượng",
  "credits": 3,
  "knowledgeBlock": "Công nghệ phần mềm",
  "processWeight": 0.4,
  "finalWeight": 0.6
}
```

## Student

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/student/enrollments` | Các lượt học của sinh viên hiện tại kèm cờ `countedInCpa`, `reason`. |
| POST | `/api/student/enrollments` | Thêm lượt học; tự tính điểm Hệ 10, điểm chữ, Hệ 4; tự cấp `attemptNo`. |
| PATCH | `/api/student/enrollments/:id` | Sửa điểm/học kỳ của lượt học thuộc chính sinh viên. |
| DELETE | `/api/student/enrollments/:id` | Xoá lượt học và tính lại cờ CPA của môn. |
| GET | `/api/student/transcript` | Bảng điểm nhóm theo học kỳ + tổng hợp CPA. |

Body tạo lượt học:

```json
{ "subjectId": "uuid", "semester": "2025-1", "processScore": 8.0, "finalScore": 7.0 }
```

Điểm Hệ 10 = `processScore * processWeight + finalScore * finalWeight`, làm tròn 2 chữ số;
sau đó tra `grade_scales` theo mốc `minScore10` cao nhất không vượt quá điểm.

Response transcript:

```json
{
  "student": { "id": "uuid", "email": "...", "fullName": "..." },
  "summary": {
    "cpa": 3.12,
    "creditsAttempted": 19,
    "creditsEarned": 19,
    "countedSubjects": 6,
    "totalAttempts": 7
  },
  "semesters": [
    {
      "semester": "2024-1",
      "gpa": 3.05,
      "credits": 13,
      "earnedCredits": 13,
      "attempts": []
    }
  ]
}
```

## GPA / CPA

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/api/gpa/calculate` | Trả CPA, tín chỉ tích luỹ, GPA từng kỳ và chi tiết từng lượt. Body tùy chọn `{ "semester": "2025-1" }` để thêm `semesterGpa`. |
| POST | `/api/gpa/forecast` | Điểm Hệ 4 trung bình cần đạt cho số tín chỉ sắp tới để chạm `targetCpa`; hỗ trợ `plannedGrade4`. |
| GET | `/api/gpa/scales` | Thang điểm quy đổi hiện hành. |

Forecast body:

```json
{ "targetCpa": 3.5, "additionalCredits": 30, "plannedGrade4": 3.6 }
```

Quy tắc chọn lượt tính CPA (**BR-RETENTION**):

1. Mỗi môn chỉ có tối đa một lượt được tính.
2. Nếu có lượt đạt, chỉ xét các lượt đạt; lượt F cũ không tính.
3. Trong các lượt được xét, giữ điểm Hệ 4 cao nhất; bằng điểm thì chọn `attemptNo` lớn hơn.
4. Môn 0 tín chỉ không ảnh hưởng CPA.
5. CPA = tổng(`grade4 * credits`) / tổng tín chỉ của các lượt được tính, làm tròn 2 chữ số.
6. GPA học kỳ tính trên **mọi lượt có điểm** trong học kỳ đó (kể cả F về sau được thay thế),
   nên học kỳ có môn trượt vẫn hiển thị đúng GPA và số tín chỉ đã học.

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

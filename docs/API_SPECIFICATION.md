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

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/schedule/periods` | Cấu hình tiết → giờ (`period_slots`), dùng chung cho backend và UI. |
| GET | `/api/schedule/sections?semester=2025-2&subjectId=&includeCancelled=true` | Danh sách lớp học phần theo học kỳ; mặc định ẩn lớp đã huỷ. |
| POST | `/api/schedule/simulate` | Mô phỏng đăng ký, trả lịch tuần và danh sách xung đột. |
| GET | `/api/schedule/items?semester=2025-2` | Lịch cá nhân của sinh viên hiện tại (kèm mục không gắn học kỳ). |
| POST | `/api/schedule/items` | Thêm lịch cá nhân. |
| PATCH | `/api/schedule/items/:id` | Sửa/kéo-thả lịch cá nhân. |
| DELETE | `/api/schedule/items/:id` | Xoá lịch cá nhân. |

Body mô phỏng:

```json
{
  "semester": "2025-2",
  "sectionIds": ["uuid-int2204-01", "uuid-mat1092-01"],
  "includeSavedItems": true
}
```

Response rút gọn:

```json
{
  "semester": "2025-2",
  "sections": [
    {
      "id": "uuid",
      "subjectCode": "INT2204",
      "sectionCode": "INT2204-01",
      "dayOfWeek": 2,
      "startPeriod": 1,
      "endPeriod": 3,
      "room": "A101",
      "isCancelled": false
    }
  ],
  "periods": [{ "period": 1, "startTime": "07:00", "endTime": "07:50", "label": "Tiết 1" }],
  "conflicts": [
    {
      "type": "section-section",
      "dayOfWeek": 3,
      "overlapStartPeriod": 3,
      "overlapEndPeriod": 3,
      "first": { "id": "uuid-a", "kind": "section", "code": "INT2204-01", "title": "..." },
      "second": { "id": "uuid-b", "kind": "section", "code": "INT2208-04", "title": "..." }
    }
  ],
  "cancelledSectionIds": ["uuid"],
  "summary": {
    "sectionCount": 2,
    "selectedCount": 2,
    "credits": 7,
    "conflictCount": 0,
    "feasible": true
  }
}
```

Quy tắc phát hiện xung đột:

1. Chỉ so sánh các buổi học **cùng thứ**; khoảng tiết là inclusive `[startPeriod, endPeriod]`.
2. Kề tiết (1–3 và 4–6) **không** xung đột; giao đúng 1 tiết (1–3 và 3–5) **có** xung đột.
3. Lớp đã huỷ được trả trong `cancelledSectionIds`, không tạo xung đột và không tính tín chỉ.
4. `includeSavedItems` mặc định `true`: lịch cá nhân đã lưu được đưa vào mô phỏng để cảnh báo
   xung đột với lớp đang chọn.
5. Lịch cá nhân gắn `sectionId` của chính lớp đang chọn không bị so với chính nó.
6. Tín chỉ trong `summary.credits` chỉ tính một lần cho mỗi môn.
7. Mọi `sectionIds` phải tồn tại và thuộc đúng `semester`, nếu không trả `400`.

Body lịch cá nhân:

```json
{
  "title": "Học nhóm Giải tích",
  "semester": "2025-2",
  "dayOfWeek": 3,
  "startPeriod": 2,
  "endPeriod": 3,
  "room": "Thư viện",
  "note": "Mang laptop",
  "sectionId": null
}
```

`PATCH` nhận một phần các trường trên. `POST/PATCH` trả thêm `conflicts` liên quan trực tiếp
đến mục vừa thao tác. Mọi thao tác lịch cá nhân chỉ áp dụng cho chính sinh viên đang đăng nhập.

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

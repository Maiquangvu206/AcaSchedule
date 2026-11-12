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
| POST | `/api/auth/forgot-password` | **Bước 1 quên mật khẩu:** gửi mã xác nhận 6 số qua email (hiệu lực 15 phút). **Không** đổi mật khẩu ở bước này. |
| POST | `/api/auth/reset-password` | **Bước 2 quên mật khẩu:** xác nhận mã 6 số + đặt mật khẩu mới. |
| POST | `/api/auth/change-password` | Đổi mật khẩu (đang đăng nhập, Bearer token). |
| GET | `/api/auth/me` | Thông tin user hiện tại (Bearer token). |

### Đăng nhập & tài khoản bị khóa

- Email không tồn tại **hoặc** sai mật khẩu → `401 Unauthorized`, thông báo chung `Email hoặc mật khẩu không đúng` (không lộ tài khoản có tồn tại hay không).
- **Mật khẩu đúng** nhưng tài khoản bị khóa (`is_active=false`) → `403 Forbidden`, thông báo `Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.` (chỉ người biết mật khẩu mới nhận thông báo này).

### Quên mật khẩu (2 bước, xác nhận qua email)

Luồng này thay thế việc đổi mật khẩu ngay khi yêu cầu: chỉ người truy cập được hộp thư mới đặt lại được mật khẩu.

1. `POST /api/auth/forgot-password` body `{ "email": "..." }`
   - Nếu hệ thống **chưa cấu hình** gửi mail → `400` với thông báo yêu cầu liên hệ quản trị viên (không đổi/khóa tài khoản).
   - Nếu cấu hình mail hợp lệ: sinh mã 6 số (lưu **hash SHA-256**, hết hạn **15 phút**, tối đa **1 mã hiệu lực**/user, thay thế mã cũ), gửi mã qua email và trả **`204`**.
   - Email không tồn tại hoặc tài khoản không hoạt động → vẫn trả **`204`** như nhau (không lộ sự tồn tại của tài khoản).
2. `POST /api/auth/reset-password` body `{ "email": "...", "code": "123456", "newPassword": "..." }`
   - Mã đúng (trong hạn, chưa dùng, chưa vượt số lần sai) → đổi mật khẩu, đặt `must_change_password=false`, đánh dấu mã đã dùng, **thu hồi toàn bộ phiên đăng nhập**; trả **`204`**.
   - Mã sai / hết hạn / đã dùng / không khớp / email không tồn tại hoặc bị khóa → `400` với **cùng một thông báo chung** `Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng thử lại hoặc yêu cầu mã mới.` (không lộ lý do/tài khoản).
   - Nhập sai tích lũy **≥ 5 lần** → mã bị thu hồi, phải yêu cầu mã mới (kể cả sau đó nhập đúng mã cũ).

> Mật khẩu tạm do **admin** tạo/cấp lại cho tài khoản vẫn được gửi qua email như trước (best-effort). Xem [docs/mail-setup.md](mail-setup.md).

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
| PATCH | `/api/admin/subjects/:id` | Cập nhật môn (mã, tên, tín chỉ, khối, bộ môn quản lý `managingUnit`, trọng số, `isActive`). |
| DELETE | `/api/admin/subjects/:id` | Vô hiệu hoá môn (`is_active = false`). |
| GET | `/api/admin/users` | Danh sách tài khoản. |
| GET | `/api/admin/semesters` | Danh sách học kỳ (kể cả đã ẩn). |
| POST | `/api/admin/semesters` | Tạo học kỳ dùng chung: `{ code, name, startDate?, endDate?, isActive?, sortNo? }`. |
| PATCH | `/api/admin/semesters/:code` | Cập nhật học kỳ. |
| DELETE | `/api/admin/semesters/:code` | Xoá học kỳ. |
| GET | `/api/admin/enrollments?studentId=` | Lượt học của một sinh viên (lọc `semester` tùy chọn). |
| POST | `/api/admin/enrollments` | Thêm môn vào kỳ cho sinh viên; kèm điểm hoặc chờ điểm. |
| PATCH | `/api/admin/enrollments/:id?studentId=` | Cập nhật điểm một lượt học. |
| DELETE | `/api/admin/enrollments/:id?studentId=` | Xoá một lượt học. |
| GET | `/api/admin/notifications` | Toàn bộ thông báo hệ thống (kể cả đã ẩn / quá hạn). |
| POST | `/api/admin/notifications` | Tạo thông báo: `{ title, message, level?, isActive?, expiresAt? }`. |
| PATCH | `/api/admin/notifications/:id` | Sửa / bật / ẩn / đặt hạn dùng. |
| DELETE | `/api/admin/notifications/:id` | Xoá thông báo. |
| GET | `/api/admin/data/export/transcript.csv` | Xuất bảng điểm (CSV, lọc `?semester=&majorId=&studentId=`). |
| POST | `/api/admin/data/import/transcript` | Nhập bảng điểm: `{ csv, dryRun? }`. |
| GET | `/api/admin/data/export/curriculum.csv` | Xuất chương trình đào tạo (lọc `?majorId=`). |
| POST | `/api/admin/data/import/curriculum` | Nhập chương trình đào tạo. |
| GET | `/api/admin/data/export/sections.csv` | Xuất cấu hình lịch học (lọc `?semester=`). |
| POST | `/api/admin/data/import/sections` | Nhập cấu hình lịch học: `{ csv, dryRun? }`. |
| GET | `/api/admin/data/template/:kind` | File mẫu CSV (`transcript` \| `curriculum` \| `sections`). |

Chi tiết cột và quy tắc: [`docs/data-import-export.md`](data-import-export.md).

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

## Semesters (học kỳ dùng chung)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/semesters` | Học kỳ đang dùng (`is_active`), dùng cho mọi combo box của frontend. |

## Student

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/student/enrollments` | Các lượt học của sinh viên hiện tại kèm cờ `countedInCpa`, `reason`. |
| POST | `/api/student/enrollments` | Thêm lượt học; tự tính điểm Hệ 10, điểm chữ, Hệ 4; tự cấp `attemptNo`. |
| PATCH | `/api/student/enrollments/:id` | Sửa điểm/học kỳ của lượt học thuộc chính sinh viên. |
| DELETE | `/api/student/enrollments/:id` | Xoá lượt học và tính lại cờ CPA của môn. |
| GET | `/api/student/transcript` | Bảng điểm nhóm theo học kỳ + tổng hợp CPA (kèm `attemptKind`: first/retake/improvement). |
| GET | `/api/student/study-plan` | Lộ trình học theo CTĐT của ngành sinh viên, đã áp dụng sắp xếp cá nhân. |
| PUT | `/api/student/study-plan/placements` | Chuyển môn sang học kỳ tự chọn `{ subjectId, semesterNo }` (`null` = về CTĐT). |
| DELETE | `/api/student/study-plan/placements` | Khôi phục toàn bộ lộ trình theo CTĐT gốc. |

Tuition (sinh viên + admin):

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/tuition-fees` | Sinh viên: mức phí áp dụng cho mình; admin: tất cả. |
| POST | `/api/tuition-fees` | Admin: tạo/cập nhật mức thu `{ semester, majorId?, feePerCredit, currency }`. |
| GET | `/api/tuition-fees/:semester` | Mức phí của một học kỳ. |

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
| GET | `/api/schedule/semesters` | Danh sách học kỳ (đọc từ bảng `semesters` trung tâm). |
| GET | `/api/schedule/registration-status?semester=` | Trạng thái mở/đóng đăng ký của học kỳ (sinh viên). |
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

## Notifications

Yêu cầu đăng nhập.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/notifications` | Thông báo còn hiệu lực cho người dùng (đang bật + chưa quá hạn). Không trả `createdByEmail`. |

Chi tiết cách dùng: [`docs/notifications.md`](notifications.md).

## Documents

### Sinh viên (`/api/documents`, yêu cầu đăng nhập)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/documents/subjects` | Các môn sinh viên đã đăng ký (để đóng góp/xem tài liệu). |
| POST | `/api/documents/uploads/presign` | Cấp URL presigned PUT để trình duyệt tải trực tiếp lên storage. |
| POST | `/api/documents` | Xác nhận upload và lưu metadata (kiểm tra lại object/size/MIME thật trên storage). |
| GET | `/api/documents?subjectId=&q=&sort=` | Danh sách tài liệu theo môn, tìm kiếm, sắp xếp (`rank`/`newest`). Chỉ trả tài liệu **chưa bị ẩn** của các môn đã đăng ký. |
| POST | `/api/documents/:id/vote` | Bình chọn (1: upvote, -1: downvote, 0: hủy); 1 user 1 vote. |
| GET | `/api/documents/:id/download?inline=true` | URL presigned tải xuống/xem trực tiếp tài liệu. |

### Admin (`/api/admin/documents`, yêu cầu role `admin`)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/admin/documents?subjectId=&q=&sort=` | Toàn bộ tài liệu (kể cả **đã ẩn**), không giới hạn theo môn đăng ký. |
| PATCH | `/api/admin/documents/:id` | Cập nhật trạng thái: `{ "isHidden"?: boolean, "isLocked"?: boolean }`. |
| DELETE | `/api/admin/documents/:id` | Xóa hẳn tài liệu (metadata + votes cascade) và xóa object trên storage (best-effort). Trả `204`. |

Body presign upload:

```json
{
  "subjectId": "uuid",
  "fileName": "de-thi-giua-ky.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1024
}
```

Response presign upload:

```json
{
  "uploadUrl": "https://...presigned...",
  "objectKey": "subjects/<subjectId>/<userId>/<uuid>.pdf",
  "method": "PUT",
  "expiresIn": 600,
  "requiredHeaders": { "Content-Type": "application/pdf" }
}
```

`document` (response của tạo/list/vote/download, và admin):

```json
{
  "id": "uuid",
  "subjectId": "uuid",
  "subjectCode": "INT2204",
  "subjectName": "Lập trình hướng đối tượng",
  "title": "Đề thi giữa kỳ",
  "originalName": "de-thi-giua-ky.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1024,
  "upvotes": 0,
  "downvotes": 0,
  "score": 0.0,
  "myVote": 0,
  "uploaderId": "uuid",
  "uploaderName": "Nguyen Van A",
  "createdAt": "2026-11-05T08:13:47.000Z",
  "updatedAt": "2026-11-05T08:13:47.000Z",
  "isHidden": false,
  "isLocked": false
}
```

- `POST /api/documents` → `201 { "document": ... }`
- `POST /api/documents/:id/vote` → `200 { "document": ... }`
- `GET /api/documents/:id/download` → `200 { "url", "expiresIn", "disposition": "inline"|"attachment", "document" }`
- `PATCH /api/admin/documents/:id` → `200 { "document": ... }`

Quy tắc tải lên & truy cập tài liệu (BR-DOCS):

1. Sinh viên chỉ thao tác với tài liệu của môn đang có trong `student_enrollments`; tài liệu **bị ẩn** (`isHidden=true`) không xuất hiện và không truy cập được qua API sinh viên.
2. Tài liệu **bị khóa** (`isLocked=true`) vẫn hiển thị cho sinh viên nhưng **không** cho xem/tải (`GET .../download`) và **không** cho bình chọn (`POST .../vote`) — trả `403`.
3. Tệp upload qua presigned PUT trực tiếp tới object storage; backend không đọc nội dung tệp.
4. Validate trước khi ký URL và **sau khi object đã có trên storage** (server `statObject`): kích thước khớp khai báo, MIME/định dạng hợp lệ (PDF, Office, văn bản, ảnh), chặn tệp thực thi; object key do backend sinh `subjects/{subjectId}/{studentId}/{uuid}.{ext}`.
5. Metadata (`subject_documents`): tiêu đề, tên gốc, MIME, kích thước, object key, người tải lên, thời gian, `is_hidden`, `is_locked`. Counters `upvotes`/`downvotes` tính lại từ `document_votes` (một user một vote).
6. Xem/tải yêu cầu quyền truy cập môn học và tài liệu không bị khóa; không lộ bucket public. Lỗi storage phía backend trả `503 "Object storage is unavailable"` kèm log lỗi gốc (xem [docs/r2-setup.md](r2-setup.md)).

## Auth (tham khảo body/response)

Body register:

```json
{
  "email": "student@example.com",
  "password": "Student@123",
  "fullName": "Sinh viên"
}
```

Response register/login/refresh:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "fullName": "Sinh viên",
    "role": "student",
    "createdAt": "2026-11-05T08:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Response me:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "fullName": "Sinh viên",
    "role": "student",
    "createdAt": "2026-11-05T08:00:00.000Z"
  }
}
```

## AI Advisor

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/ai/status` | Tình trạng dịch vụ AI (proxy tới AI service). |
| POST | `/api/ai/advice` | Tư vấn học tập từ dữ liệu điểm thật của sinh viên (lấy từ bảng điểm, không tin client). |
| POST | `/api/ai/documents/summarize` | Tóm tắt nội dung tài liệu. |
| POST | `/api/ai/qa` | Trả lời câu hỏi dựa trên ngữ cảnh tài liệu, kèm `sources`. |

- **Không giới hạn lượt hỏi**; cache Redis 10 phút cho cùng nội dung. Câu trả lời tự nối phần còn thiếu khi chạm giới hạn token nên không bị cắt giữa câu.
- `POST /api/ai/advice` lấy điểm thật từ bảng điểm của sinh viên đang đăng nhập; client chỉ gửi `targetCpa` và `question` tùy chọn. Dữ liệu được loại bỏ thông tin nhận dạng cá nhân trước khi gửi đến mô hình AI; log chỉ ghi siêu dữ liệu.
- Nếu dịch vụ/model không khả dụng hoặc lỗi, backend trả kết quả **fallback** cục bộ (`used_fallback: true`), không trả `500`. Backend proxy `/api/ai/*` tới service Python (`ai/`) qua `AI_SERVICE_URL`.

Body advice:

```json
{
  "targetCpa": 3.5,
  "question": "Làm sao để nâng CPA nhanh nhất?"
}
```

Response (ví dụ, có thể `used_fallback: true`, `model: "fallback"`):

```json
{
  "advice": "CPA của bạn đang ổn định. Nên ưu tiên học lại môn có điểm thấp nhất.",
  "model": "gemini",
  "used_fallback": false
}
```

Body summarize:

```json
{
  "text": "Nội dung tài liệu cần tóm tắt...",
  "maxSentences": 6
}
```

Response summarize:

```json
{
  "summary": "Tóm tắt nội dung tài liệu...",
  "model": "gemini",
  "used_fallback": false
}
```

Body QA:

```json
{
  "question": "Làm sao để chuẩn bị đề thi?",
  "documents": [
    { "title": "Đề thi giữa kỳ", "text": "Nội dung tài liệu..." }
  ]
}
```

Response QA:

```json
{
  "answer": "Dựa trên tài liệu, bạn nên...",
  "sources": [
    { "title": "Đề thi giữa kỳ", "snippet": "Nội dung tài liệu..." }
  ],
  "model": "gemini",
  "used_fallback": false
}
```

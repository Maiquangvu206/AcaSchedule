# Database Design — AcaSchedule

PostgreSQL 16. Thiết kế chuẩn hóa, lưu vết lịch sử học tập và tài liệu cộng đồng.

Seed chỉ tạo duy nhất tài khoản admin (từ biến môi trường) và dữ liệu tham chiếu
(`grade_scales`, `period_slots`). Dữ liệu nghiệp vụ (sinh viên, môn học, học kỳ,
học phí, lượt học, ...) do admin tạo qua giao diện.

## ERD

```
grade_scales (độc lập)

period_slots (độc lập — cấu hình tiết → giờ)

subjects 1 ─── N student_enrollments
    │ 1                    │ 1
    │ N                    │ N
subject_documents     schedule_items
    │ 1
    │ N
course_sections 1 ─── N schedule_items (section_id, nullable)
```

## Bảng chính

### `users`

Tài khoản đăng nhập, phân quyền bằng `role`.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| email | varchar(255) UNIQUE | Chuẩn hoá lowercase |
| password_hash | text | bcrypt, 12 rounds |
| full_name | varchar(120) | |
| role | varchar(20) | `student` hoặc `admin` |
| created_at / updated_at | timestamptz | Trigger cập nhật `updated_at` |

### `refresh_tokens`

Lưu hash refresh token để hỗ trợ rotation và thu hồi.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → users | ON DELETE CASCADE |
| token_hash | char(64) UNIQUE | SHA-256 của token |
| expires_at | timestamptz | |
| revoked_at | timestamptz | NULL nếu còn hiệu lực |

### `grade_scales`

Mốc quy đổi Hệ 10 → điểm chữ → Hệ 4.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| min_score_10 | numeric(4,2) | Điểm tối thiểu hệ 10 |
| letter_grade | varchar(2) | A, B+, B, ... |
| grade_4 | numeric(3,2) | Điểm hệ 4 |
| is_pass | boolean | Điểm đạt hay không |

### `subjects`

Khung đào tạo do Admin quản lý.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| code | varchar(20) UNIQUE | Mã môn |
| name | varchar(255) | Tên môn |
| credits | smallint | Số tín chỉ |
| knowledge_block | varchar(100) | Khối kiến thức |
| managing_unit | varchar(100) | Bộ môn quản lý (hiển thị trên CTĐT/Lộ trình học) |
| process_weight | numeric(3,2) | Trọng số điểm quá trình, mặc định `0.40` |
| final_weight | numeric(3,2) | Trọng số điểm thi, mặc định `0.60` |
| is_active | boolean | |

Ràng buộc: `process_weight + final_weight = 1` (check constraint `subjects_weights_sum_check`).

### `semesters`

Danh mục học kỳ dùng chung, admin cấu hình một lần tại tab **Học kỳ**.
Mọi combo box (lịch học, học phí, môn học theo kỳ, đăng ký) đều đọc từ bảng này
qua `GET /api/semesters`; dữ liệu lịch sử được backfill vào lúc migration tạo bảng.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| code | varchar(30) PK | Mã học kỳ, VD `2024-1` hoặc `HK1 2026-2027` |
| name | varchar(100) | Tên hiển thị |
| start_date / end_date | date | Thời gian học kỳ (tùy chọn) |
| is_active | boolean | `false` = ẩn khỏi combo box |
| sort_no | int | Thứ tự sắp xếp trong combo box |

### `departments` / `majors` / `curriculum_subjects` / `user_majors`

- `departments(id, code UNIQUE, name)` — khoa.
- `majors(id, code UNIQUE, name, department_id FK NULL)` — ngành thuộc khoa.
- `curriculum_subjects(major_id, subject_id, is_required, semester_no)` — chương trình đào tạo:
  môn thuộc ngành nào, học kỳ kế hoạch nào (`semester_no` 1–20), bắt buộc/tự chọn.
  PK `(major_id, subject_id)`.
- `user_majors(user_id, major_id, is_primary)` — sinh viên thuộc tối đa 2 ngành,
  một ngành chính. Lộ trình học của sinh viên lọc theo ngành chính này.

### `tuition_fees`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| semester | varchar(20) | Học kỳ áp dụng |
| major_id | uuid FK NULL | NULL = mức chung toàn trường |
| fee_per_credit | numeric | Mức thu / tín chỉ |
| currency | varchar(3) | `VND` mặc định |

Dashboard sinh viên: kỳ có mức riêng thì dùng mức đó, kỳ chưa có thì áp dụng mức
cấu hình mới nhất (ghi chú "áp dụng mức phí hiện hành").

### `registration_configs`

Theo học kỳ: `is_open`, `opened_at`, `closed_at`. Sinh viên xem trạng thái qua
`GET /api/schedule/registration-status`; admin cấu hình qua `/api/admin/schedule/*`.

### `student_study_plan`

Sắp xếp cá nhân của sinh viên trên Lộ trình học: `(student_id, subject_id, semester_no)`.
Có dòng = sinh viên kéo môn sang học kỳ tự chọn; không có = theo CTĐT gốc
(`curriculum_subjects.semester_no`).

### `student_enrollments`

Một dòng = một lượt học của sinh viên cho một môn.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| student_id | uuid FK | |
| subject_id | uuid FK → subjects | |
| semester | varchar(20) | HK1-2025, ... |
| process_score | numeric(4,2) | Điểm quá trình |
| final_score | numeric(4,2) | Điểm thi |
| letter_grade | varchar(2) | Suy ra từ grade_scales |
| grade_4 | numeric(3,2) | Suy ra từ grade_scales |
| is_counted_in_cpa | boolean | BR-RETENTION |
| attempt_no | smallint | Lần học thứ n |

Ràng buộc/index đề xuất:

- `UNIQUE (student_id, subject_id, attempt_no)`
- `INDEX (student_id, is_counted_in_cpa)`

`is_counted_in_cpa` được engine tính lại mỗi khi thêm/sửa/xoá lượt học: chỉ một lượt/môn
được `true` theo BR-RETENTION (ưu tiên lượt đạt, điểm Hệ 4 cao nhất, tie-break `attempt_no`).
Khi đọc CPA, backend luôn tính lại từ dữ liệu gốc và ghi lại cờ, không tin giá trị cũ.

### `subject_documents`

Metadata tài liệu cộng đồng; file thật nằm trên MinIO.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| subject_id | uuid FK → subjects | |
| uploader_id | uuid FK | |
| title | varchar(255) | |
| original_name | varchar(255) | Tên tệp gốc khi tải lên |
| object_key | text | Đường dẫn trong bucket |
| mime_type | varchar(100) | |
| size_bytes | bigint | |
| upvotes | integer DEFAULT 0 | |
| downvotes | integer DEFAULT 0 | |
| created_at / updated_at | timestamptz | Trigger cập nhật `updated_at` |
### `document_votes`

Một user một bình chọn cho mỗi tài liệu.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| document_id | uuid FK → subject_documents | ON DELETE CASCADE |
| user_id | uuid FK → users | ON DELETE CASCADE |
| value | smallint | `1` upvote, `-1` downvote |
| created_at / updated_at | timestamptz | |

Ràng buộc:

- `UNIQUE (document_id, user_id)`
- `INDEX (user_id, value)`

### `period_slots`

Cấu hình tiết → giờ, dùng chung cho API và UI (không hard-code trong frontend). Mỗi dòng là một tiết.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| period | smallint PK | 1–16 |
| start_time | time | Giờ bắt đầu |
| end_time | time | Giờ kết thúc, phải sau `start_time` |
| label | varchar(30) | Nhãn hiển thị, VD `Tiết 1` |

Seed mặc định 12 tiết, bắt đầu `07:00–07:50`.

### `course_sections`

Một dòng = một buổi học của lớp học phần (một lớp có thể có nhiều buổi trong tuần).

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| subject_id | uuid FK → subjects | ON DELETE RESTRICT |
| semester | varchar(20) | Học kỳ mở lớp |
| section_code | varchar(30) | Mã lớp, VD `INT2204-01` |
| day_of_week | smallint | 1 = Thứ 2 ... 7 = CN |
| start_period / end_period | smallint | Khoảng tiết, `end_period >= start_period` |
| room | varchar(50) | |
| lecturer | varchar(120) | |
| capacity | smallint | NULL hoặc > 0 |
| is_cancelled | boolean | Lớp đã huỷ, mặc định `false` |
| created_at / updated_at | timestamptz | Trigger cập nhật `updated_at` |

Ràng buộc/index:

- `UNIQUE (semester, section_code)`
- `INDEX (semester, is_cancelled, day_of_week, start_period)`
- `INDEX (subject_id)`

### `schedule_items`

Lịch cá nhân của sinh viên; có thể gắn với một lớp học phần đã chọn.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| student_id | uuid FK | |
| section_id | uuid FK NULL → course_sections | ON DELETE SET NULL; NULL nếu là lịch cá nhân thuần |
| title | varchar(255) | Tên hoạt động |
| semester | varchar(20) NULL | NULL = áp dụng mọi học kỳ |
| day_of_week | smallint | 1 = Thứ 2 ... 7 = CN |
| start_period | smallint | Tiết bắt đầu |
| end_period | smallint | Tiết kết thúc |
| room | varchar(50) | |
| note | text | |

Ràng buộc/index:

- `INDEX (student_id, semester, day_of_week)`
- Xung đột được tính động bằng engine (không lưu cột `conflict`).

### `system_notifications`

Thông báo hệ thống admin gửi cho toàn bộ sinh viên; hiện trong lớp thông báo mỗi lần sinh viên vào trang.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| title | text | NOT NULL, không rỗng |
| message | text | NOT NULL, không rỗng |
| level | text | `info` / `success` / `warning` / `error` |
| is_active | boolean | Admin bấm "Ẩn" → `false` |
| expires_at | timestamptz NULL | NULL = không hết hạn; quá hạn thì tự ẩn |
| created_by | uuid FK NULL → users | ON DELETE SET NULL |
| created_at / updated_at | timestamptz | |

Ràng buộc/index:

- `INDEX (is_active, created_at DESC)`

## Migration

Đặt file SQL trong `backend/src/database/migrations/` theo thứ tự `001_...sql`, `002_...sql`.
Migration runner lưu checksum vào `schema_migrations`, chạy trong transaction và từ chối
file đã bị sửa sau khi apply.

- `npm run migrate` — áp dụng migration còn thiếu.
- `npm run seed` — tạo tài khoản admin (nếu chưa có) + đảm bảo dữ liệu tham chiếu.
- `docker compose exec backend node dist/database/migrate.js` — chạy trong container production.

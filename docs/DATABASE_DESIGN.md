# Database Design — AcaSchedule

PostgreSQL 16. Thiết kế chuẩn hóa, lưu vết lịch sử học tập và tài liệu cộng đồng.

## ERD

```
grade_scales (độc lập)

subjects 1 ─── N student_enrollments
    │ 1                    │ 1
    │ N                    │ N
subject_documents     schedule_items
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
| process_weight | numeric(3,2) | Trọng số điểm quá trình, mặc định `0.40` |
| final_weight | numeric(3,2) | Trọng số điểm thi, mặc định `0.60` |
| is_active | boolean | |

Ràng buộc: `process_weight + final_weight = 1` (check constraint `subjects_weights_sum_check`).

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
| object_key | text | Đường dẫn trong bucket |
| mime_type | varchar(100) | |
| size_bytes | bigint | |
| upvotes | integer DEFAULT 0 | |
| downvotes | integer DEFAULT 0 | |
| created_at | timestamptz | |

### `schedule_items`

Lịch cố định từ lớp học phần và lịch cá nhân.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| id | uuid PK | |
| student_id | uuid FK | |
| enrollment_id | uuid FK NULL | NULL nếu là lịch cá nhân |
| day_of_week | smallint | 1 = Thứ 2 ... 7 = CN |
| start_period | smallint | Tiết bắt đầu |
| end_period | smallint | Tiết kết thúc |
| room | varchar(50) | |
| note | text | |

## Migration

Đặt file SQL trong `backend/src/database/migrations/` theo thứ tự `001_...sql`, `002_...sql`.
Migration runner lưu checksum vào `schema_migrations`, chạy trong transaction và từ chối
file đã bị sửa sau khi apply.

- `npm run migrate` — áp dụng migration còn thiếu.
- `npm run seed` — nạp dữ liệu demo (idempotent).
- `docker compose exec backend node dist/database/migrate.js` — chạy trong container production.

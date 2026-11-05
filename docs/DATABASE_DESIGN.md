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
| is_active | boolean | |

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

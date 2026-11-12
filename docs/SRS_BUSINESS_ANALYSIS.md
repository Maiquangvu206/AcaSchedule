# SRS & Business Analysis — AcaSchedule

Tài liệu này mô tả phạm vi nghiệp vụ ở mức khung; đặc tả chi tiết sẽ được bổ sung theo từng sprint.

## 1. Actors

| Actor | Mô tả |
| --- | --- |
| Student | Theo dõi điểm, tính GPA/CPA, xếp lịch, tải tài liệu, hỏi AI Advisor. |
| Admin | Quản lý khung đào tạo, mốc quy đổi điểm, môn học và người dùng. |
| AI Advisor | Thành phần hệ thống, không phải người dùng. |

## 2. Business Rules

### BR-RETENTION — GPA/CPA

- **Học lại (F → Pass):** giữ lịch sử lượt trượt; đặt `is_counted_in_cpa = false` cho lượt F, `true` cho lượt đạt mới.
- **Học cải thiện:** chỉ giữ `is_counted_in_cpa = true` ở lượt có điểm hệ 4 cao nhất trong các lượt đạt.
- Tín chỉ tích lũy của một môn chỉ được đếm **một lần**.
- CPA = `Σ(điểm hệ 4 × tín chỉ) / Σ(tín chỉ)` trên các lượt được đếm.

### BR-DOCS — Document Hub

- Sinh viên chỉ được upload/xem/bình chọn tài liệu cho môn đã/đang đăng ký (`student_enrollments`); tài liệu **bị ẩn** không hiển thị với sinh viên, tài liệu **bị khóa** vẫn hiển thị nhưng không xem/tải/bình chọn.
- Admin có thể **ẩn / khóa / xóa** tài liệu (xóa metadata và object storage best-effort).
- Tài liệu được xếp hạng theo `upvotes - downvotes`, sau đó theo thời gian tạo.
- File lưu trên object storage (MinIO/R2/S3, presigned URL); PostgreSQL chỉ lưu metadata và đường dẫn object.

### BR-AI — AI Advisor

- Phân tích điểm thành phần theo khối kiến thức, gợi ý điểm thi mục tiêu; hỗ trợ tóm tắt/Q&A theo ngữ cảnh.
- Không gửi dữ liệu cá nhân ngoài phạm vi cần thiết tới mô hình AI (PII redaction). AI không giới hạn lượt hỏi; khi dịch vụ không khả dụng trả fallback cục bộ.

## 3. Out of Scope (v1)

- Thanh toán, học phí.
- Ứng dụng mobile native.
- Đồng bộ lịch với Google Calendar.

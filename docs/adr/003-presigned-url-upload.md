# ADR-003: Presigned URL upload trực tiếp lên MinIO

## Trạng thái

Accepted

## Ngữ cảnh

Cần cho phép sinh viên upload tài liệu (PDF, Office, ảnh) lên MinIO mà không quá tải backend với dữ liệu file lớn.

## Quyết định

Backend cấp presigned PUT URL (có thời gian lived 10 phút). Trình duyệt PUT trực tiếp file lên MinIO. Backend chỉ lưu metadata sau khi xác minh kích thước và MIME type thật của object.

## Quyết định thay thế

- **Không upload qua backend**: quá tải backend với file lớn
- **Không dùng public bucket bucket public**: rủi ro bảo mật

## Hệ quả

### Tích cực
- Backend không xử lý dữ liệu file, chỉ xử lý metadata
- Tốc độ upload nhanh (trực tiếp lên storage)
- Giảm bandwidth cho backend

### Tiêu cực
- Cần xác minh lại metadata sau khi upload (kích thước, MIME type)
- Cần xử lý orphan uploads (upload chưa xác minh)

## Xác nhận

- Presigned URL trả về với Content-Type header
- Browser PUT trực tiếp lên MinIO
- Backend xác minh kích thước và MIME type trước khi lưu metadata

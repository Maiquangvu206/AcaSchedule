# ADR-005: PII Redaction trước khi gửi AI

## Trạng thái

Accepted

## Ngữ cảnh

Cần gửi dữ liệu sinh viên (tên, điểm, câu hỏi) đến AI model (Gemini). Không được lộ thông tin nhận dạng cá nhân (PII) ra bên ngoài.

## Quyết định

Redact PII trước khi gửi đến AI:
- Email addresses → `[email]`
- Phone numbers (Viet Nam) → `[số điện thoại]`
- UUID tokens → `[mã]`
- Vietnamese names (2-4 từ viết hoa đầu) → `[họ tên]`

Log chỉ ghi metadata (số môn, có câu hỏi), không ghi raw content.

## Quyết định thay thế

- **Không gửi raw data đến Gemini**: rủi ro lộ PII
- **Không dùng entity recognition library**: over-engineering, regex đủ cho các pattern phổ biến

## Hệ quả

### Tích cực
- Bảo vệ PII của sinh viên
- Tuân thủ quy định bảo vệ dữ liệu cá nhân

### Tiêu cực
- Có thể miss một số pattern tên không tiêu chuẩn
- Regex có thể false positive với từ viết hoa đầu

## Xác nhận

- 8 unit tests cho PII redaction
- Email, SĐT, UUID, tên Việt Nam được redact đúng
- Text thường không bị ảnh hưởng

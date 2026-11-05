# ADR-002: JWT với refresh token rotation

## Trạng thái

Accepted

## Ngữ cảnh

Cần xác thực người dùng an toàn, hỗ trợ đăng nhập lại tự động mà không cần nhập lại mật khẩu, và có khả năng thu hồi token khi cần.

## Quyết định

Sử dụng JWT với hai loại token:
- **Access Token**: thời gian sống ngắn (15 phút), dùng để gọi API
- **Refresh Token**: thời gian sống lâu (7 ngày), lưu trong refresh_tokens bảng, dùng để lấy access token mới

Khi refresh, access token cũ bị thu hồi và tạo cặp token mới (rotation).

## Quyết định thay thế

- **Không dùng session cookie**: API stateless, dễ scale
- **Không dùng OAuth2 server**: over-engineering cho showcase project

## Hệ quả

### Tích cực
- Access token ngắn hạn giảm rủi ro nếu bị lộ
- Refresh token rotation giúp thu hồi truy cập khi cần
- Stateless, dễ scale

### Tiêu cực
- Cần lưu refresh token trong DB
- Cần xử lý rotation đúng cách để tránh token reuse

## Xác nhận

- Login tạo access + refresh token
- Refresh tạo access mới + refresh token mới, thu hồi refresh token cũ
- Logout thu hồi refresh token

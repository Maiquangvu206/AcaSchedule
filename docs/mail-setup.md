# Cấu hình gửi email (Brevo / Resend / SMTP)

Hệ thống gửi email phục vụ các luồng xác thực/tài khoản:

- **Mã xác nhận 6 số (quên mật khẩu 2 bước):** sinh viên yêu cầu đặt lại mật khẩu tại `/forgot-password` → hệ thống gửi mã (hiệu lực 15 phút). Mã đúng mới cho phép đặt mật khẩu mới; luồng này **không** đổi mật khẩu khi chưa xác nhận.
- **Mật khẩu tạm thời:** khi **admin** tạo tài khoản sinh viên mới hoặc admin cấp lại mật khẩu.

Vì Render free **chặn cổng SMTP** (25/465/587), hệ thống ưu tiên gửi qua **HTTP API**
(cổng 443 — luôn mở). Thứ tự ưu tiên:

```
Resend (nếu có RESEND_API_KEY)
   ↓ thiếu key
Brevo (nếu có BREVO_API_KEY)
   ↓ thiếu key
SMTP (local — cần SMTP_HOST + SMTP_FROM)
   ↓ không cấu hình gì
Báo lỗi: chưa cấu hình máy chủ gửi thư — không gửi được
```

**Lưu ý:**
- **Quên mật khẩu (bước 1):** nếu chưa cấu hình mail hoặc gửi thất bại, API trả lỗi tương ứng (400/503) và **không** đặt lại mật khẩu (tránh khóa truy cập). Cấu hình mail là bắt buộc để dùng luồng này.
- **Mật khẩu tạm do admin:** gửi thất bại là **best-effort** — không làm mất tài khoản, admin vẫn có thể nhận mật khẩu tạm hiển thị trên giao diện để chuyển tay cho sinh viên.

---

## Cách 1: Brevo — KHÔNG cần domain (khuyến nghị khi chưa có domain)

Brevo (`brevo.com`, tên cũ Sendinblue) chỉ yêu cầu **verify 1 địa chỉ email
người gửi** — dùng Gmail thường được. Free **300 email/ngày**.

### Bước 1 — Tạo tài khoản Brevo

1. Vào `https://app.brevo.com` → **Sign up free** (đăng ký bằng email Gmail của bạn).
2. Trả lời vài câu hỏi onboarding (chọn "Transactional email" / mục đích cá nhân).

### Bước 2 — Verify địa chỉ người gửi

1. Menu **Senders, Domains & Dedicated IPs** → tab **Senders** → **Add sender**.
2. Điền:
   - **Email**: địa chỉ Gmail thật của bạn (ví dụ `acasky.gmail@gmail.com`)
   - **Name**: `AcaSchedule` (tên hiển thị trên thư)
3. Brevo gửi một email xác nhận → bấm **link verify** trong email đó.
4. Trạng thái sender chuyển sang **Verified** (xanh).

> ⚠️ Gmail chấp nhận "gửi từ" địa chỉ khác qua API, nhưng một số hộp thư
> (Outlook) có thể đánh dấu thư là spam nếu sender không trùng domain.
> Gmail → Gmail thường vào hộp thư bình thường.

### Bước 3 — Lấy API key

1. Menu **SMTP & API** → tab **API Keys**.
2. **Generate new API key** → đặt tên `acaschedule` → copy key
   **một lần duy nhất**, dạng `xkeysib-xxxxxxxx...`.

### Bước 4 — Cấu hình Render

Render Dashboard → service backend (`acaschedule-backend-dbos`) → **Environment**:

| Key | Giá trị |
|---|---|
| `BREVO_API_KEY` | `xkeysib-xxxxxxxx...` |
| `SMTP_FROM` | địa chỉ Gmail đã verify ở bước 2 |

→ **Save Changes** → **Manual Deploy** backend.

### Bước 5 — Kiểm tra

- Đăng nhập admin → tạo 1 tài khoản sinh viên thử với **email thật của bạn**.
- Mail phải đến trong ~1 phút, tiêu đề *"Tài khoản AcaSchedule của bạn"*.
- Nếu lỗi, xem log backend (Render → Logs) tìm dòng `Brevo returned <status>`:
  - `401` → key sai
  - `400` kèm `Invalid sender` → `SMTP_FROM` chưa trùng sender đã verify

---

## Cách 2: Resend — cần domain đã verify

Dùng khi **có domain riêng** (đuôi rẻ như `.xyz` ~$1–3/năm cũng được).
Free 3.000 email/tháng, uy tín gửi cao hơn (SPF/DKIM đúng domain).

1. Đăng ký `https://resend.com` (Google/GitHub).
2. **API Keys** → Create API Key → copy `re_xxxx...`.
3. **Domains** → Add Domain → add các bản ghi DNS (SPF/DKIM) vào nhà cung cấp
   domain → bấm **Verify**.
4. Render Environment: `RESEND_API_KEY=re_xxxx...`, `SMTP_FROM=no-reply@domain-cua-ban`.

**Chưa verify domain:** chỉ dùng được `SMTP_FROM=onboarding@resend.dev` và
chỉ gửi được tới **email của chính tài khoản Resend** — đủ để test đường ống.

Khi nào có cả hai key thì Resend được ưu tiên trước.

---

## Cách 3: SMTP (chỉ dùng local)

Docker local không bị chặn cổng — có thể dùng `SMTP_HOST`/`SMTP_USER`/
`SMTP_PASSWORD`/`SMTP_FROM` (ví dụ máy chủ mail của trường). Trên Render free
**không dùng được**, đừng set các key này trên Render.

---

## Tổng kết ma trận chọn

| Tình huống | Chọn |
|---|---|
| Chưa có domain, muốn mail thật tới sinh viên | **Brevo** (cách 1) |
| Có domain riêng | **Resend** (cách 2) |
| Chưa muốn cấu hình gì | Bỏ trống — app vẫn chạy, admin nhận mật khẩu tạm trực tiếp trên giao diện |
| Test đường ống mail trên Render | `SMTP_FROM=onboarding@resend.dev` + `RESEND_API_KEY` (chỉ gửi tới chính mình) |

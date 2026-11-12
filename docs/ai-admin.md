# Trang quản trị AI (`/admin/ai`)

Trang dành cho **admin** để:

- xem **lượt truy vấn** theo ngày, theo provider và **theo từng sinh viên**;
- đặt **hạn mức lượt/ngày** (mặc định toàn hệ thống + ghi đè từng sinh viên);
- bật/tắt trợ lý AI (kill switch);
- đổi **model** Gemini / OpenRouter và **thứ tự provider**;
- thêm / tắt / xoá **API key** ngay trên web — không cần sửa Render Environment.

```
Admin (web) ──► Backend (Render) ──► Supabase
                    │  key mã hoá AES-256-GCM
                    │
                    └─ GET /api/internal/ai/config (X-Internal-Token)
                              ▲
                              │ mỗi 30 giây
                        AI service (FastAPI)
```

---

## 1. Chạy migration

Backend cần 3 bảng mới: `ai_settings`, `ai_provider_keys`, `ai_usage_logs`
(migration `024_ai_admin.sql`) và cột `users.ai_daily_limit`.

Chọn **một** cách:

```bash
# Trong backend/ (dùng DATABASE_URL đang cấu hình)
npm run migrate
```

hoặc mở `backend/src/database/schema_full.sql` trong DBeaver và chạy **Alt+X**
(chạy toàn bộ script), hoặc chỉ chạy `024_ai_admin.sql`.

Kiểm tra:

```sql
SELECT * FROM ai_settings;
SELECT count(*) FROM ai_provider_keys;
SELECT count(*) FROM ai_usage_logs;
```

`schema_check.sql` phải trả về **0 dòng**.

> Chưa chạy migration → trang admin báo `Database chưa có bảng AI`, và các request
> AI vẫn hoạt động bình thường bằng key trong biến môi trường.

---

## 2. Tạo secret trên Render

### Backend (`acaschedule-backend`)

| Biến | Giá trị |
|---|---|
| `AI_KEYS_SECRET` | chuỗi ngẫu nhiên ≥ 16 ký tự (nên 64 hex) |
| `AI_INTERNAL_TOKEN` | chuỗi ngẫu nhiên khác, ≥ 32 ký tự |

Tạo nhanh:

```bash
openssl rand -hex 32   # dùng cho AI_KEYS_SECRET
openssl rand -hex 32   # dùng cho AI_INTERNAL_TOKEN
```

### AI service (`acaschedule-ai`)

| Biến | Giá trị |
|---|---|
| `AI_INTERNAL_TOKEN` | **giống hệt** backend |
| `BACKEND_CONFIG_URL` | `https://acaschedule-backend.onrender.com/api/internal/ai/config` |

`render.yaml` đã khai báo sẵn các biến này (các giá trị bí mật để `sync: false`).
Với service **đã tồn tại**, phải thêm tay trong Render → Environment.

> `AI_KEYS_SECRET` **chỉ** đặt ở backend. Không đặt ở AI service và không gửi xuống
> trình duyệt.

---

## 3. Cách hoạt động

### API key

1. Admin dán key trên web → backend mã hoá AES-256-GCM (scrypt từ `AI_KEYS_SECRET`)
   rồi lưu vào `ai_provider_keys`.
2. Mỗi 30 giây, AI service gọi `/api/internal/ai/config` (xác thực bằng
   `AI_INTERNAL_TOKEN`) để lấy danh sách key đang bật + model + thứ tự provider.
3. Key trong DB được **ưu tiên**; key trong biến môi trường
   (`GEMINI_API_KEYS`, `OPENROUTER_API_KEYS`) được giữ làm **dự phòng**.
4. Key bị tắt/xoá sẽ hết hiệu lực trong ≤ 30 giây, không cần deploy lại.

Ưu tiên quay vòng: sắp xếp theo cột `priority` (nhỏ trước), sau đó theo thời điểm tạo.

### Kill switch & model

- Bỏ tick **Bật trợ lý AI** → mọi request AI trả lỗi thân thiện 503
  (`Trợ lý AI đang tạm tắt để bảo trì`).
- Đổi model → AI service dùng model mới sau ≤ 30 giây.
- Nếu backend/feed không truy cập được, AI service dùng cấu hình tốt nhất gần nhất;
  nếu chưa từng có, dùng biến môi trường (không downtime).

> ⚠️ Ô model chỉ nhận **tên model** (`gemini-3.5-flash`,
> `google/gemini-3.5-flash`), không nhận API key. Backend sẽ báo lỗi nếu phát
> hiện giá trị bắt đầu bằng `AIza`, `AQ.`, `sk-` hoặc `sk-or-`.
>
> Model đã bị Google/OpenRouter ngừng hỗ trợ (`gemini-1.5-flash`,
> `google/gemini-2.0-flash-001`) sẽ trả 404; AI service tự bỏ qua các model
> này và dùng model trong biến môi trường.

### Lượt truy vấn & hạn mức

- Mỗi request `/advice`, `/documents/summarize`, `/qa` ghi 1 dòng vào
  `ai_usage_logs`: user, endpoint, provider (`gemini` / `openrouter` / `fallback`
  / `cache`), độ trễ, HTTP status.
- Request trả từ **cache Redis** vẫn tính 1 lượt (provider = `cache`).
- Hạn mức ngày tính theo **giờ Việt Nam** (đặt lại lúc 0h).
- Thứ tự áp dụng: `users.ai_daily_limit` → `ai_settings.daily_limit_per_user`
  → `0` (không giới hạn).
- Vượt hạn mức → HTTP **429** với thông báo rõ ràng, không gọi nhà cung cấp AI.

> Nếu database tạm thời không truy cập được, bước kiểm tra hạn mức **fail-open**
> (cho request đi tiếp) để không chặn sinh viên vì lỗi hạ tầng.

---

## 4. Bảo mật

| Hạng mục | Cơ chế |
|---|---|
| Key khi lưu | AES-256-GCM, IV ngẫu nhiên mỗi lần, khoá dẫn xuất scrypt |
| Key khi hiển thị | chỉ 4 ký tự cuối (`••••1234`) |
| Key khi truyền | HTTPS backend ↔ AI service, header `X-Internal-Token` |
| Endpoint nội bộ | so sánh token bằng `timingSafeEqual`, không log token |
| Quyền truy cập | toàn bộ `/api/admin/ai/*` yêu cầu role `admin` |
| Xoá key | xoá hẳn khỏi DB (không soft-delete) |

Nếu `AI_KEYS_SECRET` bị đổi, các key cũ **không giải mã được** nữa. Khi đó AI service
bỏ qua key lỗi (ghi log `Stored AI key could not be decrypted`) và dùng key env.
Muốn đổi secret: thêm lại toàn bộ key trên trang admin sau khi đổi.

---

## 5. Kiểm tra nhanh

```bash
# 1. AI service đã nhận cấu hình từ backend chưa
curl https://acaschedule-ai-quju.onrender.com/health
# → "remote_config": true

# 2. Backend nội bộ (thay token thật)
curl -H "X-Internal-Token: $AI_INTERNAL_TOKEN" \
  https://acaschedule-backend.onrender.com/api/internal/ai/config
# → enabled, provider_order, gemini_keys (mảng), openrouter_keys (mảng)

# 3. Sau khi chat AI, mở /admin/ai
# → số lượt hôm nay tăng, log có provider tương ứng
```

---

## 6. Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| `Database chưa có bảng AI` | Chưa chạy migration 024 |
| `Chưa cấu hình AI_KEYS_SECRET…` | Thiếu biến trên backend hoặc < 16 ký tự |
| Thêm key thành công nhưng health vẫn 0 | `BACKEND_CONFIG_URL` / `AI_INTERNAL_TOKEN` sai ở AI service, hoặc chưa deploy lại |
| `Auth` 401 ở `/api/internal/ai/config` | Token hai bên không khớp |
| Key mới không được dùng | Key đang **Tắt**, hoặc AI service chưa quá 30 giây |
| Lượt truy vấn không tăng | Migration 024 chưa chạy (ghi log thất bại, request vẫn chạy) |
| AI báo 429 ngay | Sinh viên hết hạn mức ngày — tăng hạn mức hoặc đặt 0 |
| Tất cả key hỏng sau khi đổi secret | Giải mã thất bại — thêm lại key hoặc khôi phục `AI_KEYS_SECRET` cũ |

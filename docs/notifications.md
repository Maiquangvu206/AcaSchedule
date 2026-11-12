# Thông báo hệ thống

Admin gửi thông báo tới **toàn bộ sinh viên**. Mỗi lần sinh viên vào trang, một
lớp thông báo (layer) hiện lên với nút **X** để đóng.

---

## 1. Phía admin — trang "Thông báo"

Đường dẫn: **Quản trị → Thông báo** (`/admin/notifications`).

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `Tiêu đề` | ✔ | Dòng tiêu đề của lớp thông báo (tối đa 200 ký tự) |
| `Nội dung` | ✔ | Nội dung thông báo, giữ nguyên xuống dòng (tối đa 5000 ký tự) |
| `Mức độ` | | `Thông tin` / `Thành công` / `Cảnh báo` / `Lỗi` — quyết định màu của lớp thông báo |
| `Ngày hết hạn` | | Không điền = hiện mãi. Có ngày = tự ẩn khi quá hạn |
| `Hiện ngay với sinh viên` | | Bỏ tick = tạo ở trạng thái ẩn |

Thao tác trên danh sách:

| Nút | Tác dụng |
|---|---|
| **Sửa** | Sửa tiêu đề / nội dung / mức độ / ngày hết hạn |
| **Ẩn** / **Hiện** | Tắt hoặc bật thông báo mà không cần xoá |
| **Xoá** | Xoá vĩnh viễn |

---

## 2. Phía sinh viên — lớp thông báo

Lớp thông báo nằm trên cùng màn hình (overlay), hiện **một lần cho mỗi phiên
đăng nhập**:

- Hiện ngay sau khi đăng nhập; **chuyển trang, chuyển tab hay tải lại trang
  đều không hiện lại** trong cùng phiên trình duyệt.
- **Đăng nhập lại** (hoặc mở phiên trình duyệt mới) thì thông báo hiện một lần nữa.
- Hiện **một thông báo một**; có nhiều thông báo thì đóng cái hiện tại thì cái
  tiếp theo hiện tiếp (góc dưới hiển thị *"Còn N thông báo"*).
- Đóng bằng **nút X** (góc trên bên phải), nút **Đã hiểu**, hoặc phím `Esc`.
- Thông báo đã bị admin ẩn hoặc quá hạn sẽ không xuất hiện.

---

## 3. API

### Người dùng (cần đăng nhập)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| `GET` | `/api/notifications` | Thông báo còn hiệu lực (bật + chưa quá hạn) |

### Quản trị (cần role `admin`)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| `GET` | `/api/admin/notifications` | Toàn bộ thông báo, kể cả đã ẩn / quá hạn |
| `POST` | `/api/admin/notifications` | Tạo thông báo |
| `PATCH` | `/api/admin/notifications/:id` | Sửa / bật / ẩn / đặt hạn dùng |
| `DELETE` | `/api/admin/notifications/:id` | Xoá thông báo |

Thân request khi tạo:

```json
{
  "title": "Nghỉ lễ kỷ niệm 100 năm trường",
  "message": "Nhà trường nghỉ lễ từ 20/10 đến 22/10.",
  "level": "warning",
  "isActive": true,
  "expiresAt": null
}
```

`level` chỉ nhận `info | success | warning | error`. `expiresAt` là chuỗi ISO
(`null` = không hết hạn).

> Endpoint cho người dùng **không** trả về email người tạo — chỉ trang quản trị
> mới thấy trường `createdByEmail`.

---

## 4. Cơ sở dữ liệu

Bảng `system_notifications` (migration `028_system_notifications.sql`):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `uuid` | Khóa chính |
| `title` | `text` | Không được rỗng |
| `message` | `text` | Không được rỗng |
| `level` | `text` | `info \| success \| warning \| error` |
| `is_active` | `boolean` | Admin bấm "Ẩn" → `false` |
| `expires_at` | `timestamptz` | `null` = không hết hạn |
| `created_by` | `uuid` | Admin đã tạo (xoá tài khoản → `null`) |
| `created_at` / `updated_at` | `timestamptz` | Mốc thời gian |

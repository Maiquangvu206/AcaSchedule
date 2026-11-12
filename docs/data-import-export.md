# Nhập & xuất dữ liệu hàng loạt (CSV)

Trang **Nhập & xuất** (`/admin/data`) giúp admin nhập liệu mà không phải
cấu hình từng bản ghi một. Mọi thứ dùng **CSV mở được bằng Excel** (UTF-8
có BOM nên tiếng Việt hiển thị đúng).

---

## 1. Bảng điểm

### Xuất

Bấm **"Tải file mẫu (CSV)"** để tải toàn bộ bảng điểm hiện có. Mở bằng Excel,
sửa/xoá dòng rồi nhập lại — hệ thống chỉ cập nhật những dòng có thay đổi.

| Cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `MSSV` | ✔ (hoặc `Email`) | Định danh sinh viên |
| `Họ tên` | | Chỉ để đọc, không dùng để tìm sinh viên |
| `Email` | ✔ (nếu không có MSSV) | Định danh sinh viên |
| `Mã ngành` | | Ngành chính của sinh viên (để đối chiếu) |
| `Mã môn` | ✔ | Mã môn học — **tự tạo mới** nếu chưa có |
| `Tên môn` | | Dùng khi tạo mới môn |
| `Tín chỉ` | ✔ nếu môn mới | Số tín chỉ (môn đã có thì giữ nguyên) |
| `Học kỳ` | ✔ | Mã học kỳ, ví dụ `2025-1` hoặc `HK1 2025-2026` |
| `Lần học` | | Mặc định `1`; lần học lại dùng `2`, `3`… |
| `Điểm quá trình` | | 0–10 |
| `Điểm thi` | | 0–10 |
| `Điểm hệ 10` / `Điểm chữ` / `Điểm hệ 4` | | Cột **xem trước**, hệ thống tự tính lại khi nhập |
| `Tính vào CPA` | | Cột xem trước, hệ thống tự tính lại |

Quy tắc:

- `Điểm quá trình` và `Điểm thi` phải **có cả hai** hoặc **trống cả hai**
  (trống = môn đang chờ điểm).
- Lượt đã tồn tại (cùng sinh viên + môn + học kỳ + lần học) sẽ được **cập nhật
  điểm**, không tạo bản ghi trùng.
- Điểm hệ 4 / điểm chữ được tính theo **thang điểm hiện tại** và **tỉ lệ
  process/final của ngành chính** — giống hệt trang bảng điểm.
- Lượt nào được tính vào CPA được tính lại tự động sau khi nhập.

### Nhập

1. Bấm **"Kiểm tra trước (không ghi)"** → hệ thống báo cáo sẽ thêm/sửa/bỏ qua dòng nào
   mà **không** ghi vào database (kể cả khoa / ngành / môn mới — chỉ là "sẽ tạo mới").
2. Nếu không có lỗi, bấm **"Chọn file CSV để nhập"** để ghi thật.

Báo cáo gồm: tổng dòng, thêm mới, cập nhật, không đổi, bỏ qua, kèm **dòng lỗi**
(đánh số theo file) và các lưu ý (ví dụ "đã tạo mới môn CSE392").

> Báo cáo của bước **Kiểm tra trước** và của lần **nhập thật** luôn giống nhau:
> cùng một file → cùng số dòng thêm mới / cập nhật / không đổi / bỏ qua.

---

## 2. Chương trình đào tạo

### Xuất

Bấm **"Tải file mẫu (CSV)"** (có thể lọc theo từng ngành).

| Cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `Mã khoa`, `Tên khoa` | | Khoa sẽ được **tạo mới** nếu chưa có |
| `Mã ngành`, `Tên ngành` | ✔ | Ngành sẽ được **tạo mới** nếu chưa có |
| `Mã môn`, `Tên môn` | ✔ | Môn sẽ được **tạo mới** nếu chưa có |
| `Tín chỉ` | ✔ nếu môn mới | Số tín chỉ |
| `Bắt buộc` | | `Có` / `Không` |
| `Học kỳ` | | Học kỳ trong chương trình (1–20) |
| `Tính điểm` | | `Có` = tính vào điểm, `Không` = chỉ tính học phí |
| `Tỉ lệ Process`, `Tỉ lệ Final` | | Tổng phải bằng 1 (ví dụ `0.4` + `0.6`) |

### Nhập

Cùng quy trình: **Kiểm tra trước** → xem báo cáo → **Nhập thật**.

- Môn đã có trong hệ thống sẽ **giữ nguyên** thông tin (tên, tín chỉ); chỉ cấu
  hình trong chương trình (bắt buộc, học kỳ, tỉ lệ) được cập nhật.
- Nếu môn đã tồn tại nhưng file có `Tín chỉ` khác → hệ thống giữ giá trị cũ và ghi
  lưu ý.

---

## 3. Cấu hình lịch học

### Xuất

Bấm **"Tải file mẫu (CSV)"** (có thể lọc theo từng học kỳ).

| Cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `Học kỳ` | ✔ | Mã học kỳ dùng chung, ví dụ `HK1-2026` |
| `Mã môn` | ✔ | Môn **phải có sẵn** — không tự tạo môn; hãy nhập Chương trình đào tạo trước |
| `Mã lớp` | ✔ | Mã lớp học phần; cùng học kỳ + mã lớp = **cập nhật** thay vì báo trùng |
| `Số buổi` | | `1` hoặc `2` (mặc định 1) |
| `Thứ` | ✔ | `2`–`7` (2 = Thứ 2); nhận cả chữ `Thứ 2` |
| `Tiết bắt đầu`, `Tiết kết thúc` | ✔ | 1–12; kết thúc ≥ bắt đầu |
| `Loại lớp` | | `LT` (lý thuyết) / `TH` (thực hành) |
| `Ngày bắt đầu`, `Ngày kết thúc` | | `yyyy-mm-dd` hoặc `dd/mm/yyyy` |
| `Thứ buổi 2`, `Tiết buổi 2` | ✔ nếu lớp 2 buổi | Lịch 2 buổi chỉ nhận cặp **2-5, 3-6 hoặc 4-7** |
| `Phòng`, `Giảng viên`, `Sĩ số` | | Tuỳ chọn |
| `Tuần nghỉ` | | Danh sách số tuần (tính từ tuần đầu học kỳ), ví dụ `2;3` |
| `Bị huỷ` | | `Có` / `Không` |

### Nhập

Cùng quy trình: **Kiểm tra trước** → xem báo cáo → **Nhập thật**.

- Dòng lỗi (thứ không hợp lệ, lớp 2 buổi sai cặp, môn chưa tồn tại…) bị **bỏ qua
  nguyên dòng** — không để lại dữ liệu mồ côi.
- `linked_section_id` (liên kết lớp thực hành với lớp lý thuyết) **không nằm
  trong file**: cập nhật lớp hiện có giữ nguyên liên kết cũ.

---

## 4. Gợi ý nhanh

| Nhu cầu | Làm gì |
|---|---|
| Nhập điểm hàng loạt | Xuất bảng điểm → điền `MSSV`, `Mã môn`, `Học kỳ`, điểm → Kiểm tra trước → Nhập |
| Nhập môn học mới kèm chương trình | Xuất chương trình đào tạo → điền `Mã ngành`, `Mã môn`, `Tín chỉ` → Kiểm tra trước → Nhập |
| Sửa điểm của một nhóm | Xuất bảng điểm → lọc/sửa trong Excel → Kiểm tra trước → Nhập |
| Đổi cấu hình môn trong chương trình | Xuất chương trình → sửa `Tính điểm` / `Tỉ lệ` → Kiểm tra trước → Nhập |
| Sắp lịch cả học kỳ một lúc | Xuất cấu hình lịch học → điền `Học kỳ`, `Mã môn`, `Mã lớp`, `Thứ`, tiết → Kiểm tra trước → Nhập |
| Dời phòng / đổi giảng viên hàng loạt | Xuất lịch học → sửa cột `Phòng` / `Giảng viên` → Kiểm tra trước → Nhập |

### Lưu ý kỹ thuật

- File nhập có thể phân cách cột bằng `,` (mặc định), `;` (Excel Việt Nam) hoặc
  Tab — hệ thống tự nhận diện.
- Tên cột không phân biệt hoa/thường và không dấu: `Mã môn`, `Ma mon`, `MAMON`
  đều được.
- Chỉ sinh viên đã có tài khoản mới nhập được điểm; sinh viên chưa có sẽ báo lỗi
  dòng đó (cần tạo tài khoản ở trang *Quản lý tài khoản* trước).

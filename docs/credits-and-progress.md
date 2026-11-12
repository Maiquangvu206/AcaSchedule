# Tín chỉ & tiến độ tốt nghiệp

Hệ thống phân biệt rõ **ba** loại tín chỉ. Nhầm lẫn giữa chúng là nguồn
sai số phổ biến nhất, nên tài liệu này ghi rõ từng khái niệm.

## 1. Tín chỉ tích lũy (`creditsEarned`)

*Tín chỉ của các môn **đã đạt** và **tính vào CPA**, mỗi môn đếm **một lần**.*

- Môn trượt (F) → **không** tính.
- Môn học lại: chỉ lượt đạt được tính (lượt F cũ bị thay thế).
- Môn cải thiện: giữ lượt điểm cao nhất, vẫn đếm **một** lần.
- Môn "chỉ tính học phí" (`calculate_grade = false`) → **không** tính.

Đây là con số hiển thị ở thẻ **"Tín chỉ tích lũy"** (trang Bảng điểm & Tổng quan).

## 2. Tín chỉ đã học (`creditsStudied`)

*Tín chỉ của **mọi lượt đã học** — kể cả môn trượt và môn học lại.*

- Mỗi lượt học đếm một lần → học lại cộng thêm.
- Môn trượt vẫn tính.
- Môn "chỉ tính học phí" cũng tính (đã học là đã học).

Đây là con số hiển thị ở thẻ **"Tín chỉ đã học"**, và **trùng với cơ sở tính
học phí** (học phí thu theo từng lượt đăng ký).

## 3. Tín chỉ tính CPA (`creditsAttempted`)

*Mẫu số của công thức CPA — mỗi môn tính CPA đếm một lần, kể cả môn trượt.*

```
CPA = Σ(điểm hệ 4 × tín chỉ của lượt được tính) / Σ(tín chỉ của lượt được tính)
```

Không hiển thị trực tiếp cho sinh viên nhưng là nền tảng của mọi phép tính CPA.

---

## Số tín chỉ tối thiểu của mỗi ngành

Không phải ngành nào cũng bắt sinh viên học **hết** mọi môn trong chương trình
đào tạo, nên mỗi ngành có một **mốc tối thiểu** do admin setup.

### Admin thiết lập ở đâu

Trang **Ngành & khoa** (`/admin/majors`) → mục **"Cơ cấu khoa và ngành"** →
mỗi ngành có ô **"Tín chỉ tối thiểu"**.

- **Để trống** → dùng tổng tín chỉ của các môn *tính điểm* trong chương trình
  (tức là hành vi cũ, không đổi gì).
- Nhập số → mốc cố định cho ngành đó.
- Migration `025_major_minimum_credits.sql` tự điền mốc ban đầu bằng tổng tín
  chỉ chương trình, nên database cũ không bị đổi hành vi.

Cột lưu trong bảng `majors.minimum_credits` (`NULL` = dùng tổng chương trình).

### Sinh viên xem ở đâu

- Trang **Tổng quan**: mục **"Tiến độ tích lũy tín chỉ"** — một thanh cho mỗi
  ngành (chính/phụ).
- Trang **Bảng điểm**: card **"Tiến độ so với mốc tối thiểu"** trong từng ngành.

### Quy tắc so sánh

| Điều kiện | Kết quả |
|---|---|
| Tín chỉ đã đạt < mốc | Thiếu N tín chỉ, thanh màu xanh |
| Tín chỉ đã đạt ≥ mốc | Đạt yêu cầu, thanh xanh lá, ghi rõ vượt bao nhiêu |
| Tín chỉ đã đạt > mốc | **Vẫn được** — không bị cắt/phạt |

Phép so sánh **chỉ dùng tín chỉ tính điểm đã đạt**:

- Môn trượt không tính vào tiến độ.
- Môn "chỉ tính học phí" không tính vào tiến độ.
- Môn học lại chỉ đếm một lần.

> Với sinh viên học hai ngành, mỗi ngành có thanh riêng. Môn học chung giữa
> hai ngành xuất hiện ở **cả hai** thanh (giống bảng thống kê từng ngành), nhưng
> học phí vẫn chỉ thu một lần.

---

## Thứ tự học kỳ

Danh sách và biểu đồ học kỳ được sắp xếp theo **thời gian thật**, không phải
theo chuỗi ký tự. Hàm `semesterSortKey` (frontend) và `compareSemesters`
(backend) hỗ trợ ba dạng mã:

| Dạng | Ví dụ | Kết quả |
|---|---|---|
| `HK<k> <năm>` | `HK1 2024-2025` | `[2024, 1]` |
| `<năm>-<năm>-<k>` | `2024-2025-1` | `[2024, 1]` |
| `<năm>-<k>` | `2024-1`, `2025-10` | `[2024, 1]`, `[2025, 10]` |

Dạng `2025-10` được xử lý đúng (không bị nhầm thành `2025-1`).

---

## Tuần nghỉ của lớp học phần

Không phải lớp nào cũng học đủ mọi tuần. Cả **lý thuyết** lẫn **thực hành**
đều có thể nghỉ ở những tuần cụ thể.

### Admin thiết lập ở đâu

Trang **Lịch học theo kỳ** (`/admin/schedule`) → khối **"Tuần nghỉ (không học)"**
trong form thêm/sửa lớp học phần.

- Tuần được đánh số từ **1**, tính từ tuần chứa ngày bắt đầu học kỳ
  (`semesters.start_date`, set ở trang *Học kỳ*). Nếu học kỳ chưa có ngày bắt
  đầu thì lấy ngày bắt đầu của chính lớp đó.
- Bấm vào số tuần để bật/tắt. Không chọn tuần nào = học đều mọi tuần.
- Cột "Lịch học trong tuần" trong bảng bên dưới hiện `Nghỉ tuần: 3, 7`.

### Số buổi mỗi tuần

- **Lý thuyết**: 1 hoặc 2 buổi/tuần (cặp ngày được hỗ trợ: 2–5, 3–6, 4–7).
- **Thực hành**: cũng 1 hoặc 2 buổi/tuần. Lớp thực hành liên kết được tạo
  tự động từ lớp lý thuyết (`sectionCode` + `-TH`), nên khi bật "Tạo lớp thực
  hành liên kết" thì chọn thêm số buổi và lịch buổi 2.

### Sinh viên thấy gì

- Lớp đang nghỉ ở tuần hiện tại **không xuất hiện** trên lịch tuần.
- Trong danh sách lớp bên trái, lớp đó được làm mờ kèm nhãn **"Nghỉ tuần này"**
  (vẫn chọn được để đăng ký cả học kỳ).
- Lớp nghỉ **không gây xung đột** với lớp khác trong tuần đó.

Dữ liệu lưu ở `course_sections.skipped_weeks` (JSONB, mảng số tuần).

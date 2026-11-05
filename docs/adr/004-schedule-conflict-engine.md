# ADR-004: Conflict Detection Engine cho Schedule Planner

## Trạng thái

Accepted

## Ngữ cảnh

Cần phát hiện xung đột lịch học khi sinh viên chọn nhiều lớp học phần. Không được phép hai buổi học cùng thứ và cùng khoảng tiết.

## Quyết định

Engine thuần (pure function) trong TypeScript:
- Chỉ so sánh các buổi cùng thứ (day_of_week)
- Khoảng tiết là inclusive [startPeriod, endPeriod]
- Kề tiết (1–3 và 4–6) không xung đột
- Giao đúng 1 tiết (1–3 và 3–5) có xung đột
- Lớp đã huỷ (is_cancelled) bị loại khỏi so sánh
- Lịch cá nhân gắn sectionId của chính lớp đang chọn không bị so sánh với chính nó

## Quyết định thay thế

- **Không dùng interval tree**: over-engineering cho số lượng lớp nhỏ (< 20)
- **Không lưu xung đột trong DB**: tính toán động khi simulate

## Hệ quả

### Tích cực
- Thuần túy, dễ test, không phụ thuộc DB
- Dễ hiểu, dễ bảo trì

### Tiêu cực
- O(n²) với số lượng lớp, đủ cho < 50 lớp

## Xác nhận

- 12 unit tests cho conflict engine
- Kèm tiết không xung đột
- Giao 1 tiết có xung đột
- Lớp đã huỷ bị bỏ qua

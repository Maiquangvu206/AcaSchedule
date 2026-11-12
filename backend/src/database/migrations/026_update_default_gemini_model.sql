-- 026_update_default_gemini_model.sql — cập nhật model AI mặc định.
--
-- `gemini-1.5-flash` (Google) và `google/gemini-2.0-flash-001` (OpenRouter) đã
-- bị ngừng hỗ trợ nên mọi lượt gọi sẽ trả 404.
-- Khi bật cấu hình từ xa (AI service lấy model trong DB), giá trị này sẽ ghi đè
-- model đang chạy tốt trong biến môi trường nên cần sửa.
--
-- Chỉ những dòng còn giữ model mặc định cũ mới được đổi; model do admin chọn
-- trong trang quản trị được giữ nguyên.

UPDATE ai_settings
   SET gemini_model = 'gemini-3.5-flash',
       updated_at = now()
 WHERE gemini_model IN ('gemini-1.5-flash', 'gemini-2.0-flash');

UPDATE ai_settings
   SET openrouter_model = 'google/gemini-3.5-flash',
       updated_at = now()
 WHERE openrouter_model = 'google/gemini-2.0-flash-001';

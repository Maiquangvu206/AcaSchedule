# Seed data

`backend/src/database/seed.ts` loads idempotent demo data:

- 9 mốc quy đổi Hệ 10 → điểm chữ → Hệ 4
- 6 môn học demo
- Tài khoản admin + sinh viên demo
- Bảng điểm mẫu, gồm một lượt học lại F không tính CPA

Run with `npm run seed` (dev) or `node dist/database/seed.js` (compiled).
Credentials come from `SEED_ADMIN_*` / `SEED_STUDENT_*` environment variables.

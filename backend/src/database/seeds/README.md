# Seed data

`backend/src/database/seed.ts` loads minimal, idempotent seed data:

- 9 mốc quy đổi Hệ 10 → điểm chữ → Hệ 4 (`grade_scales`)
- 12 khung tiết học (`period_slots`)
- Duy nhất tài khoản admin (từ biến môi trường `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)

No business/demo data is seeded. Students, semesters, subjects, tuition,
enrolments, … are created by the admin through the UI.

Run with `npm run seed` (dev) or `node dist/database/seed.js` (compiled).

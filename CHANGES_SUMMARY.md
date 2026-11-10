# Changes Summary: Add calculate_grade Configuration

## Purpose
Add configuration so admins can control whether subjects calculate grades (diểm) or only handle tuition fees.

## Backend Changes (backend/src/modules/admin/curriculum.routes.ts)

1. **Added `calculateGrade` field to assignmentSchema** (default `true`):
   ```typescript
   calculateGrade: z.boolean().default(true),
   ```

2. **Updated INSERT/UPDATE query** for `POST /api/admin/majors/:majorId/subjects`:
   - Added `calculate_grade` column to the `curriculum_subjects` table
   - Returns `calculateGrade` in the response

3. **Updated GET /majors/:majorId/subjects**:
   - Now returns `calculate_grade AS "calculateGrade"` field
   - Included in the subject data sent to frontend

4. **Updated GET /majors**:
   - Added `count(cs.id) FILTER (WHERE cs.calculate_grade)::int AS "gradedSubjectCount"`
   - Returns count of subjects that calculate grades per major

## Frontend Changes (frontend/src/pages/AdminMajors.tsx)

1. **Added 'Tính điểm' column** in the curriculum subject table:
   - Header: "Tính điểm" (new column after "Bộ môn quản lý")
   - Row data: Shows "Tính điểm" (blue text) or "Chỉ học phí" (red text) based on `calculateGrade` value

2. **Display logic**:
   - `calculateGrade = true`: shows "Tính điểm" in slate-600 color
   - `calculateGrade = false`: shows "Chỉ học phí" in rose-600 color

## Database Migration Required

Run this SQL on the PostgreSQL database:
```sql
ALTER TABLE curriculum_subjects ADD COLUMN calculate_grade boolean DEFAULT true;
```

## Usage

After migration and redeploy:

1. **Creating/editing curriculum subjects**:
   - When admin adds a subject to a major via `POST /api/admin/majors/:majorId/subjects`
   - The `calculateGrade` field defaults to `true` (backward compatible)
   - Can be set to `false` if the subject should only handle tuition fees, not calculate grades

2. **Viewing on AdminMajors page**:
   - Each subject shows "Tính điểm" or "Chỉ học phí"
   - Major count shows total subjects + graded subject count

3. **GPA Calculation**:
   - Subjects with `calculate_grade = true`: attempts contribute to GPA (existing behavior)
   - Subjects with `calculate_grade = false`: attempts are recorded but do not contribute to CPA/GPA

## Example

| Major | Subject | Tính điểm | Graded Count |
|-------|---------|-----------|-------------|
| HTTT | INT2208 | Tính điểm | 1/1 |
| TOAN | MA101 | Chỉ học phí | 0/1 |
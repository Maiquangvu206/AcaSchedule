-- =====================================================================
-- AcaSchedule — kiem tra database da du schema chua
-- Chay tren dung database ma backend dang ket noi (Render -> Environment
-- -> DATABASE_URL). Ket qua rong = schema day du.
-- Moi dong tra ve = cot/bang dang THIEU.
-- =====================================================================

WITH expected(tbl, col) AS (
  VALUES
    -- 002
    ('subjects', 'process_weight'),
    ('subjects', 'final_weight'),
    -- 003
    ('period_slots', 'period'),
    ('course_sections', 'section_code'),
    ('course_sections', 'day_of_week'),
    ('course_sections', 'start_period'),
    ('course_sections', 'end_period'),
    ('schedule_items', 'title'),
    ('schedule_items', 'semester'),
    ('schedule_items', 'section_id'),
    -- 004
    ('subject_documents', 'original_name'),
    ('document_votes', 'value'),
    -- 005 + 011
    ('tuition_fees', 'semester'),
    ('tuition_fees', 'fee_per_credit'),
    ('tuition_fees', 'major_id'),
    -- 006
    ('audit_logs', 'action'),
    -- 007
    ('majors', 'code'),
    ('curriculum_subjects', 'is_required'),
    ('curriculum_subjects', 'semester_no'),
    ('user_majors', 'is_primary'),
    -- 008 + 009
    ('course_sections', 'class_type'),
    ('course_sections', 'start_date'),
    ('course_sections', 'end_date'),
    ('course_sections', 'second_day_of_week'),
    ('course_sections', 'second_start_period'),
    ('course_sections', 'second_end_period'),
    ('course_sections', 'meeting_count'),
    ('course_sections', 'linked_section_id'),
    -- 012
    ('departments', 'code'),
    ('majors', 'department_id'),
    -- 013 -> 015
    ('users', 'phone'),
    ('users', 'student_code'),
    ('users', 'is_active'),
    ('users', 'must_change_password'),
    -- 016 -> 018
    ('schedule_items', 'start_time'),
    ('schedule_items', 'end_time'),
    ('schedule_items', 'week_start'),
    -- 019
    ('registration_configs', 'is_open'),
    -- 020
    ('student_study_plan', 'semester_no'),
    -- 021
    ('subjects', 'managing_unit'),
    -- 022
    ('semesters', 'sort_no'),
    -- 023
    ('curriculum_subjects', 'calculate_grade'),
    ('curriculum_subjects', 'process_weight'),
    ('curriculum_subjects', 'final_weight'),
    -- 024
    ('users', 'ai_daily_limit'),
    ('ai_settings', 'daily_limit_per_user'),
    ('ai_provider_keys', 'encrypted_key'),
    ('ai_usage_logs', 'provider'),
    -- 025
    ('majors', 'minimum_credits'),
    -- 027
    ('course_sections', 'skipped_weeks'),
    -- 028
    ('system_notifications', 'title'),
    ('system_notifications', 'message'),
    ('system_notifications', 'level'),
    ('system_notifications', 'is_active'),
    ('system_notifications', 'expires_at'),
    -- 029
    ('password_reset_codes', 'code_hash'),
    ('password_reset_codes', 'expires_at'),
    ('password_reset_codes', 'attempts'),
    ('password_reset_codes', 'used_at'),
    -- 030
    ('subject_documents', 'is_hidden'),
    ('subject_documents', 'is_locked')
)
SELECT e.tbl AS table_name, e.col AS missing_column
  FROM expected e
  LEFT JOIN information_schema.columns c
         ON c.table_schema = 'public'
        AND c.table_name = e.tbl
        AND c.column_name = e.col
 WHERE c.column_name IS NULL
 ORDER BY 1, 2;

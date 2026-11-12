import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { pool } from '../../database/pool';

export const statsRouter = Router();

/** Tổng quan số liệu hệ thống cho trang "Trang tổng quan" của admin. */
statsRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query<{
    students: string;
    subjects: string;
    documents: string;
    accounts: string;
    majors: string;
    departments: string;
    course_sections: string;
    enrollments: string;
  }>(
    `SELECT
       (SELECT count(*) FROM users WHERE role = 'student') AS students,
       (SELECT count(*) FROM subjects WHERE is_active = true) AS subjects,
       (SELECT count(*) FROM subject_documents) AS documents,
       (SELECT count(*) FROM users) AS accounts,
       (SELECT count(*) FROM majors) AS majors,
       (SELECT count(*) FROM departments) AS departments,
       (SELECT count(*) FROM course_sections) AS course_sections,
       (SELECT count(*) FROM student_enrollments) AS enrollments`,
  );
  const row = result.rows[0];
  res.json({
    students: Number(row.students),
    subjects: Number(row.subjects),
    documents: Number(row.documents),
    accounts: Number(row.accounts),
    majors: Number(row.majors),
    departments: Number(row.departments),
    courseSections: Number(row.course_sections),
    enrollments: Number(row.enrollments),
  });
}));

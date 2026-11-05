import type { PoolClient } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { hashPassword } from '../lib/password';
import { pool } from './pool';

interface GradeScaleSeed {
  minScore: number;
  letter: string;
  grade4: number;
  isPass: boolean;
}

interface SubjectSeed {
  code: string;
  name: string;
  credits: number;
  block: string;
}

const GRADE_SCALES: GradeScaleSeed[] = [
  { minScore: 9.0, letter: 'A+', grade4: 4.0, isPass: true },
  { minScore: 8.5, letter: 'A', grade4: 4.0, isPass: true },
  { minScore: 8.0, letter: 'B+', grade4: 3.5, isPass: true },
  { minScore: 7.0, letter: 'B', grade4: 3.0, isPass: true },
  { minScore: 6.5, letter: 'C+', grade4: 2.5, isPass: true },
  { minScore: 5.5, letter: 'C', grade4: 2.0, isPass: true },
  { minScore: 5.0, letter: 'D+', grade4: 1.5, isPass: true },
  { minScore: 4.0, letter: 'D', grade4: 1.0, isPass: true },
  { minScore: 0.0, letter: 'F', grade4: 0.0, isPass: false },
];

const SUBJECTS: SubjectSeed[] = [
  { code: 'INT2204', name: 'Lập trình hướng đối tượng', credits: 3, block: 'Công nghệ phần mềm' },
  { code: 'INT2208', name: 'Công nghệ phần mềm', credits: 3, block: 'Công nghệ phần mềm' },
  { code: 'MAT1091', name: 'Giải tích 1', credits: 4, block: 'Toán' },
  { code: 'MAT1092', name: 'Giải tích 2', credits: 4, block: 'Toán' },
  { code: 'PHY1100', name: 'Vật lý đại cương', credits: 3, block: 'Khoa học tự nhiên' },
  { code: 'ENG1101', name: 'Tiếng Anh B1', credits: 3, block: 'Ngoại ngữ' },
];

async function seedGradeScales(client: PoolClient): Promise<void> {
  for (const scale of GRADE_SCALES) {
    await client.query(
      `INSERT INTO grade_scales (min_score_10, letter_grade, grade_4, is_pass)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (min_score_10) DO UPDATE
         SET letter_grade = EXCLUDED.letter_grade,
             grade_4 = EXCLUDED.grade_4,
             is_pass = EXCLUDED.is_pass`,
      [scale.minScore, scale.letter, scale.grade4, scale.isPass],
    );
  }
}

async function seedSubjects(client: PoolClient): Promise<void> {
  for (const subject of SUBJECTS) {
    await client.query(
      `INSERT INTO subjects (code, name, credits, knowledge_block)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             credits = EXCLUDED.credits,
             knowledge_block = EXCLUDED.knowledge_block`,
      [subject.code, subject.name, subject.credits, subject.block],
    );
  }
}

async function upsertUser(
  client: PoolClient,
  input: { email: string; password: string; fullName: string; role: 'admin' | 'student' },
): Promise<string> {
  const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    input.email,
  ]);

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.email, await hashPassword(input.password), input.fullName, input.role],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Failed to seed user ${input.email}`);
  }
  return id;
}

interface EnrollmentSeed {
  code: string;
  semester: string;
  processScore: number;
  finalScore: number;
  letter: string;
  grade4: number;
  counted: boolean;
  attempt: number;
}

interface CourseSectionSeed {
  code: string;
  section: string;
  semester: string;
  day: number;
  start: number;
  end: number;
  room: string;
  lecturer: string;
  cancelled?: boolean;
}

const DEMO_SECTIONS: CourseSectionSeed[] = [
  { code: 'INT2204', section: 'INT2204-01', semester: '2025-2', day: 2, start: 1, end: 3, room: 'A101', lecturer: 'TS. Nguyễn Văn A' },
  { code: 'INT2204', section: 'INT2204-02', semester: '2025-2', day: 4, start: 6, end: 8, room: 'A102', lecturer: 'TS. Nguyễn Văn A' },
  { code: 'INT2208', section: 'INT2208-01', semester: '2025-2', day: 3, start: 1, end: 3, room: 'B201', lecturer: 'ThS. Trần Thị B' },
  { code: 'INT2208', section: 'INT2208-02', semester: '2025-2', day: 5, start: 6, end: 8, room: 'B202', lecturer: 'ThS. Trần Thị B' },
  { code: 'INT2208', section: 'INT2208-03', semester: '2025-2', day: 7, start: 1, end: 3, room: 'B203', lecturer: 'ThS. Trần Thị B', cancelled: true },
  { code: 'INT2208', section: 'INT2208-04', semester: '2025-2', day: 2, start: 3, end: 5, room: 'B204', lecturer: 'ThS. Trần Thị B' },
  { code: 'MAT1092', section: 'MAT1092-01', semester: '2025-2', day: 2, start: 4, end: 6, room: 'C301', lecturer: 'PGS. Lê Văn C' },
  { code: 'MAT1092', section: 'MAT1092-02', semester: '2025-2', day: 6, start: 1, end: 3, room: 'C302', lecturer: 'PGS. Lê Văn C' },
  { code: 'ENG1101', section: 'ENG1101-01', semester: '2025-2', day: 3, start: 4, end: 5, room: 'D401', lecturer: 'Cô Phạm Thu D' },
  { code: 'ENG1101', section: 'ENG1101-02', semester: '2025-2', day: 5, start: 1, end: 3, room: 'D402', lecturer: 'Cô Phạm Thu D' },
  { code: 'ENG1101', section: 'ENG1101-03', semester: '2025-2', day: 2, start: 9, end: 10, room: 'D403', lecturer: 'Cô Phạm Thu D' },
  { code: 'PHY1100', section: 'PHY1100-01', semester: '2025-2', day: 4, start: 1, end: 3, room: 'E501', lecturer: 'TS. Hoàng Văn E' },
  { code: 'PHY1100', section: 'PHY1100-02', semester: '2025-2', day: 6, start: 6, end: 8, room: 'E502', lecturer: 'TS. Hoàng Văn E' },
];

const DEMO_ENROLLMENTS: EnrollmentSeed[] = [
  { code: 'MAT1091', semester: '2024-1', processScore: 8.0, finalScore: 7.2, letter: 'B', grade4: 3.0, counted: true, attempt: 1 },
  { code: 'INT2204', semester: '2024-1', processScore: 9.0, finalScore: 8.0, letter: 'B+', grade4: 3.5, counted: true, attempt: 1 },
  { code: 'ENG1101', semester: '2024-1', processScore: 8.5, finalScore: 7.0, letter: 'B', grade4: 3.0, counted: true, attempt: 1 },
  { code: 'PHY1100', semester: '2024-1', processScore: 6.0, finalScore: 5.2, letter: 'D+', grade4: 1.5, counted: true, attempt: 1 },
  // Học lại: lượt F cũ không tính CPA.
  { code: 'MAT1092', semester: '2024-2', processScore: 3.0, finalScore: 3.5, letter: 'F', grade4: 0.0, counted: false, attempt: 1 },
  { code: 'MAT1092', semester: '2025-1', processScore: 6.5, finalScore: 6.5, letter: 'C+', grade4: 2.5, counted: true, attempt: 2 },
];

async function seedDemoEnrollments(client: PoolClient, studentId: string): Promise<void> {
  for (const enrollment of DEMO_ENROLLMENTS) {
    const subject = await client.query<{ id: string }>(
      'SELECT id FROM subjects WHERE code = $1',
      [enrollment.code],
    );
    const subjectId = subject.rows[0]?.id;
    if (!subjectId) {
      throw new Error(`Subject ${enrollment.code} missing during seed`);
    }

    await client.query(
      `INSERT INTO student_enrollments
         (student_id, subject_id, semester, process_score, final_score,
          letter_grade, grade_4, is_counted_in_cpa, attempt_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (student_id, subject_id, attempt_no) DO NOTHING`,
      [
        studentId,
        subjectId,
        enrollment.semester,
        enrollment.processScore,
        enrollment.finalScore,
        enrollment.letter,
        enrollment.grade4,
        enrollment.counted,
        enrollment.attempt,
      ],
    );
  }
}

async function seedCourseSections(client: PoolClient): Promise<void> {
  for (const section of DEMO_SECTIONS) {
    const subject = await client.query<{ id: string }>(
      'SELECT id FROM subjects WHERE code = $1',
      [section.code],
    );
    const subjectId = subject.rows[0]?.id;
    if (!subjectId) {
      throw new Error(`Subject ${section.code} missing during section seed`);
    }

    await client.query(
      `INSERT INTO course_sections
         (subject_id, semester, section_code, day_of_week, start_period, end_period,
          room, lecturer, is_cancelled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (semester, section_code) DO UPDATE
         SET subject_id = EXCLUDED.subject_id,
             day_of_week = EXCLUDED.day_of_week,
             start_period = EXCLUDED.start_period,
             end_period = EXCLUDED.end_period,
             room = EXCLUDED.room,
             lecturer = EXCLUDED.lecturer,
             is_cancelled = EXCLUDED.is_cancelled`,
      [
        subjectId,
        section.semester,
        section.section,
        section.day,
        section.start,
        section.end,
        section.room,
        section.lecturer,
        section.cancelled ?? false,
      ],
    );
  }
}

export async function runSeed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await seedGradeScales(client);
    await seedSubjects(client);
    await seedCourseSections(client);

    const adminId = await upsertUser(client, {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      password: env.SEED_ADMIN_PASSWORD,
      fullName: 'AcaSchedule Admin',
      role: 'admin',
    });
    const studentId = await upsertUser(client, {
      email: env.SEED_STUDENT_EMAIL.toLowerCase(),
      password: env.SEED_STUDENT_PASSWORD,
      fullName: 'Sinh viên Demo',
      role: 'student',
    });

    await seedDemoEnrollments(client, studentId);
    await client.query('COMMIT');

    logger.info(
      {
        admin: env.SEED_ADMIN_EMAIL,
        student: env.SEED_STUDENT_EMAIL,
        adminId,
        studentId,
      },
      'seed data ready',
    );

    if (env.NODE_ENV !== 'production') {
      logger.info(
        `Demo accounts → admin: ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD} | ` +
          `student: ${env.SEED_STUDENT_EMAIL} / ${env.SEED_STUDENT_PASSWORD}`,
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await runSeed();
}

if (require.main === module) {
  main()
    .catch((error) => {
      logger.error({ err: error }, 'seed failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

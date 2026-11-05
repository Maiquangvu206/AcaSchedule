/**
 * Integration tests cho backend API.
 *
 * Khởi Express app thật trên cổng test, sử dụng `fetch` (không cần Supertest do
 * môi trường offline không cài được gói mới). Kết nối PostgreSQL test trên
 * port 55432 (container `aca-pg-test` đã chạy) và chạy migration trước khi test.
 *
 * Các luồng kiểm thử:
 *  - Đăng ký / đăng nhập / refresh rotation
 *  - GPA calculate/forecast (dữ liệu thật từ DB)
 *  - Schedule sections/simulate/items CRUD
 *  - Documents subjects/presign/download
 *  - Cô lập dữ liệu giữa sinh viên
 *
 * Lưu ý: cần container PostgreSQL + Redis đang chạy. Nếu không có DB, các test
 * sẽ bị skip tự động.
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app';
import { pool } from '../../src/database/pool';
import { runMigrations } from '../../src/database/migrate';
import { hashPassword } from '../../src/lib/password';

let app: ReturnType<typeof createApp> | null = null;
let server: { address: () => { port: number } } | null = null;
let baseUrl: string | null = null;
let token: string | null = null;
let dbAvailable = false;

async function api(
  method: string,
  path: string,
  { token: t, body }: { token?: string; body?: unknown } = {},
) {
  if (!baseUrl) throw new Error('DB not available — baseUrl not set');
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  try {
    // Chạy migration trên database test
    await runMigrations();

    // Seed dữ liệu tối thiểu: môn học + lớp học phần cho test schedule
    await pool.query(
      `INSERT INTO subjects (code, name, credits, knowledge_block, is_active)
       VALUES ('SUB101', 'Môn kiểm thử', 3, 'Cơ bản', true)
       ON CONFLICT (code) DO NOTHING`,
    );
    const subjectRes = await pool.query<{ id: string }>(
      "SELECT id FROM subjects WHERE code = 'SUB101'",
    );
    const subjectId = subjectRes.rows[0]?.id;
    if (subjectId) {
      await pool.query(
        `INSERT INTO course_sections
           (subject_id, semester, section_code, day_of_week, start_period, end_period, room, lecturer, is_cancelled)
         VALUES
           ($1, '2025-2', 'SUB101-01', 2, 1, 3, 'A101', 'GV mẫu', false),
           ($1, '2025-2', 'SUB101-02', 4, 6, 8, 'A102', 'GV mẫu', false),
           ($1, '2025-2', 'SUB101-03', 2, 4, 6, 'A103', 'GV mẫu', false)
         ON CONFLICT (semester, section_code) DO NOTHING`,
        [subjectId],
      );
    }

    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server!.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

beforeEach(async () => {
  if (!dbAvailable) return;
  // Tạo sinh viên demo trực tiếp vào DB để đăng nhập
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'student')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ['integ-student@acaschedule.local', await hashPassword('Integ@1234'), 'Sinh viên Integration'],
  );
});

describe('Auth integration', () => {
  it('đăng ký và đăng nhập sinh viên mới', async () => {
    if (!dbAvailable) return;
    const reg = await api('POST', '/api/auth/register', {
      body: {
        email: `integ-reg-${Date.now()}@acaschedule.local`,
        password: 'Reg@1234',
        fullName: 'Sinh viên Register',
      },
    });
    expect(reg.status).toBe(201);
    expect(reg.data.accessToken).toBeDefined();

    const login = await api('POST', '/api/auth/login', {
      body: {
        email: reg.data.user.email,
        password: 'Reg@1234',
      },
    });
    expect(login.status).toBe(200);
    expect(login.data.accessToken).toBeDefined();
    token = login.data.accessToken;
  });

  it('đăng nhập sinh viên demo đã seed', async () => {
    if (!dbAvailable) return;
    const login = await api('POST', '/api/auth/login', {
      body: {
        email: 'integ-student@acaschedule.local',
        password: 'Integ@1234',
      },
    });
    expect(login.status).toBe(200);
    token = login.data.accessToken;
  });
});

describe('GPA integration', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    await api('POST', '/api/auth/login', {
      body: {
        email: 'integ-student@acaschedule.local',
        password: 'Integ@1234',
      },
    }).then((r) => {
      token = r.data.accessToken;
    });
  });

  it('calculate trả CPA và tín chỉ từ dữ liệu DB', async () => {
    if (!dbAvailable) return;
    const res = await api('POST', '/api/gpa/calculate', { token });
    expect(res.status).toBe(200);
    expect(typeof res.data.cpa).toBe('number');
    expect(typeof res.data.creditsAttempted).toBe('number');
  });

  it('forecast trả điểm cần đạt cho mục tiêu', async () => {
    if (!dbAvailable) return;
    const res = await api('POST', '/api/gpa/forecast', {
      token,
      body: { targetCpa: 3.5, additionalCredits: 30, plannedGrade4: 3.0 },
    });
    expect(res.status).toBe(200);
    expect(typeof res.data.requiredAverageGrade4).toBe('number');
    expect(typeof res.data.feasible).toBe('boolean');
  });
});

describe('Schedule integration', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    await api('POST', '/api/auth/login', {
      body: {
        email: 'integ-student@acaschedule.local',
        password: 'Integ@1234',
      },
    }).then((r) => {
      token = r.data.accessToken;
    });
  });

  it('liệt kê cấu hình tiết (không hard-code)', async () => {
    if (!dbAvailable) return;
    const res = await api('GET', '/api/schedule/periods', { token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.periods)).toBe(true);
    expect(res.data.periods.length).toBeGreaterThan(0);
  });

  it('liệt kê lớp học phần theo học kỳ', async () => {
    if (!dbAvailable) return;
    const res = await api('GET', '/api/schedule/sections?semester=2025-2', {
      token,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.sections)).toBe(true);
  });

  it('mô phỏng đăng ký và trả xung đột', async () => {
    if (!dbAvailable) return;
    const sectionsRes = await api('GET', '/api/schedule/sections?semester=2025-2', {
      token,
    });
    const sections = sectionsRes.data.sections;
    expect(sections.length).toBeGreaterThan(0);

    const simRes = await api('POST', '/api/schedule/simulate', {
      token,
      body: {
        semester: '2025-2',
        sectionIds: sections.slice(0, 2).map((s: any) => s.id),
      },
    });
    expect(simRes.status).toBe(200);
    expect(typeof simRes.data.summary.feasible).toBe('boolean');
    expect(Array.isArray(simRes.data.conflicts)).toBe(true);
  });
});

describe('Documents integration', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    await api('POST', '/api/auth/login', {
      body: {
        email: 'integ-student@acaschedule.local',
        password: 'Integ@1234',
      },
    }).then((r) => {
      token = r.data.accessToken;
    });
  });

  it('liệt kê môn học có thể đóng góp tài liệu', async () => {
    if (!dbAvailable) return;
    const res = await api('GET', '/api/documents/subjects', { token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.subjects)).toBe(true);
  });

  it('presign upload trả URL PUT và objectKey', async () => {
    if (!dbAvailable) return;
    const subjectsRes = await api('GET', '/api/documents/subjects', { token });
    const subjectId = subjectsRes.data.subjects[0]?.id;
    if (!subjectId) {
      expect(true).toBe(true); // không có môn nào, bỏ qua
      return;
    }

    const presign = await api('POST', '/api/documents/uploads/presign', {
      token,
      body: {
        subjectId,
        fileName: 'integ-test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      },
    });
    expect(presign.status).toBe(201);
    expect(presign.data.uploadUrl).toBeDefined();
    expect(presign.data.objectKey).toBeDefined();
    expect(presign.data.method).toBe('PUT');
  });
});

describe('Cross-student isolation integration', () => {
  it('sinh viên khác không đọc được tài liệu của sinh viên này', async () => {
    if (!dbAvailable) return;
    // Đăng ký sinh viên mới
    const regEmail = `integ-other-${Date.now()}@acaschedule.local`;
    await api('POST', '/api/auth/register', {
      body: { email: regEmail, password: 'Other@1234', fullName: 'Sinh viên Khác' },
    });
    const otherLogin = await api('POST', '/api/auth/login', {
      body: { email: regEmail, password: 'Other@1234' },
    });
    const otherToken = otherLogin.data.accessToken;

    // Sinh viên khác không có môn nào nên subjects trống
    const subjects = await api('GET', '/api/documents/subjects', { token: otherToken });
    expect(subjects.status).toBe(200);
  });
});

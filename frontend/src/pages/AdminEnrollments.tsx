import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminEnrollment,
  deleteAdminEnrollment,
  fetchAdminSubjects,
  fetchAdminUsers,
  fetchAdminEnrollments,
  updateAdminEnrollment,
  type AdminSubject,
  type AdminUser,
  type TranscriptAttempt,
} from '../lib/api';
import { Combobox } from '../components/Combobox';
import { useSemesters } from '../hooks/useSemesters';
import { AdminListPage } from './AdminUsers';

function formatNumber(value: number | null, digits = 2): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(digits);
}

function statusLabel(attempt: TranscriptAttempt): string {
  if (attempt.processScore === null && attempt.finalScore === null) return 'Chờ điểm';
  if (attempt.processScore !== null && attempt.finalScore === null) return 'Chờ thi';
  return attempt.grade4 !== null && attempt.grade4 > 0 ? 'Đạt' : 'Trượt';
}

function attemptKindLabel(attempt: TranscriptAttempt): string {
  if (attempt.attemptKind === 'retake') return `Học lại lần ${attempt.attemptNo}`;
  if (attempt.attemptKind === 'improvement') return `Cải thiện lần ${attempt.attemptNo}`;
  return `Lần ${attempt.attemptNo}`;
}

export function AdminEnrollmentsPage() {
  const { token } = useAuth();
  const { codes } = useSemesters();
  const [students, setStudents] = useState<AdminUser[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState('');
  const [processScore, setProcessScore] = useState('');
  const [finalScore, setFinalScore] = useState('');
  const [enrollments, setEnrollments] = useState<TranscriptAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProcess, setEditProcess] = useState('');
  const [editFinal, setEditFinal] = useState('');

  /** Combo box data: tìm nhanh theo mã hoặc tên môn. */
  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        value: subject.id,
        label: `${subject.code} - ${subject.name}`,
        keywords: `${subject.code} ${subject.name}`,
        hint: `${subject.credits} tín chỉ`,
      })),
    [subjects],
  );

  /** Combo box data: tra cứu sinh viên theo tên, email hoặc mã sinh viên. */
  const studentOptions = useMemo(
    () =>
      students.map((user) => ({
        value: user.id,
        label: `${user.fullName} - ${user.email}`,
        keywords: `${user.fullName} ${user.email} ${user.studentCode ?? ''}`,
        hint: user.studentCode ? `MSSV ${user.studentCode}` : undefined,
      })),
    [students],
  );

  const loadEnrollments = async (id: string) => {
    if (!token || !id) return;
    setLoading(true);
    try {
      setEnrollments(await fetchAdminEnrollments(token, id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được môn học của sinh viên.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAdminUsers(token)
      .then((users) => {
        const list = users.filter((user) => user.role === 'student');
        setStudents(list);
        if (list[0]) setStudentId(list[0].id);
      })
      .catch(() => setError('Không tải được danh sách sinh viên.'));
    fetchAdminSubjects(token).then(setSubjects).catch(() => setError('Không tải được danh sách môn học.'));
  }, [token]);

  useEffect(() => {
    if (studentId) void loadEnrollments(studentId);
  }, [token, studentId]);

  const grouped = useMemo(() => {
    const map = new Map<string, TranscriptAttempt[]>();
    for (const item of enrollments) {
      const list = map.get(item.semester) ?? [];
      list.push(item);
      map.set(item.semester, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [enrollments]);

  const addEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !studentId || !subjectId || !semester.trim()) return;
    const hasProcess = processScore.trim() !== '';
    const hasFinal = finalScore.trim() !== '';
    if (hasProcess !== hasFinal) {
      setError('Cần nhập cả điểm quá trình và điểm thi, hoặc để trống cả hai (môn đang chờ điểm).');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Parameters<typeof createAdminEnrollment>[1] = {
        studentId,
        subjectId,
        semester: semester.trim(),
        ...(hasProcess ? { processScore: Number(processScore), finalScore: Number(finalScore) } : {}),
      };
      await createAdminEnrollment(token, payload);
      setMessage(
        hasProcess
          ? 'Đã thêm môn vào học kỳ và nhập điểm.'
          : 'Đã thêm môn vào học kỳ (đang chờ điểm).',
      );
      setSubjectId('');
      setProcessScore('');
      setFinalScore('');
      await loadEnrollments(studentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể thêm môn học.');
    } finally {
      setLoading(false);
    }
  };

  const removeEnrollment = async (id: string) => {
    if (!token || !studentId || !window.confirm('Xóa lượt học này khỏi bảng điểm của sinh viên?')) return;
    try {
      await deleteAdminEnrollment(token, studentId, id);
      setEnrollments((items) => items.filter((item) => item.id !== id));
      setMessage('Đã xóa lượt học.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa lượt học.');
    }
  };

  const saveScores = async (id: string) => {
    if (!token || !studentId) return;
    const process = Number(editProcess);
    const final = Number(editFinal);
    if (!Number.isFinite(process) || !Number.isFinite(final) || process < 0 || process > 10 || final < 0 || final > 10) {
      setError('Điểm phải nằm trong khoảng 0 đến 10.');
      return;
    }
    try {
      await updateAdminEnrollment(token, studentId, id, { processScore: process, finalScore: final });
      setEditingId(null);
      setMessage('Đã cập nhật điểm.');
      await loadEnrollments(studentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật điểm.');
    }
  };

  return (
    <AdminListPage
      title="Thêm môn vào học kỳ cho sinh viên"
      description="Chọn sinh viên, học kỳ và môn học để ghi vào bảng điểm. Để trống điểm thì môn sẽ ở trạng thái chờ điểm."
    >
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <form onSubmit={addEnrollment} className="border-b border-slate-100 bg-slate-50/70 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_auto] lg:items-end">
          <label className="text-sm font-medium text-slate-700">
            Sinh viên
            <Combobox
              options={studentOptions}
              value={studentId}
              onChange={setStudentId}
              placeholder="Nhập tên, email hoặc mã sinh viên…"
              emptyLabel="— Chọn sinh viên —"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Môn học
            <Combobox
              options={subjectOptions}
              value={subjectId}
              onChange={setSubjectId}
              placeholder="Nhập mã môn hoặc tên môn…"
              emptyLabel="— Chọn môn học —"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Học kỳ
            <select value={semester} onChange={(e) => setSemester(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Chọn học kỳ</option>
              {codes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Điểm QT (tùy chọn)
            <input type="number" min="0" max="10" step="0.01" value={processScore} onChange={(e) => setProcessScore(e.target.value)} placeholder="QT" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Điểm thi (tùy chọn)
            <input type="number" min="0" max="10" step="0.01" value={finalScore} onChange={(e) => setFinalScore(e.target.value)} placeholder="Thi" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button disabled={loading} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Đang lưu…' : 'Thêm vào kỳ'}
          </button>
        </div>
      </form>

      <div className="p-5">
        <h2 className="font-semibold text-slate-900">
          {students.find((user) => user.id === studentId)?.fullName
            ? `Môn học của ${students.find((user) => user.id === studentId)?.fullName}`
            : 'Môn học của sinh viên'}
        </h2>
        {loading && <p className="mt-2 text-sm text-slate-500">Đang tải…</p>}
        {!loading && !grouped.length && (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Sinh viên này chưa có lượt học nào.
          </p>
        )}
        <div className="mt-4 space-y-6">
          {grouped.map(([semesterName, attempts]) => (
            <section key={semesterName}>
              <h3 className="text-sm font-semibold text-slate-900">Học kỳ {semesterName}</h3>
              <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[900px] table-fixed divide-y divide-gray-200 text-sm">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Môn học</th>
                      <th className="px-4 py-2">Lần</th>
                      <th className="px-4 py-2 text-right">QT</th>
                      <th className="px-4 py-2 text-right">Thi</th>
                      <th className="px-4 py-2 text-right">Hệ 10</th>
                      <th className="px-4 py-2 text-center">Chữ</th>
                      <th className="px-4 py-2 text-right">Hệ 4</th>
                      <th className="px-4 py-2">Trạng thái</th>
                      <th className="px-4 py-2">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-900">{attempt.subjectName}</p>
                          <p className="text-xs text-slate-500">{attempt.subjectCode} · {attempt.credits} tín chỉ</p>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-600">{attemptKindLabel(attempt)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(attempt.processScore)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(attempt.finalScore)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNumber(attempt.totalScore10)}</td>
                        <td className="px-4 py-2 text-center">{attempt.letterGrade ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatNumber(attempt.grade4)}</td>
                        <td className="px-4 py-2 text-slate-700">{statusLabel(attempt)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {editingId === attempt.id ? (
                            <span className="flex items-center gap-1.5">
                              <input type="number" min="0" max="10" step="0.01" value={editProcess} onChange={(e) => setEditProcess(e.target.value)} className="w-16 rounded border px-2 py-1 text-xs" aria-label="Điểm quá trình" />
                              <input type="number" min="0" max="10" step="0.01" value={editFinal} onChange={(e) => setEditFinal(e.target.value)} className="w-16 rounded border px-2 py-1 text-xs" aria-label="Điểm thi" />
                              <button type="button" onClick={() => void saveScores(attempt.id)} className="rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white">Lưu</button>
                              <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">Hủy</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-3">
                              <button type="button" onClick={() => { setEditingId(attempt.id); setEditProcess(attempt.processScore?.toString() ?? ''); setEditFinal(attempt.finalScore?.toString() ?? ''); }} className="text-xs font-medium text-brand-600">Nhập điểm</button>
                              <button type="button" onClick={() => void removeEnrollment(attempt.id)} className="text-xs font-medium text-rose-600">Xóa</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </AdminListPage>
  );
}

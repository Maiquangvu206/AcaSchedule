import { useEffect, useMemo, useState } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAuth } from '../auth/AuthContext';
import {
  fetchStudyPlan,
  resetStudyPlan,
  updateStudyPlanPlacement,
  type CurriculumSubject,
  type CurriculumSubjectStatus,
  type TranscriptAttempt,
  type TranscriptCurriculum,
} from '../lib/api';

const ITEM_TYPE = 'SUBJECT';

const STATUS_META: Record<CurriculumSubjectStatus, { label: string; className: string }> = {
  'not-started': { label: 'Chưa học', className: 'bg-slate-500/10 text-slate-600 ring-slate-400/30' },
  studying: { label: 'Đang học', className: 'bg-amber-500/10 text-amber-700 ring-amber-500/30' },
  passed: { label: 'Đã đạt', className: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30' },
  failed: { label: 'Trượt', className: 'bg-rose-500/10 text-rose-700 ring-rose-500/30' },
};

function attemptKindLabel(attempt: TranscriptAttempt): string {
  if (attempt.attemptKind === 'retake') return `Học lại lần ${attempt.attemptNo}`;
  if (attempt.attemptKind === 'improvement') return `Cải thiện lần ${attempt.attemptNo}`;
  return `Lần ${attempt.attemptNo}`;
}

function attemptResult(attempt: TranscriptAttempt): string {
  if (attempt.grade4 === null) {
    if (attempt.processScore === null && attempt.finalScore === null) return 'Chưa có điểm';
    return 'Chờ thi';
  }
  return `${attempt.letterGrade ?? '—'} · ${attempt.grade4.toFixed(2)}/4`;
}

interface SubjectCardProps {
  subject: CurriculumSubject;
  onHide?: () => void;
}

function SubjectCard({ subject }: SubjectCardProps) {
  const [{ isDragging }, drag] = useDrag<{ subjectId: string }, void, { isDragging: boolean }>(
    () => ({
      type: ITEM_TYPE,
      item: { subjectId: subject.subjectId },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [subject.subjectId],
  );

  return drag(
    <article
      className={`cursor-grab rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-brand-300 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
      aria-label={`${subject.subjectName}, kéo để chuyển học kỳ`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{subject.subjectName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {subject.subjectCode} · {subject.credits} tín chỉ
            {subject.inCurriculum
              ? subject.isRequired
                ? ' · Bắt buộc'
                : ' · Tự chọn'
              : ' · Ngoài chương trình'}
            {subject.managingUnit ? ` · Bộ môn: ${subject.managingUnit}` : ''}
          </p>
          {subject.isCustomized && (
            <p className="mt-1 text-[11px] font-medium text-brand-700">
              Học kỳ tự chọn: {subject.personalSemesterNo}
              {subject.defaultSemesterNo
                ? ` (CTĐT: học kỳ ${subject.defaultSemesterNo})`
                : ' (CTĐT: chưa xếp kỳ)'}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_META[subject.status].className}`}
        >
          {STATUS_META[subject.status].label}
        </span>
      </div>
      {subject.attempts.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
          {subject.attempts.map((attempt) => (
            <span
              key={attempt.id}
              className="rounded-md bg-slate-50 px-2 py-0.5 ring-1 ring-inset ring-slate-200"
            >
              {attemptKindLabel(attempt)} · {attempt.semester} · {attemptResult(attempt)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">Chưa có lần học nào.</p>
      )}
    </article>
  );
}

interface SemesterColumnProps {
  semesterNo: number;
  subjects: CurriculumSubject[];
  plannedCredits: number;
  completedCredits: number;
  onMove: (subjectId: string, semesterNo: number | null) => void;
  saving: boolean;
}

function SemesterColumn({
  semesterNo,
  subjects,
  plannedCredits,
  completedCredits,
  onMove,
  saving,
}: SemesterColumnProps) {
  const [{ isOver }, drop] = useDrop<
    { subjectId: string },
    void,
    { isOver: boolean; canDrop: boolean }
  >(
    () => ({
      accept: ITEM_TYPE,
      drop: (item) => {
        onMove(item.subjectId, semesterNo);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [semesterNo, onMove],
  );

  return drop(
    <section
      className={`min-h-[180px] rounded-2xl border bg-white p-4 transition ${
        isOver
          ? 'border-brand-400 bg-brand-500/10 ring-2 ring-brand-500/20'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {semesterNo === 0 ? 'Môn ngoài chương trình' : `Học kỳ ${semesterNo}`}
        </h3>
        <p className="text-xs text-slate-500">
          {completedCredits}/{plannedCredits} tín chỉ đã đạt
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {subjects.map((subject) => (
          <SubjectCard key={subject.subjectId} subject={subject} />
        ))}
        {!subjects.length && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            Kéo môn học vào đây để xếp vào học kỳ này
          </p>
        )}
      </div>
      {saving && <p className="mt-2 text-[11px] text-slate-400">Đang lưu…</p>}
    </section>
  );
}

function StudyPlanBoard() {
  const { token } = useAuth();
  const [plan, setPlan] = useState<TranscriptCurriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    fetchStudyPlan(token)
      .then(setPlan)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Không tải được lộ trình học tập.'),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const customizedCount = useMemo(
    () =>
      plan?.semesters.reduce(
        (sum, semester) => sum + semester.subjects.filter((s) => s.isCustomized).length,
        0,
      ) ?? 0,
    [plan],
  );

  const handleMove = async (subjectId: string, semesterNo: number | null) => {
    if (!token || !plan) return;
    const current = plan.semesters
      .flatMap((s) => s.subjects)
      .find((s) => s.subjectId === subjectId);
    if (!current) return;
    if ((current.effectiveSemesterNo ?? 0) === (semesterNo ?? 0)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const previous = plan;
    try {
      const next = await updateStudyPlanPlacement(token, subjectId, semesterNo);
      setPlan(next);
      setMessage(
        semesterNo === null
          ? `Đã trả "${current.subjectName}" về học kỳ theo CTĐT.`
          : `Đã chuyển "${current.subjectName}" sang học kỳ ${semesterNo}.`,
      );
    } catch (caught) {
      setPlan(previous);
      setError(caught instanceof Error ? caught.message : 'Không lưu được thay đổi.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      setPlan(await resetStudyPlan(token));
      setMessage('Đã khôi phục lộ trình theo chương trình đào tạo gốc.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không khôi phục được lộ trình.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải lộ trình học tập…
        </p>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-700">
          {error}
        </p>
      </div>
    );
  }

  if (!plan) return null;

  // Ensure every semester 1..maxSemesterNo has a column even when empty.
  const byNo = new Map(plan.semesters.map((s) => [s.semesterNo, s]));
  const columns = Array.from({ length: Math.max(plan.maxSemesterNo, 1) }, (_, i) => i + 1).map(
    (semesterNo) =>
      byNo.get(semesterNo) ?? {
        semesterNo,
        plannedCredits: 0,
        completedCredits: 0,
        subjects: [],
      },
  );
  const outside = byNo.get(0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Lộ trình học tập theo chương trình đào tạo
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ngành {plan.majorCode} - {plan.majorName} · Kéo thả môn học để chuyển học kỳ.
            Khi chưa tự sắp xếp, hệ thống dùng khung đào tạo do admin thiết lập cho ngành của bạn.
          </p>
          {customizedCount > 0 ? (
            <p className="mt-1 text-xs font-medium text-brand-700">
              Bạn đã tự sắp xếp {customizedCount} môn học.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Đang hiển thị theo khung đào tạo gốc của ngành.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 text-[11px]" aria-label="Chú thích trạng thái">
            {(Object.keys(STATUS_META) as CurriculumSubjectStatus[]).map((status) => (
              <span
                key={status}
                className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${STATUS_META[status].className}`}
              >
                {STATUS_META[status].label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={saving || customizedCount === 0}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            Khôi phục theo CTĐT
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {columns.map((column) => (
          <SemesterColumn
            key={column.semesterNo}
            semesterNo={column.semesterNo}
            subjects={column.subjects}
            plannedCredits={column.plannedCredits}
            completedCredits={column.completedCredits}
            onMove={(subjectId, semesterNo) => void handleMove(subjectId, semesterNo)}
            saving={saving}
          />
        ))}
        {outside ? (
          <SemesterColumn
            semesterNo={0}
            subjects={outside.subjects}
            plannedCredits={outside.plannedCredits}
            completedCredits={outside.completedCredits}
            onMove={(subjectId, semesterNo) => void handleMove(subjectId, semesterNo)}
            saving={saving}
          />
        ) : null}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Di chuyển bằng danh sách chọn</h2>
        <p className="mt-1 text-xs text-slate-500">
          Dùng khi không tiện kéo thả. Chọn "Theo CTĐT" để trả môn về học kỳ gốc của chương trình.
        </p>
        <ul className="mt-3 divide-y divide-gray-100">
          {plan.semesters.flatMap((s) => s.subjects).map((subject) => (
            <li key={subject.subjectId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium text-slate-900">{subject.subjectName}</span>{' '}
                <span className="text-slate-500">
                  ({subject.subjectCode} · hiện ở học kỳ{' '}
                  {subject.effectiveSemesterNo ?? 'chưa xếp'})
                </span>
              </span>
              <select
                value={subject.personalSemesterNo === null ? 'default' : String(subject.personalSemesterNo)}
                onChange={(event) => {
                  const value = event.target.value;
                  void handleMove(subjectIdOf(subject), value === 'default' ? null : Number(value));
                }}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                aria-label={`Chuyển ${subject.subjectName} sang học kỳ`}
              >
                <option value="default">
                  Theo CTĐT{subject.defaultSemesterNo ? ` (HK${subject.defaultSemesterNo})` : ''}
                </option>
                {Array.from({ length: Math.max(plan.maxSemesterNo, subject.defaultSemesterNo ?? 0, 8) }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      Học kỳ {n}
                    </option>
                  ),
                )}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function subjectIdOf(subject: CurriculumSubject): string {
  return subject.subjectId;
}

export function StudyPlanPage() {
  return (
    <DndProvider backend={HTML5Backend}>
      <StudyPlanBoard />
    </DndProvider>
  );
}

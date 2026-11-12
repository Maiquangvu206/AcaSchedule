import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Combobox } from '../components/Combobox';
import {
  downloadCsv,
  fetchAdminMajors,
  importCurriculumCsv,
  importTranscriptCsv,
  type AdminMajor,
  type ImportReport,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

type Dataset = 'transcript' | 'curriculum';

interface DatasetConfig {
  title: string;
  description: string;
  exportPath: string;
  exportName: string;
  columns: string[];
  hint: string;
}

const DATASETS: Record<Dataset, DatasetConfig> = {
  transcript: {
    title: 'Bảng điểm',
    description:
      'Nhập hàng loạt điểm của sinh viên. Hệ thống tự tạo môn mới nếu mã môn chưa có.',
    exportPath: '/admin/data/export/transcript.csv',
    exportName: 'bang-diem.csv',
    columns: [
      'MSSV',
      'Họ tên',
      'Email',
      'Mã môn',
      'Tên môn',
      'Tín chỉ',
      'Học kỳ',
      'Lần học',
      'Điểm quá trình',
      'Điểm thi',
    ],
    hint:
      'Bắt buộc: MSSV (hoặc Email), Mã môn, Học kỳ. Điểm quá trình và Điểm thi điền cùng nhau hoặc để trống cả hai (môn chờ điểm).',
  },
  curriculum: {
    title: 'Chương trình đào tạo',
    description:
      'Nhập khoa → ngành → môn học kèm cấu hình (bắt buộc, học kỳ, tỉ lệ tính điểm). Khoa, ngành và môn chưa có sẽ được tạo mới.',
    exportPath: '/admin/data/export/curriculum.csv',
    exportName: 'chuong-trinh-dao-tao.csv',
    columns: [
      'Mã khoa',
      'Tên khoa',
      'Mã ngành',
      'Tên ngành',
      'Mã môn',
      'Tên môn',
      'Tín chỉ',
      'Bắt buộc',
      'Học kỳ',
      'Tính điểm',
      'Tỉ lệ Process',
      'Tỉ lệ Final',
    ],
    hint:
      'Bắt buộc: Mã ngành, Mã môn. Tỉ lệ Process + Final phải bằng 1 (ví dụ 0.4 và 0.6).',
  },
};

function ReportCard({ report }: { report: ImportReport }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap gap-4">
        <span>
          Tổng dòng: <strong>{report.total}</strong>
        </span>
        <span className="text-emerald-700">
          Thêm mới: <strong>{report.created}</strong>
        </span>
        <span className="text-sky-700">
          Cập nhật: <strong>{report.updated}</strong>
        </span>
        <span className="text-slate-600">
          Không đổi: <strong>{report.unchanged}</strong>
        </span>
        <span className="text-rose-700">
          Bỏ qua: <strong>{report.skipped}</strong>
        </span>
      </div>

      {report.errors.length ? (
        <div>
          <p className="font-medium text-rose-700">Dòng lỗi ({report.errors.length})</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-rose-700">
            {report.errors.map((issue) => (
              <li key={`${issue.row}-${issue.message}`}>
                Dòng {issue.row}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length ? (
        <div>
          <p className="font-medium text-amber-700">Lưu ý ({report.warnings.length})</p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-amber-700">
            {report.warnings.map((issue) => (
              <li key={`${issue.row}-${issue.message}`}>
                Dòng {issue.row}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdminDataPage() {
  const { token } = useAuth();
  const [dataset, setDataset] = useState<Dataset>('transcript');
  const [majors, setMajors] = useState<AdminMajor[]>([]);
  const [majorId, setMajorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dryRunInputRef = useRef<HTMLInputElement>(null);

  const config = DATASETS[dataset];

  // Danh sách ngành để lọc khi xuất chương trình đào tạo.
  useEffect(() => {
    if (!token) return;
    fetchAdminMajors(token).then(setMajors).catch(() => setMajors([]));
  }, [token]);

  const majorOptions = majors.map((major) => ({
    value: major.id,
    label: `${major.code} - ${major.name}`,
    keywords: `${major.code} ${major.name}`,
    hint: `${major.subjectCount} môn`,
  }));

  const handleExport = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const query = dataset === 'curriculum' && majorId ? `?majorId=${majorId}` : '';
      await downloadCsv(token, `${config.exportPath}${query}`, config.exportName);
      setNotice('Đã tải file CSV. Mở bằng Excel để chỉnh sửa rồi nhập lại.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xuất được file CSV.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
    dryRun: boolean,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!token || !file) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setReport(null);
    try {
      const csv = await file.text();
      const result =
        dataset === 'transcript'
          ? await importTranscriptCsv(token, csv, dryRun)
          : await importCurriculumCsv(token, csv, dryRun);
      setReport(result);
      setNotice(
        dryRun
          ? `Kiểm tra ${result.total} dòng: thêm ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped}. Chưa ghi vào hệ thống.`
          : `Đã xử lý ${result.total} dòng: thêm ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không nhập được file CSV.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminListPage
      title="Nhập & xuất dữ liệu"
      description="Nhập liệu hàng loạt bằng CSV (mở được bằng Excel) thay vì cấu hình từng bản ghi một."
    >
      <div className="space-y-5 p-5">
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-slate-700">
            Dữ liệu
            <select
              value={dataset}
              onChange={(event) => {
                setDataset(event.target.value as Dataset);
                setReport(null);
                setNotice(null);
              }}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="transcript">Bảng điểm</option>
              <option value="curriculum">Chương trình đào tạo</option>
            </select>
          </label>

          {dataset === 'curriculum' ? (
            <label className="text-sm font-medium text-slate-700">
              Chỉ xuất ngành
              <Combobox
                options={majorOptions}
                value={majorId}
                onChange={setMajorId}
                placeholder="Tất cả ngành"
                emptyLabel="— Tất cả ngành —"
                className="mt-1 w-full sm:w-64"
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? 'Đang xử lý…' : 'Tải file mẫu (CSV)'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Đang xử lý…' : 'Chọn file CSV để nhập'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => void handleImport(event, false)}
          />
          <button
            type="button"
            onClick={() => dryRunInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Kiểm tra trước (không ghi)
          </button>
          <input
            ref={dryRunInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => void handleImport(event, true)}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
          <p className="font-medium text-slate-800">{config.title}</p>
          <p className="mt-1 text-slate-600">{config.description}</p>
          <p className="mt-2 text-xs text-slate-600">{config.hint}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {config.columns.map((column) => (
              <span
                key={column}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
              >
                {column}
              </span>
            ))}
          </div>
        </div>

        {report ? <ReportCard report={report} /> : null}
      </div>
    </AdminListPage>
  );
}

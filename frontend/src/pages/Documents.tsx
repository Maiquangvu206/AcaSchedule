import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  ApiError,
  createDocumentRecord,
  fetchDocumentDownload,
  fetchDocuments,
  fetchDocumentSubjects,
  presignDocumentUpload,
  voteDocument,
  type DocumentItem,
  type DocumentSubject,
} from '../lib/api';
import { ContextualAiPanel } from '../components/ContextualAiPanel';

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function inferMime(file: File): string {
  const extension = extensionOf(file.name);
  const declared = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (declared && declared !== 'application/octet-stream') return declared;
  return MIME_BY_EXTENSION[extension] ?? '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function fileLabel(mimeType: string, fileName: string | null): string {
  const extension = fileName ? extensionOf(fileName) : '';
  if (extension) return extension.toUpperCase();
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
  };
  return map[mimeType] ?? 'FILE';
}

function isPdf(document: DocumentItem): boolean {
  return document.mimeType === 'application/pdf';
}

export function DocumentsPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [subjects, setSubjects] = useState<DocumentSubject[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'rank' | 'newest'>('rank');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [uploadSubject, setUploadSubject] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [votingId, setVotingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [viewer, setViewer] = useState<{ document: DocumentItem; url: string | null } | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/documents' } });
        return;
      }
      setError(caught instanceof Error ? caught.message : fallback);
    },
    [logout, navigate],
  );

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true, state: { from: '/documents' } });
      return;
    }

    let cancelled = false;
    fetchDocumentSubjects(token)
      .then((data) => {
        if (cancelled) return;
        setSubjects(data);
        setUploadSubject((current) => current || data[0]?.id || '');
      })
      .catch((caught) => {
        if (!cancelled) handleAuthError(caught, 'Không tải được danh sách môn học');
      });

    return () => {
      cancelled = true;
    };
  }, [token, handleAuthError, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDocuments(token, {
      ...(selectedSubject ? { subjectId: selectedSubject } : {}),
      ...(query ? { q: query } : {}),
      sort,
    })
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch((caught) => {
        if (!cancelled) handleAuthError(caught, 'Không tải được kho tài liệu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedSubject, query, sort, version, handleAuthError]);

  useEffect(() => {
    if (!viewer) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewer(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewer]);

  const stats = useMemo(() => {
    const totalVotes = documents.reduce((sum, item) => sum + item.upvotes, 0);
    return {
      documents: documents.length,
      subjects: subjects.length,
      totalVotes,
    };
  }, [documents, subjects.length]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setUploadError(null);
    if (selected && !title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ''));
    }
  };

  const resetUploadForm = () => {
    setFile(null);
    setTitle('');
    setUploadError(null);
    setUploadStep('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !file || !uploadSubject) return;

    const mimeType = inferMime(file);
    if (!mimeType) {
      setUploadError('Định dạng tệp chưa được hỗ trợ.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`Tệp vượt quá giới hạn ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    setUploadError(null);
    setError(null);
    setNotice(null);

    try {
      setUploadStep('Đang tạo URL tải lên…');
      const ticket = await presignDocumentUpload(token, {
        subjectId: uploadSubject,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      });

      setUploadStep('Đang tải tệp trực tiếp lên MinIO…');
      const uploadResponse = await fetch(ticket.uploadUrl, {
        method: ticket.method,
        headers: ticket.requiredHeaders,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Tải tệp lên kho thất bại (HTTP ${uploadResponse.status})`);
      }

      setUploadStep('Đang lưu thông tin tài liệu…');
      await createDocumentRecord(token, {
        subjectId: uploadSubject,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        objectKey: ticket.objectKey,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
      });

      setNotice('Đã chia sẻ tài liệu thành công.');
      resetUploadForm();
      setVersion((value) => value + 1);
    } catch (caught) {
      handleAuthError(caught, 'Không tải được tài liệu lên');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleVote = async (document: DocumentItem, value: 1 | -1) => {
    if (!token || votingId) return;
    const nextValue = document.myVote === value ? 0 : value;

    setVotingId(document.id);
    setError(null);
    try {
      const updated = await voteDocument(token, document.id, nextValue);
      setDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      handleAuthError(caught, 'Không ghi nhận được bình chọn');
    } finally {
      setVotingId(null);
    }
  };

  const handleView = async (document: DocumentItem) => {
    if (!token) return;
    setViewer({ document, url: null });
    setViewerError(null);
    try {
      const download = await fetchDocumentDownload(token, document.id, true);
      setViewer({ document, url: download.url });
    } catch (caught) {
      setViewerError(caught instanceof Error ? caught.message : 'Không mở được tài liệu');
    }
  };

  const handleDownload = async (document: DocumentItem) => {
    if (!token || downloadingId) return;
    setDownloadingId(document.id);
    setError(null);
    try {
      const download = await fetchDocumentDownload(token, document.id, false);
      const link = window.document.createElement('a');
      link.href = download.url;
      link.download = document.originalName ?? document.title;
      link.rel = 'noopener';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (caught) {
      handleAuthError(caught, 'Không tải được tài liệu');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kho tài liệu cộng đồng</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Đề thi, slide và bài tập mẫu theo môn học.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Tài liệu" value={String(stats.documents)} />
          <Stat label="Môn học" value={String(stats.subjects)} />
          <Stat label="Upvote" value={String(stats.totalVotes)} />
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <ContextualAiPanel mode="study" />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <label className="block min-w-44 flex-1 space-y-1 text-xs font-medium text-slate-600">
              Môn học
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60"
              >
                <option value="">Tất cả môn đã đăng ký</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-48 flex-[1.4] space-y-1 text-xs font-medium text-slate-600">
              Tìm kiếm
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tên tài liệu, mã môn, người đăng…"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400/60"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-600">
              Sắp xếp
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value === 'newest' ? 'newest' : 'rank')}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60"
              >
                <option value="rank">Nổi bật</option>
                <option value="newest">Mới nhất</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              Đang tải kho tài liệu…
            </p>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
              <p className="text-lg font-semibold text-slate-900">Chưa có tài liệu phù hợp</p>
              <p className="mt-2 text-sm text-slate-500">
                Thử đổi bộ lọc hoặc là người đầu tiên chia sẻ tài liệu cho môn này.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-600">
                          {document.subjectCode}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {fileLabel(document.mimeType, document.originalName)}
                        </span>
                        <span className="text-[11px] text-slate-500">{formatBytes(document.sizeBytes)}</span>
                      </div>
                      <h2 className="mt-2 truncate text-lg font-semibold text-slate-900">{document.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {document.subjectName} · {document.uploaderName} · {formatDate(document.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <VoteButton
                        direction="up"
                        count={document.upvotes}
                        active={document.myVote === 1}
                        disabled={votingId === document.id}
                        onClick={() => void handleVote(document, 1)}
                      />
                      <VoteButton
                        direction="down"
                        count={document.downvotes}
                        active={document.myVote === -1}
                        disabled={votingId === document.id}
                        onClick={() => void handleVote(document, -1)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3">
                    <p className="text-[11px] text-slate-500">
                      Điểm xếp hạng <span className="font-semibold text-slate-700">{document.score.toFixed(2)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {isPdf(document) ? (
                        <button
                          type="button"
                          onClick={() => void handleView(document)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-gray-300 hover:text-slate-900"
                        >
                          Xem PDF
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleDownload(document)}
                        disabled={downloadingId === document.id}
                        className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloadingId === document.id ? 'Đang tạo link…' : 'Tải xuống'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Chia sẻ tài liệu</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Tối đa {MAX_FILE_SIZE_MB} MB. Hỗ trợ PDF, Office, văn bản và ảnh. Tệp thực thi bị chặn.
            </p>

            <form onSubmit={handleUpload} className="mt-4 space-y-3">
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Môn học
                <select
                  required
                  value={uploadSubject}
                  onChange={(event) => setUploadSubject(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} — {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Tiêu đề
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Tên tài liệu"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400/60"
                />
              </label>

              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Tệp đính kèm
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={handleFileChange}
                  className="mt-1 w-full cursor-pointer rounded-xl border border-dashed border-gray-200/50 bg-gray-50 px-3 py-3 text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-600 hover:border-gray-300/50"
                />
              </label>

              {file ? (
                <p className="rounded-xl border border-gray-200/50 bg-gray-50 px-3 py-2 text-[11px] text-slate-500">
                  {file.name} · {formatBytes(file.size)} · {inferMime(file) || 'không rõ MIME'}
                </p>
              ) : null}

              {uploadError ? <p className="text-xs text-rose-600">{uploadError}</p> : null}
              {uploadStep ? <p className="text-xs text-brand-600">{uploadStep}</p> : null}

              <button
                type="submit"
                disabled={uploading || !file || !uploadSubject || subjects.length === 0}
                className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? 'Đang tải lên…' : 'Chia sẻ tài liệu'}
              </button>
            </form>

            {subjects.length === 0 ? (
              <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                Bạn chưa có môn học nào trong bảng điểm nên chưa thể đóng góp tài liệu.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-gray-200/50 bg-gray-50 p-4 text-xs leading-5 text-slate-500">
            Luồng tải lên: backend cấp presigned PUT URL sau khi kiểm tra quyền môn học → trình duyệt
            PUT trực tiếp lên MinIO → backend xác minh kích thước/MIME thật rồi mới lưu metadata.
          </section>
        </aside>
      </div>

      {viewer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={viewer.document.title}
          onClick={() => setViewer(null)}
        >
          <div
            className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{viewer.document.title}</p>
                <p className="text-[11px] text-slate-500">{viewer.document.subjectCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Đóng
              </button>
            </div>
            {viewerError ? (
              <p className="m-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {viewerError}
              </p>
            ) : viewer.url ? (
              <iframe src={viewer.url} title={viewer.document.title} className="h-full w-full bg-white" />
            ) : (
              <p className="p-6 text-sm text-slate-500">Đang tạo liên kết xem tài liệu…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-right">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function VoteButton({
  direction,
  count,
  active,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={direction === 'up' ? 'Upvote tài liệu' : 'Downvote tài liệu'}
      className={`flex min-w-14 items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? direction === 'up'
            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700'
            : 'border-rose-400/40 bg-rose-500/15 text-rose-700'
          : 'border-gray-200 bg-gray-100 text-slate-500 hover:border-gray-300 hover:text-slate-900'
      }`}
    >
      <span aria-hidden>{direction === 'up' ? '▲' : '▼'}</span>
      <span>{count}</span>
    </button>
  );
}

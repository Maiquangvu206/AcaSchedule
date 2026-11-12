export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'admin';
  createdAt: string;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export type AttemptKind = 'first' | 'retake' | 'improvement';

export interface TranscriptAttempt {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: string;
  attemptNo: number;
  processScore: number | null;
  finalScore: number | null;
  totalScore10: number | null;
  letterGrade: string | null;
  grade4: number | null;
  passed: boolean;
  countedInCpa: boolean;
  reason: 'counted' | 'superseded' | 'not-passed' | 'no-credits' | 'ungraded' | 'excluded';
  attemptKind: AttemptKind;
  isRetake: boolean;
}

export type CurriculumSubjectStatus = 'not-started' | 'studying' | 'passed' | 'failed';

export interface CurriculumSubject {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  isRequired: boolean;
  semesterNo: number | null;
  defaultSemesterNo: number | null;
  personalSemesterNo: number | null;
  effectiveSemesterNo: number | null;
  managingUnit: string;
  isCustomized: boolean;
  inCurriculum: boolean;
  status: CurriculumSubjectStatus;
  attemptCount: number;
  latestAttempt: TranscriptAttempt | null;
  attempts: TranscriptAttempt[];
}

export interface CurriculumSemester {
  semesterNo: number;
  plannedCredits: number;
  completedCredits: number;
  subjects: CurriculumSubject[];
}

export interface TranscriptCurriculum {
  majorId: string;
  majorCode: string;
  majorName: string;
  maxSemesterNo: number;
  semesters: CurriculumSemester[];
}

export interface TranscriptSemester {
  semester: string;
  gpa: number;
  credits: number;
  earnedCredits: number;
  attempts: TranscriptAttempt[];
}

export interface Transcript {
  student: {
    id: string;
    email: string;
    fullName: string;
  };
  summary: {
    cpa: number;
    /** Credits of the attempts counted for CPA (one attempt per subject). */
    creditsAttempted: number;
    /** Accumulated credits: passed subjects counted for CPA. */
    creditsEarned: number;
    /** Credits of every attempt taken, failed subjects and retakes included. */
    creditsStudied?: number;
    countedSubjects: number;
    totalAttempts: number;
  };
  /** Tiến độ của ngành chính so với số tín chỉ tối thiểu. */
  progress?: {
    requiredCredits: number;
    earnedCredits: number;
    programCredits: number;
    percent: number;
    isComplete: boolean;
  } | null;
  semesters: TranscriptSemester[];
  curriculum: TranscriptCurriculum | null;
  /** One block per training programme (2 for dual-major students). */
  majors?: MajorStatistics[];
  /** Tuition for every registered credit, each credit charged exactly once. */
  tuition?: TranscriptTuition;
}

export interface TuitionRow {
  semester: string;
  /** Registered credits (retakes are charged again). */
  credits: number;
  feePerCredit: number | null;
  currency: string;
  amount: number;
  isFallback: boolean;
  majorId: string | null;
}

export interface TranscriptTuition {
  rows: TuitionRow[];
  total: number;
  currency: string;
}

export interface MajorStatistics {
  majorId: string;
  majorCode: string;
  majorName: string;
  isPrimary: boolean;
  summary: Transcript['summary'];
  /** Tiến độ so với số tín chỉ tối thiểu của ngành (chỉ tính môn tính điểm). */
  progress?: {
    requiredCredits: number;
    earnedCredits: number;
    programCredits: number;
    percent: number;
    isComplete: boolean;
  } | null;
  semesters: TranscriptSemester[];
  tuition: TuitionRow[];
  tuitionTotal: number;
  tuitionCurrency: string;
  curriculum: TranscriptCurriculum | null;
}

export interface ForecastResult {
  currentCpa: number;
  currentCredits: number;
  targetCpa: number;
  additionalCredits: number;
  requiredAverageGrade4: number;
  projectedCpa: number;
  feasible: boolean;
  countedSubjects: number;
}

export interface PeriodSlot {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
}

/**
 * Sort key for a semester string so semesters are ordered chronologically
 * instead of lexicographically (e.g. HK2 2024-2025 must come before HK1 2025-2026).
 * Accepts the "HK1 2024-2025", "2024-2025-1" and "2024-1" shapes.
 */
export function semesterSortKey(semester: string): [number, number] {
  const hk = semester.match(/HK(\d)\s+(\d{4})/);
  if (hk) return [Number(hk[2]), Number(hk[1])];
  // "2024-2025-1" → [2024, 1]
  const plain = semester.match(/(\d{4})-\d{4}(?:-(\d+))?/);
  if (plain) return [Number(plain[1]), plain[2] ? Number(plain[2]) : 1];
  // "2024-1" / "2025-10" → [2024, 1] / [2025, 10]
  const short = semester.match(/(\d{4})-(\d{1,2})(?![\d-])/);
  if (short) return [Number(short[1]), Number(short[2])];
  return [0, 0];
}

export interface GradeScale {
  id: string;
  minScore10: number;
  letterGrade: string;
  grade4: number;
  isPass: boolean;
}

export async function fetchAdminGradeScales(token: string): Promise<GradeScale[]> {
  const result = await apiRequest<{ gradeScales: GradeScale[] }>('/admin/grade-scales', { token });
  return result.gradeScales;
}

export async function createAdminGradeScale(token: string, input: Omit<GradeScale, 'id'>): Promise<GradeScale> {
  const result = await apiRequest<{ gradeScale: GradeScale }>('/admin/grade-scales', { method: 'POST', token, body: input });
  return result.gradeScale;
}

export async function updateAdminGradeScale(token: string, id: string, input: Omit<GradeScale, 'id'>): Promise<GradeScale> {
  const result = await apiRequest<{ gradeScale: GradeScale }>(`/admin/grade-scales/${id}`, { method: 'PATCH', token, body: input });
  return result.gradeScale;
}

export async function deleteAdminGradeScale(token: string, id: string): Promise<void> {
  await apiRequest(`/admin/grade-scales/${id}`, { method: 'DELETE', token });
}

export interface DocumentSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  documentCount: number;
}

export interface DocumentItem {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: -1 | 0 | 1;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadTicket {
  uploadUrl: string;
  objectKey: string;
  method: 'PUT';
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export interface DocumentDownload {
  url: string;
  expiresIn: number;
  disposition: 'inline' | 'attachment';
  document: DocumentItem;
}

export interface CourseSection {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: string;
  sectionCode: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  classType: 'lecture' | 'practical';
  meetingCount: number;
  linkedSectionId: string | null;
  startDate: string | null;
  endDate: string | null;
  secondDayOfWeek: number | null;
  secondStartPeriod: number | null;
  secondEndPeriod: number | null;
  /** Tuần (1-based từ tuần đầu học kỳ) mà lớp không học. */
  skippedWeeks: number[];
  /** Ngày cụ thể (YYYY-MM-DD) của các tuần bị nghỉ. */
  skippedWeekDates: string[];
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  isCancelled: boolean;
}

export interface ScheduleItem {
  id: string;
  sectionId: string | null;
  title: string;
  semester: string | null;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startTime: string;
  endTime: string;
  room: string | null;
  note: string | null;
  createdAt: string;
}

export interface ConflictParty {
  id: string;
  kind: 'section' | 'item';
  code: string;
  title: string;
  room: string | null;
}

export interface ScheduleConflict {
  type: 'section-section' | 'section-item';
  dayOfWeek: number;
  overlapStartPeriod: number;
  overlapEndPeriod: number;
  first: ConflictParty;
  second: ConflictParty;
}

export interface ScheduleSimulation {
  semester: string;
  sections: CourseSection[];
  items: ScheduleItem[];
  periods: PeriodSlot[];
  conflicts: ScheduleConflict[];
  cancelledSectionIds: string[];
  summary: {
    sectionCount: number;
    selectedCount: number;
    credits: number;
    conflictCount: number;
    feasible: boolean;
  };
}

export interface ScheduleItemInput {
  title: string;
  semester: string | null;
  weekStart: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startTime?: string;
  endTime?: string;
  room?: string | null;
  note?: string | null;
  sectionId?: string | null;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'ApiError') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const ACCESS_TOKEN_KEY = 'acaschedule.accessToken';
const REFRESH_TOKEN_KEY = 'acaschedule.refreshToken';
const USER_KEY = 'acaschedule.user';

export const authStorage = {
  getAccessToken: () => window.localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => window.localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): ApiUser | null => {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ApiUser;
    } catch {
      return null;
    }
  },
  save: (auth: AuthResponse) => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  },
  saveUser: (user: ApiUser) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

/** Human-readable message when the server did not send one (e.g. proxy errors). */
function defaultErrorMessage(response: Response): string {
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? '');
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? `Vui lòng thử lại sau ${Math.ceil(retryAfter)} giây.`
        : 'Vui lòng thử lại sau ít phút.';
    return `Hệ thống đang giới hạn số yêu cầu (HTTP 429). ${wait}`;
  }
  return `Yêu cầu thất bại (HTTP ${response.status})`;
}

async function parseResponse<T>(response: Response): Promise<T> {  const text = await response.text();
  let body: T | ApiErrorBody | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T | ApiErrorBody;
    } catch {
      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Máy chủ không khả dụng (HTTP ${response.status}). Vui lòng thử lại sau.`,
        );
      }
      throw new ApiError(response.status, 'Phản hồi từ máy chủ không hợp lệ.');
    }
  }

  if (!response.ok) {
    const errorBody = (body ?? {}) as ApiErrorBody;
    const baseMessage = errorBody.message ?? defaultErrorMessage(response);
    // Surface the server request id so a 500 can be traced in the Render logs.
    const message =
      response.status >= 500 && errorBody.requestId
        ? `${baseMessage} (mã lỗi: ${errorBody.requestId})`
        : baseMessage;
    throw new ApiError(response.status, message, errorBody.error);
  }

  return body as T;
}

/**
 * Base URL of the backend.
 * - Local (Docker + nginx): empty → same-origin `/api` (nginx proxies to backend).
 * - Render/static hosts: `VITE_API_URL` is baked at build time to the backend origin.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined ?? '')
  .replace(/\/+$/, '');

/** Callback để cập nhật token trong React AuthContext khi refresh thành công */
let refreshTokenCallback: ((newAccessToken: string | null) => void) | null = null;

/** Đăng ký callback để cập nhật token trong React AuthContext */
export function setRefreshTokenCallback(callback: (newAccessToken: string | null) => void) {
  refreshTokenCallback = callback;
}

/** Làm mới access token bằng refresh token */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      authStorage.clear();
      refreshTokenCallback?.(null);
      return null;
    }

    const data = await response.json();
    if (data.accessToken) {
      authStorage.save({ ...data, user: authStorage.getUser()! });
      refreshTokenCallback?.(data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    authStorage.clear();
    refreshTokenCallback?.(null);
    return null;
  }
}

const NETWORK_ERROR_MESSAGE =
  'Không kết nối được máy chủ. Hệ thống có thể đang khởi động lại — vui lòng thử lại sau 10–30 giây.';

/**
 * `fetch` wrapper that turns browser-level failures ("Failed to fetch") into a
 * readable ApiError. Idempotent GET requests are retried a couple of times so a
 * Render cold start does not surface as an error banner.
 */
async function safeFetch(url: string, init: RequestInit, retry: boolean): Promise<Response> {
  const attempts = retry ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new ApiError(0, 'Yêu cầu đã bị huỷ.', 'Aborted');
  }
  throw new ApiError(0, NETWORK_ERROR_MESSAGE, 'NetworkError');
}

function buildRequestInit(
  method: string,
  body: unknown,
  token: string | null,
): RequestInit {
  return {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const currentToken = token || authStorage.getAccessToken();
  const url = `${API_BASE}/api${path}`;

  const response = await safeFetch(
    url,
    buildRequestInit(method, body, currentToken),
    method === 'GET',
  );

  // Nếu nhận 401 và có token, thử refresh và retry
  if (response.status === 401 && currentToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryResponse = await safeFetch(
        url,
        buildRequestInit(method, body, newToken),
        false,
      );
      return parseResponse<T>(retryResponse);
    }
    // Refresh failed, clear auth
    authStorage.clear();
    refreshTokenCallback?.(null);
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Unauthorized');
  }

  return parseResponse<T>(response);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const auth = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  authStorage.save(auth);
  return auth;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
}

/** Bước 2 của luồng quên mật khẩu: mã xác nhận 6 số + mật khẩu mới. */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await apiRequest('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<ApiUser> {
  const result = await apiRequest<{ user: ApiUser }>('/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  });
  authStorage.saveUser(result.user);
  return result.user;
}

export async function fetchTranscript(token: string): Promise<Transcript> {
  return apiRequest<Transcript>('/student/transcript', { token });
}

export async function updateEnrollment(
  token: string,
  enrollmentId: string,
  input: { processScore: number; finalScore: number },
): Promise<void> {
  await apiRequest(`/student/enrollments/${enrollmentId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function fetchForecast(
  token: string,
  input: { targetCpa: number; additionalCredits: number; plannedGrade4?: number },
): Promise<ForecastResult> {
  return apiRequest<ForecastResult>('/gpa/forecast', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function fetchStudyPlan(token: string, majorId?: string | null): Promise<TranscriptCurriculum> {
  const path = majorId ? `/student/study-plan?majorId=${encodeURIComponent(majorId)}` : '/student/study-plan';
  return apiRequest<TranscriptCurriculum>(path, { token });
}

export async function updateStudyPlanPlacement(
  token: string,
  subjectId: string,
  semesterNo: number | null,
): Promise<TranscriptCurriculum> {
  return apiRequest<TranscriptCurriculum>('/student/study-plan/placements', {
    method: 'PUT',
    token,
    body: { subjectId, semesterNo },
  });
}

export async function resetStudyPlan(token: string): Promise<TranscriptCurriculum> {
  return apiRequest<TranscriptCurriculum>('/student/study-plan/placements', {
    method: 'DELETE',
    token,
  });
}

export async function fetchSchedulePeriods(token: string): Promise<PeriodSlot[]> {
  const result = await apiRequest<{ periods: PeriodSlot[] }>('/schedule/periods', { token });
  return result.periods;
}

export async function fetchScheduleSemesters(token: string): Promise<string[]> {
  const result = await apiRequest<{ semesters: string[] }>('/schedule/semesters', { token });
  return result.semesters;
}

export interface SemesterConfig {
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortNo: number;
}

/** Central semester catalogue shared by every combo box in the app. */
export async function fetchSemesters(token: string): Promise<SemesterConfig[]> {
  const result = await apiRequest<{ semesters: SemesterConfig[] }>('/semesters', { token });
  return result.semesters;
}

export async function fetchAdminSemesters(token: string): Promise<SemesterConfig[]> {
  const result = await apiRequest<{ semesters: SemesterConfig[] }>('/admin/semesters', { token });
  return result.semesters;
}

export async function createAdminSemester(
  token: string,
  input: { code: string; name: string; startDate?: string | null; endDate?: string | null; isActive?: boolean; sortNo?: number },
): Promise<SemesterConfig> {
  const result = await apiRequest<{ semester: SemesterConfig }>('/admin/semesters', {
    method: 'POST',
    token,
    body: input,
  });
  return result.semester;
}

export async function updateAdminSemester(
  token: string,
  code: string,
  input: Partial<{ name: string; startDate: string | null; endDate: string | null; isActive: boolean; sortNo: number }>,
): Promise<SemesterConfig> {
  const result = await apiRequest<{ semester: SemesterConfig }>(`/admin/semesters/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return result.semester;
}

export async function deleteAdminSemester(token: string, code: string): Promise<void> {
  await apiRequest(`/admin/semesters/${encodeURIComponent(code)}`, { method: 'DELETE', token });
}

export async function fetchAdminPeriods(token: string): Promise<PeriodSlot[]> {
  const result = await apiRequest<{ periods: PeriodSlot[] }>('/admin/schedule/periods', { token });
  return result.periods;
}

export async function updateAdminPeriod(token: string, period: number, input: { startTime: string; endTime: string; label: string }): Promise<PeriodSlot> {
  const result = await apiRequest<{ period: PeriodSlot }>(`/admin/schedule/periods/${period}`, { method: 'PATCH', token, body: input });
  return result.period;
}

export async function fetchCourseSections(
  token: string,
  input: { semester: string; includeCancelled?: boolean },
): Promise<CourseSection[]> {
  const query = new URLSearchParams();
  if (input.semester) query.set('semester', input.semester);
  if (input.includeCancelled) query.set('includeCancelled', 'true');
  const result = await apiRequest<{ sections: CourseSection[] }>(
    `/schedule/sections${query.toString() ? `?${query.toString()}` : ''}`,
    { token },
  );
  return result.sections;
}

export async function fetchScheduleItems(
  token: string,
  semester: string,
  weekStart: string,
): Promise<ScheduleItem[]> {
  const query = new URLSearchParams();
  if (semester) query.set('semester', semester);
  query.set('weekStart', weekStart);
  const result = await apiRequest<{ items: ScheduleItem[] }>(
    `/schedule/items${query.toString() ? `?${query.toString()}` : ''}`,
    { token },
  );
  return result.items;
}

export async function runScheduleSimulation(
  token: string,
  input: { semester: string; sectionIds: string[]; includeSavedItems?: boolean; weekStart?: string },
): Promise<ScheduleSimulation> {
  return apiRequest<ScheduleSimulation>('/schedule/simulate', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function registerScheduleSections(token: string, input: { semester: string; sectionIds: string[] }): Promise<{ enrollmentIds: string[] }> {
  return apiRequest<{ enrollmentIds: string[] }>('/student/enrollments/register-sections', { method: 'POST', token, body: input });
}

export async function createScheduleItem(
  token: string,
  input: ScheduleItemInput,
): Promise<{ item: ScheduleItem; conflicts: ScheduleConflict[] }> {
  return apiRequest<{ item: ScheduleItem; conflicts: ScheduleConflict[] }>('/schedule/items', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateScheduleItem(
  token: string,
  itemId: string,
  input: Partial<ScheduleItemInput>,
): Promise<{ item: ScheduleItem; conflicts: ScheduleConflict[] }> {
  return apiRequest<{ item: ScheduleItem; conflicts: ScheduleConflict[] }>(
    `/schedule/items/${itemId}`,
    { method: 'PATCH', token, body: input },
  );
}

export async function deleteScheduleItem(token: string, itemId: string): Promise<void> {
  await apiRequest<null>(`/schedule/items/${itemId}`, { method: 'DELETE', token });
}

export async function fetchDocumentSubjects(token: string): Promise<DocumentSubject[]> {
  const result = await apiRequest<{ subjects: DocumentSubject[] }>('/documents/subjects', { token });
  return result.subjects;
}

export async function fetchDocuments(
  token: string,
  input: { subjectId?: string; q?: string; sort?: 'rank' | 'newest' } = {},
): Promise<DocumentItem[]> {
  const query = new URLSearchParams();
  if (input.subjectId) query.set('subjectId', input.subjectId);
  if (input.q) query.set('q', input.q);
  if (input.sort) query.set('sort', input.sort);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiRequest<{ documents: DocumentItem[] }>(`/documents${suffix}`, { token });
  return result.documents;
}

/** Toàn bộ tài liệu trong hệ thống (dành cho trang quản lý của admin). */
export async function fetchAdminDocuments(
  token: string,
  input: { subjectId?: string; q?: string; sort?: 'rank' | 'newest' } = {},
): Promise<DocumentItem[]> {
  const query = new URLSearchParams();
  if (input.subjectId) query.set('subjectId', input.subjectId);
  if (input.q) query.set('q', input.q);
  if (input.sort) query.set('sort', input.sort);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiRequest<{ documents: DocumentItem[] }>(`/admin/documents${suffix}`, { token });
  return result.documents;
}

/* ── Nhập / xuất dữ liệu hàng loạt ─────────────────────────────────── */

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/** Tải file CSV từ server (bảng điểm hoặc chương trình đào tạo). */
export async function downloadCsv(
  token: string,
  path: string,
  filename: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    headers: { Accept: 'text/csv', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      'Không tải được file CSV.';
    throw new ApiError(response.status, message, 'ExportFailed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importTranscriptCsv(
  token: string,
  csv: string,
  dryRun = false,
): Promise<ImportReport> {
  const result = await apiRequest<{ report: ImportReport }>('/admin/data/import/transcript', {
    method: 'POST',
    token,
    body: { csv, dryRun },
  });
  return result.report;
}

export async function importCurriculumCsv(
  token: string,
  csv: string,
  dryRun = false,
): Promise<ImportReport> {
  const result = await apiRequest<{ report: ImportReport }>('/admin/data/import/curriculum', {
    method: 'POST',
    token,
    body: { csv, dryRun },
  });
  return result.report;
}

/** Nhập cấu hình lịch học (lớp học phần) từ CSV. */
export async function importSectionsCsv(
  token: string,
  csv: string,
  dryRun = false,
): Promise<ImportReport> {
  const result = await apiRequest<{ report: ImportReport }>('/admin/data/import/sections', {
    method: 'POST',
    token,
    body: { csv, dryRun },
  });
  return result.report;
}

export async function presignDocumentUpload(
  token: string,
  input: { subjectId: string; fileName: string; mimeType: string; sizeBytes: number },
): Promise<DocumentUploadTicket> {
  return apiRequest<DocumentUploadTicket>('/documents/uploads/presign', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function createDocumentRecord(
  token: string,
  input: {
    subjectId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    objectKey: string;
    title: string;
  },
): Promise<DocumentItem> {
  const result = await apiRequest<{ document: DocumentItem }>('/documents', {
    method: 'POST',
    token,
    body: input,
  });
  return result.document;
}

export async function voteDocument(
  token: string,
  documentId: string,
  value: -1 | 0 | 1,
): Promise<DocumentItem> {
  const result = await apiRequest<{ document: DocumentItem }>(`/documents/${documentId}/vote`, {
    method: 'POST',
    token,
    body: { value },
  });
  return result.document;
}

export async function fetchDocumentDownload(
  token: string,
  documentId: string,
  inline = false,
): Promise<DocumentDownload> {
  const query = inline ? '?inline=true' : '';
  return apiRequest<DocumentDownload>(`/documents/${documentId}/download${query}`, { token });
}

export interface AiAdviceRequest {
  targetCpa?: number;
  question?: string;
}

export interface AiAdviceResponse {
  advice: string;
  model: string;
  used_fallback: boolean;
}

export interface ActivityLog {
  id: string;
  action: string;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  email: string | null;
  fullName: string | null;
}

export async function fetchActivityLogs(token: string): Promise<ActivityLog[]> {
  const result = await apiRequest<{ logs: ActivityLog[] }>('/admin/activity', { token });
  return result.logs;
}

export interface AdminStats {
  students: number;
  subjects: number;
  documents: number;
  accounts: number;
  majors: number;
  departments: number;
  courseSections: number;
  enrollments: number;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  return apiRequest<AdminStats>('/admin/stats', { token });
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  studentCode: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  majors: Array<{ id: string; code: string; name: string; departmentName: string | null; isPrimary: boolean }>;
}

export async function fetchAdminUsers(token: string): Promise<AdminUser[]> {
  const result = await apiRequest<{ users: AdminUser[] }>('/admin/users', { token });
  return result.users;
}

export async function createAdminUser(
  token: string,
  input: { email: string; fullName: string; phone?: string; studentCode?: string; role?: 'student' | 'admin' },
): Promise<{ user: AdminUser; temporaryPassword: string | null; emailSent: boolean }> {
  const result = await apiRequest<{ user: AdminUser; temporaryPassword: string | null; emailSent: boolean }>('/admin/users', { method: 'POST', token, body: input });
  return result;
}

export async function updateAdminUser(token: string, id: string, input: { email?: string; fullName?: string; phone?: string | null; studentCode?: string | null }): Promise<AdminUser> {
  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', token, body: input });
  return result.user;
}

export async function resetAdminUserPassword(
  token: string,
  id: string,
): Promise<{ temporaryPassword: string | null; emailSent: boolean }> {
  return apiRequest(`/admin/users/${id}/reset-password`, { method: 'POST', token });
}

export async function setAdminUserStatus(token: string, id: string, isActive: boolean): Promise<void> {
  await apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', token, body: { isActive } });
}

export async function deleteAdminUser(token: string, id: string): Promise<void> {
  await apiRequest(`/admin/users/${id}`, { method: 'DELETE', token });
}

export interface AdminSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  knowledgeBlock: string;
  managingUnit: string;
  isActive: boolean;
}

export async function fetchAdminSubjects(token: string): Promise<AdminSubject[]> {
  const result = await apiRequest<{ subjects: AdminSubject[] }>('/admin/subjects', { token });
  return result.subjects;
}

export async function createAdminSubject(
  token: string,
  input: { code: string; name: string; credits: number; knowledgeBlock: string; managingUnit: string },
): Promise<AdminSubject> {
  const result = await apiRequest<{ subject: AdminSubject }>('/admin/subjects', {
    method: 'POST',
    token,
    body: { ...input, processWeight: 0.4, finalWeight: 0.6 },
  });
  return result.subject;
}

export async function updateAdminSubject(
  token: string,
  id: string,
  input: { code: string; name: string; credits: number; knowledgeBlock: string; managingUnit: string },
): Promise<AdminSubject> {
  const result = await apiRequest<{ subject: AdminSubject }>(`/admin/subjects/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return result.subject;
}

export interface AdminMajor {
  id: string;
  code: string;
  name: string;
  subjectCount: number;
  /** Số tín chỉ tối thiểu của ngành; null = dùng tổng tín chỉ chương trình. */
  minimumCredits: number | null;
  /** Tổng tín chỉ của các môn tính điểm trong chương trình. */
  programCredits: number;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
}

export interface AdminDepartment {
  id: string;
  code: string;
  name: string;
  majorCount: number;
}

export async function fetchAdminDepartments(token: string): Promise<AdminDepartment[]> {
  const result = await apiRequest<{ departments: AdminDepartment[] }>('/admin/curriculum/departments', { token });
  return result.departments;
}

export async function createAdminDepartment(token: string, input: { code: string; name: string }): Promise<AdminDepartment> {
  const result = await apiRequest<{ department: AdminDepartment }>('/admin/curriculum/departments', { method: 'POST', token, body: input });
  return result.department;
}

export interface CurriculumSubject extends AdminSubject {
  isRequired: boolean;
  semesterNo: number | null;
  calculateGrade: boolean;
  processWeight: number;
  finalWeight: number;
}

export async function fetchAdminMajors(token: string): Promise<AdminMajor[]> {
  const result = await apiRequest<{ majors: AdminMajor[] }>('/admin/curriculum/majors', { token });
  return result.majors;
}

export async function createAdminMajor(
  token: string,
  input: { code: string; name: string; departmentId: string; minimumCredits?: number | null },
): Promise<AdminMajor> {
  const result = await apiRequest<{ major: AdminMajor }>('/admin/curriculum/majors', {
    method: 'POST', token, body: input,
  });
  return result.major;
}

export async function updateAdminMajor(
  token: string,
  id: string,
  input: { code?: string; name?: string; departmentId?: string; minimumCredits?: number | null },
): Promise<AdminMajor> {
  const result = await apiRequest<{ major: AdminMajor }>(`/admin/curriculum/majors/${id}`, { method: 'PATCH', token, body: input });
  return result.major;
}

export async function fetchCurriculumSubjects(token: string, majorId: string): Promise<CurriculumSubject[]> {
  const result = await apiRequest<{ subjects: CurriculumSubject[] }>(`/admin/curriculum/majors/${majorId}/subjects`, { token });
  return result.subjects;
}

export async function fetchAdminEnrollments(token: string, studentId: string): Promise<TranscriptAttempt[]> {
  const result = await apiRequest<{ enrollments: TranscriptAttempt[] }>(
    `/admin/enrollments?studentId=${encodeURIComponent(studentId)}`,
    { token },
  );
  return result.enrollments;
}

export async function createAdminEnrollment(
  token: string,
  input: {
    studentId: string;
    subjectId: string;
    semester: string;
    processScore?: number;
    finalScore?: number;
  },
): Promise<{ enrollment: TranscriptAttempt | null }> {
  return apiRequest('/admin/enrollments', { method: 'POST', token, body: input });
}

export async function updateAdminEnrollment(
  token: string,
  studentId: string,
  enrollmentId: string,
  input: { processScore: number; finalScore: number },
): Promise<void> {
  await apiRequest(`/admin/enrollments/${enrollmentId}?studentId=${encodeURIComponent(studentId)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function deleteAdminEnrollment(token: string, studentId: string, enrollmentId: string): Promise<void> {
  await apiRequest(`/admin/enrollments/${enrollmentId}?studentId=${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function assignCurriculumSubject(
  token: string,
  majorId: string,
  input: {
    subjectId: string;
    isRequired: boolean;
    semesterNo: number | null;
    calculateGrade?: boolean;
    processWeight?: number;
    finalWeight?: number;
  },
): Promise<void> {
  await apiRequest(`/admin/curriculum/majors/${majorId}/subjects`, { method: 'POST', token, body: input });
}

export async function removeCurriculumSubject(token: string, majorId: string, subjectId: string): Promise<void> {
  await apiRequest(`/admin/curriculum/majors/${majorId}/subjects/${subjectId}`, { method: 'DELETE', token });
}

export interface MajorStudent {
  id: string;
  email: string;
  fullName: string;
  isPrimary: boolean;
}

export async function fetchMajorStudents(token: string, majorId: string): Promise<MajorStudent[]> {
  const result = await apiRequest<{ students: MajorStudent[] }>(`/admin/curriculum/majors/${majorId}/students`, { token });
  return result.students;
}

export async function assignStudentMajor(
  token: string,
  majorId: string,
  userId: string,
  isPrimary: boolean,
): Promise<void> {
  await apiRequest(`/admin/curriculum/majors/${majorId}/students`, {
    method: 'POST', token, body: { userId, isPrimary },
  });
}

export async function removeStudentMajor(token: string, majorId: string, userId: string): Promise<void> {
  await apiRequest(`/admin/curriculum/majors/${majorId}/students/${userId}`, { method: 'DELETE', token });
}

export interface AdminCourseSection extends CourseSection {}

export async function fetchAdminScheduleSections(token: string, semester?: string): Promise<AdminCourseSection[]> {
  const query = semester ? `?semester=${encodeURIComponent(semester)}` : '';
  const result = await apiRequest<{ sections: AdminCourseSection[] }>(`/admin/schedule/sections${query}`, { token });
  return result.sections;
}

export type AdminCourseSectionInput = Omit<
  AdminCourseSection,
  'id' | 'subjectCode' | 'subjectName' | 'credits' | 'skippedWeekDates'
>;

export async function createAdminScheduleSection(token: string, input: AdminCourseSectionInput): Promise<AdminCourseSection> {
  const result = await apiRequest<{ section: AdminCourseSection }>('/admin/schedule/sections', { method: 'POST', token, body: input });
  return result.section;
}

export async function updateAdminScheduleSection(token: string, id: string, input: AdminCourseSectionInput): Promise<AdminCourseSection> {
  const result = await apiRequest<{ section: AdminCourseSection }>(`/admin/schedule/sections/${id}`, { method: 'PATCH', token, body: input });
  return result.section;
}

export async function deleteAdminScheduleSection(token: string, id: string): Promise<void> {
  await apiRequest(`/admin/schedule/sections/${id}`, { method: 'DELETE', token });
}

export async function fetchAiAdvice(
  token: string,
  input: AiAdviceRequest,
): Promise<AiAdviceResponse> {
  return apiRequest<AiAdviceResponse>('/ai/advice', {
    method: 'POST',
    token,
    body: input,
  });
}

export interface TuitionFee {
  id: string;
  semester: string;
  majorId: string | null;
  majorCode: string | null;
  majorName: string | null;
  feePerCredit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRegistrationConfig(
  token: string,
  semester: string,
): Promise<{ isOpen: boolean; openedAt: string | null; closedAt: string | null }> {
  const result = await apiRequest<{ registrationConfig: {
    isOpen: boolean;
    openedAt: string | null;
    closedAt: string | null;
  } }>(`/schedule/registration-status?semester=${encodeURIComponent(semester)}`, { token });
  return result.registrationConfig;
}

export async function updateRegistrationConfigAPI(
  token: string,
  semester: string,
  isOpen: boolean,
  openedAt: string | null,
  closedAt: string | null,
): Promise<{ success: boolean }> {
  await apiRequest<{ success: boolean }>(
    `/admin/schedule/registration-config`,
    { method: 'PATCH', token, body: { semester, isOpen, openedAt, closedAt } },
  );
  return { success: true };
}

export async function fetchTuitionFee(token: string, semester: string): Promise<TuitionFee> {
  return apiRequest<TuitionFee>(`/tuition-fees/${semester}`, { token });
}

export async function fetchTuitionFees(token: string): Promise<TuitionFee[]> {
  const result = await apiRequest<{ tuitionFees: TuitionFee[] }>('/tuition-fees', { token });
  return result.tuitionFees;
}

export async function saveTuitionFee(
  token: string,
  input: { semester: string; majorId: string | null; feePerCredit: number; currency?: string },
): Promise<TuitionFee> {
  return apiRequest<TuitionFee>('/tuition-fees', {
    method: 'POST',
    token,
    body: input,
  });
}

/* ── Admin · AI providers, keys & usage ─────────────────────────────── */

export type AiProvider = 'gemini' | 'openrouter';

export interface AdminAiSettings {
  isEnabled: boolean;
  providerOrder: string;
  geminiModel: string;
  openrouterModel: string;
  dailyLimit: number;
  updatedAt: string;
}

export interface AdminAiKey {
  id: string;
  provider: AiProvider;
  label: string;
  hint: string;
  isActive: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface AdminAiOverview {
  settings: AdminAiSettings;
  keys: Record<AiProvider, { total: number; active: number }>;
  keyStorageConfigured: boolean;
  usage: {
    today: number;
    week: number;
    month: number;
    fallbackMonth: number;
    avgLatencyMs: number;
  };
  providers: Array<{ provider: string; count: number; fallback: number }>;
  series: Array<{ day: string; total: number; fallback: number }>;
}

export interface AdminAiUserUsage {
  id: string;
  email: string;
  fullName: string | null;
  studentCode: string | null;
  dailyLimit: number | null;
  today: number;
  week: number;
  total: number;
  fallback: number;
  lastUsedAt: string | null;
  avgLatencyMs: number;
}

export interface AdminAiLog {
  id: string;
  endpoint: string;
  provider: string;
  usedFallback: boolean;
  latencyMs: number;
  statusCode: number | null;
  createdAt: string;
  email: string | null;
  fullName: string | null;
}

export interface AiHealth {
  status?: string;
  gemini_configured?: boolean;
  gemini_keys?: number;
  openrouter_configured?: boolean;
  openrouter_keys?: number;
  model?: string;
  openrouter_model?: string;
  provider_order?: string[];
  remote_config?: boolean;
}

export async function fetchAdminAiOverview(token: string, days = 14): Promise<AdminAiOverview> {
  return apiRequest<AdminAiOverview>(`/admin/ai/overview?days=${days}`, { token });
}

export async function fetchAdminAiUsage(
  token: string,
  days = 30,
  search = '',
): Promise<AdminAiUserUsage[]> {
  const query = `days=${days}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const result = await apiRequest<{ users: AdminAiUserUsage[] }>(`/admin/ai/usage?${query}`, {
    token,
  });
  return result.users;
}

export async function fetchAdminAiLogs(token: string, limit = 100): Promise<AdminAiLog[]> {
  const result = await apiRequest<{ logs: AdminAiLog[] }>(`/admin/ai/logs?limit=${limit}`, {
    token,
  });
  return result.logs;
}

export async function fetchAdminAiKeys(
  token: string,
): Promise<{ keys: AdminAiKey[]; keyStorageConfigured: boolean }> {
  return apiRequest<{ keys: AdminAiKey[]; keyStorageConfigured: boolean }>('/admin/ai/keys', {
    token,
  });
}

export async function createAdminAiKey(
  token: string,
  input: { provider: AiProvider; label: string; key: string; priority: number },
): Promise<AdminAiKey> {
  const result = await apiRequest<{ key: AdminAiKey }>('/admin/ai/keys', {
    method: 'POST',
    token,
    body: input,
  });
  return result.key;
}

export async function updateAdminAiKey(
  token: string,
  id: string,
  input: { label?: string; key?: string; isActive?: boolean; priority?: number },
): Promise<AdminAiKey> {
  const result = await apiRequest<{ key: AdminAiKey }>(`/admin/ai/keys/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return result.key;
}

export async function deleteAdminAiKey(token: string, id: string): Promise<void> {
  await apiRequest(`/admin/ai/keys/${id}`, { method: 'DELETE', token });
}

export async function updateAdminAiSettings(
  token: string,
  input: Partial<{
    isEnabled: boolean;
    providerOrder: string;
    geminiModel: string;
    openrouterModel: string;
    dailyLimit: number;
  }>,
): Promise<AdminAiSettings> {
  const result = await apiRequest<{ settings: AdminAiSettings }>('/admin/ai/settings', {
    method: 'PATCH',
    token,
    body: input,
  });
  return result.settings;
}

export async function setAdminAiUserLimit(
  token: string,
  userId: string,
  dailyLimit: number | null,
): Promise<void> {
  await apiRequest(`/admin/ai/users/${userId}/limit`, {
    method: 'PATCH',
    token,
    body: { dailyLimit },
  });
}

export async function fetchAiHealth(token: string): Promise<AiHealth> {
  return apiRequest<AiHealth>('/ai/status', { token });
}

/* ── Thông báo hệ thống ─────────────────────────────────────────────── */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  isActive: boolean;
  /** ISO string; null = không hết hạn. */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Bản đầy đủ cho trang quản trị (có thêm email người tạo). */
export interface AdminNotification extends SystemNotification {
  createdByEmail: string | null;
}

export interface NotificationInput {
  title: string;
  message: string;
  level: NotificationLevel;
  isActive: boolean;
  /** ISO string; null = không hết hạn. */
  expiresAt: string | null;
}

/** Thông báo đang hiện với người dùng (dùng cho lớp thông báo). */
export async function fetchNotifications(token: string): Promise<SystemNotification[]> {
  const result = await apiRequest<{ notifications: SystemNotification[] }>('/notifications', {
    token,
  });
  return result.notifications;
}

/** Toàn bộ thông báo gồm cả đã ẩn / quá hạn (dành cho trang quản trị). */
export async function fetchAdminNotifications(token: string): Promise<AdminNotification[]> {
  const result = await apiRequest<{ notifications: AdminNotification[] }>('/admin/notifications', {
    token,
  });
  return result.notifications;
}

export async function createAdminNotification(
  token: string,
  input: NotificationInput,
): Promise<AdminNotification> {
  const result = await apiRequest<{ notification: AdminNotification }>('/admin/notifications', {
    method: 'POST',
    token,
    body: input,
  });
  return result.notification;
}

export async function updateAdminNotification(
  token: string,
  id: string,
  input: Partial<NotificationInput>,
): Promise<AdminNotification> {
  const result = await apiRequest<{ notification: AdminNotification }>(
    `/admin/notifications/${id}`,
    { method: 'PATCH', token, body: input },
  );
  return result.notification;
}

export async function deleteAdminNotification(token: string, id: string): Promise<void> {
  await apiRequest(`/admin/notifications/${id}`, { method: 'DELETE', token });
}

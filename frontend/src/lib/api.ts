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
  reason: 'counted' | 'superseded' | 'not-passed' | 'no-credits' | 'ungraded';
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
    creditsAttempted: number;
    creditsEarned: number;
    countedSubjects: number;
    totalAttempts: number;
  };
  semesters: TranscriptSemester[];
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

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
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
    throw new ApiError(
      response.status,
      errorBody.message ?? `Yêu cầu thất bại (HTTP ${response.status})`,
      errorBody.error,
    );
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

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const currentToken = token || authStorage.getAccessToken();

  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  // Nếu nhận 401 và có token, thử refresh và retry
  if (response.status === 401 && currentToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryResponse = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          Authorization: `Bearer ${newToken}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
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

export async function fetchStudyPlan(token: string): Promise<TranscriptCurriculum> {
  return apiRequest<TranscriptCurriculum>('/student/study-plan', { token });
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

export async function createAdminMajor(token: string, input: { code: string; name: string; departmentId: string }): Promise<AdminMajor> {
  const result = await apiRequest<{ major: AdminMajor }>('/admin/curriculum/majors', {
    method: 'POST', token, body: input,
  });
  return result.major;
}

export async function updateAdminMajor(token: string, id: string, input: { code?: string; name?: string; departmentId?: string }): Promise<AdminMajor> {
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

export type AdminCourseSectionInput = Omit<AdminCourseSection, 'id' | 'subjectCode' | 'subjectName' | 'credits'>;

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

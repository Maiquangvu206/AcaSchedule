export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

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
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
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

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

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

export async function fetchTranscript(token: string): Promise<Transcript> {
  return apiRequest<Transcript>('/student/transcript', { token });
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

export async function fetchSchedulePeriods(token: string): Promise<PeriodSlot[]> {
  const result = await apiRequest<{ periods: PeriodSlot[] }>('/schedule/periods', { token });
  return result.periods;
}

export async function fetchCourseSections(
  token: string,
  input: { semester: string; includeCancelled?: boolean },
): Promise<CourseSection[]> {
  const query = new URLSearchParams({ semester: input.semester });
  if (input.includeCancelled) query.set('includeCancelled', 'true');
  const result = await apiRequest<{ sections: CourseSection[] }>(
    `/schedule/sections?${query.toString()}`,
    { token },
  );
  return result.sections;
}

export async function fetchScheduleItems(
  token: string,
  semester: string,
): Promise<ScheduleItem[]> {
  const query = new URLSearchParams({ semester });
  const result = await apiRequest<{ items: ScheduleItem[] }>(
    `/schedule/items?${query.toString()}`,
    { token },
  );
  return result.items;
}

export async function runScheduleSimulation(
  token: string,
  input: { semester: string; sectionIds: string[]; includeSavedItems?: boolean },
): Promise<ScheduleSimulation> {
  return apiRequest<ScheduleSimulation>('/schedule/simulate', {
    method: 'POST',
    token,
    body: input,
  });
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

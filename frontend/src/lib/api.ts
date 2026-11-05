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
  const body = text ? (JSON.parse(text) as T | ApiErrorBody) : null;

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

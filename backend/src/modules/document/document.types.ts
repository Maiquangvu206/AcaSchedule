export interface DocumentSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  documentCount: number;
}

export interface DocumentView {
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
  /** Bị ẩn khỏi sinh viên (chỉ admin thấy/quản lý). */
  isHidden: boolean;
  /** Bị khóa: sinh viên không thể xem/tải/bình chọn. */
  isLocked: boolean;
}

export interface UploadTicket {
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
  document: DocumentView;
}

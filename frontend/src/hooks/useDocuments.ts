import { useCallback, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchDocumentSubjects,
  fetchDocuments,
  presignDocumentUpload,
  createDocumentRecord,
  voteDocument,
  fetchDocumentDownload,
  type DocumentSubject,
  type DocumentItem,
  type DocumentUploadTicket,
  type DocumentDownload,
} from '../lib/api';

export interface UseDocumentsState {
  subjects: DocumentSubject[];
  documents: DocumentItem[];
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  sort: 'rank' | 'newest';
  setSort: (value: 'rank' | 'newest') => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  presignUpload: (
    input: { subjectId: string; fileName: string; mimeType: string; sizeBytes: number },
  ) => Promise<DocumentUploadTicket>;
  confirmUpload: (
    input: {
      subjectId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      objectKey: string;
      title: string;
    },
  ) => Promise<void>;
  handleVote: (documentId: string, value: -1 | 0 | 1) => Promise<void>;
  getDownload: (documentId: string, inline?: boolean) => Promise<DocumentDownload>;
}

/** Data layer hook for document hub. Encapsulates subjects, documents,
 *  presigned upload, vote, and download. */
export function useDocuments(): UseDocumentsState {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<DocumentSubject[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<'rank' | 'newest'>('rank');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchDocumentSubjects(token);
      setSubjects(data);
      if (!selectedSubject && data.length > 0) {
        setSelectedSubject(data[0].id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được môn học');
    }
  }, [token, selectedSubject]);

  const loadDocuments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(token, {
        ...(selectedSubject ? { subjectId: selectedSubject } : {}),
        ...(searchInput.trim() ? { q: searchInput.trim() } : {}),
        sort,
      });
      setDocuments(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được tài liệu');
    } finally {
      setLoading(false);
    }
  }, [token, selectedSubject, searchInput, sort]);

  useEffect(() => {
    loadSubjects();
    loadDocuments();
  }, [token, loadSubjects, loadDocuments]);

  const debounceTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
      set: (callback: () => void, ms: number) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(callback, ms);
      },
      clear: () => {
        if (timer) clearTimeout(timer);
      },
    };
  }, []);

  useEffect(() => {
    debounceTimer.set(() => {
      void loadDocuments();
    }, 300);
    return () => debounceTimer.clear();
  }, [searchInput, loadDocuments, debounceTimer]);

  const presignUpload = useCallback(
    async (input: {
      subjectId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }) => {
      if (!token) throw new Error('Chưa đăng nhập');
      return presignDocumentUpload(token, input);
    },
    [token],
  );

  const confirmUpload = useCallback(
    async (input: {
      subjectId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      objectKey: string;
      title: string;
    }) => {
      if (!token) throw new Error('Chưa đăng nhập');
      const document = await createDocumentRecord(token, input);
      setDocuments((current) => [...current, document]);
    },
    [token],
  );

  const handleVote = useCallback(
    async (documentId: string, value: -1 | 0 | 1) => {
      if (!token) return;
      try {
        const updated = await voteDocument(token, documentId, value);
        setDocuments((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không ghi nhận bình chọn');
        throw caught;
      }
    },
    [token],
  );

  const getDownload = useCallback(
    async (documentId: string, inline = false) => {
      if (!token) throw new Error('Chưa đăng nhập');
      return fetchDocumentDownload(token, documentId, inline);
    },
    [token],
  );

  const refetch = useCallback(() => {
    void loadDocuments();
  }, [loadDocuments]);

  return {
    subjects,
    documents,
    selectedSubject,
    setSelectedSubject,
    searchInput,
    setSearchInput,
    sort,
    setSort,
    loading,
    error,
    refetch,
    presignUpload,
    confirmUpload,
    handleVote,
    getDownload,
  };
}

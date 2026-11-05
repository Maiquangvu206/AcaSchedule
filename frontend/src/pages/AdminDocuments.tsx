import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchDocuments, type DocumentItem } from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminDocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  useEffect(() => { if (token) fetchDocuments(token, { sort: 'newest' }).then(setDocuments).catch(() => setDocuments([])); }, [token]);
  return <AdminListPage title="Quản lý tài liệu" description="Theo dõi thống kê và quản lý tài liệu cộng đồng."><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tài liệu</th><th className="px-4 py-3">Môn học</th><th className="px-4 py-3">Điểm đánh giá</th><th className="px-4 py-3">Người tải</th></tr></thead><tbody className="divide-y">{documents.map((item) => <tr key={item.id}><td className="px-4 py-3 font-medium">{item.title}</td><td className="px-4 py-3">{item.subjectCode}</td><td className="px-4 py-3">{item.score}</td><td className="px-4 py-3">{item.uploaderName}</td></tr>)}</tbody></table>{!documents.length ? <p className="p-8 text-center text-sm text-slate-500">Chưa có tài liệu.</p> : null}</AdminListPage>;
}

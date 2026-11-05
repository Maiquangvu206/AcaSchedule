import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Dashboard as DashboardPage } from './pages/Dashboard';
import { DocumentsPage } from './pages/Documents';
import { AIPage } from './pages/AI';
import { AdminDashboard } from './pages/AdminDashboard';
import { Login } from './pages/Login';
import { SchedulePage } from './pages/Schedule';
import { TranscriptPage } from './pages/Transcript';
import { AdminRoute } from './auth/AdminRoute';
import { AdminActivityPage } from './pages/AdminActivity';
import { AdminUsersPage } from './pages/AdminUsers';
import { AdminSubjectsPage } from './pages/AdminSubjects';
import { AdminTuitionPage } from './pages/AdminTuition';
import { AdminDocumentsPage } from './pages/AdminDocuments';
import { AdminSchedulePage } from './pages/AdminSchedule';
import { AdminMajorsPage } from './pages/AdminMajors';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="transcript" element={<TranscriptPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="ai" element={<AIPage />} />
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="admin/users" element={<AdminUsersPage />} />
                <Route path="admin/majors" element={<AdminMajorsPage />} />
                <Route path="admin/subjects" element={<AdminSubjectsPage />} />
                <Route path="admin/tuition" element={<AdminTuitionPage />} />
                <Route path="admin/schedule" element={<AdminSchedulePage />} />
                <Route path="admin/documents" element={<AdminDocumentsPage />} />
                <Route path="admin/activity" element={<AdminActivityPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

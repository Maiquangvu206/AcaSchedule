import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard as DashboardPage } from './pages/Dashboard';
import { DocumentsPage } from './pages/Documents';
import { AIPage } from './pages/AI';
import { AdminDashboard } from './pages/AdminDashboard';
import { Login } from './pages/Login';
import { SchedulePage } from './pages/Schedule';
import { TranscriptPage } from './pages/Transcript';
import { StudyPlanPage } from './pages/StudyPlan';
import { AdminEnrollmentsPage } from './pages/AdminEnrollments';
import { AdminSemestersPage } from './pages/AdminSemesters';
import { AdminRoute } from './auth/AdminRoute';
import { AdminActivityPage } from './pages/AdminActivity';
import { AdminAiPage } from './pages/AdminAi';
import { AdminUsersPage } from './pages/AdminUsers';
import { AdminSubjectsPage } from './pages/AdminSubjects';
import { AdminTuitionPage } from './pages/AdminTuition';
import { AdminDocumentsPage } from './pages/AdminDocuments';
import { AdminDataPage } from './pages/AdminData';
import { AdminSchedulePage } from './pages/AdminSchedule';
import { AdminMajorsPage } from './pages/AdminMajors';
import { AdminPeriodsPage } from './pages/AdminPeriods';
import { AdminGradeScalesPage } from './pages/AdminGradeScales';
import { ChangePasswordPage } from './pages/ChangePassword';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="change-password" element={<ProtectedRoute />} >
            <Route index element={<ChangePasswordPage />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route element={<ProtectedRoute />}>
              <Route index element={<DashboardPage />} />
              <Route path="transcript" element={<TranscriptPage />} />
              <Route path="study-plan" element={<StudyPlanPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="ai" element={<AIPage />} />
            </Route>
          </Route>

          {/* Admin dùng layout riêng: menu chức năng ở cột bên trái. */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/semesters" element={<AdminSemestersPage />} />
              <Route path="admin/enrollments" element={<AdminEnrollmentsPage />} />
              <Route path="admin/majors" element={<AdminMajorsPage />} />
              <Route path="admin/subjects" element={<AdminSubjectsPage />} />
              <Route path="admin/tuition" element={<AdminTuitionPage />} />
              <Route path="admin/schedule" element={<AdminSchedulePage />} />
              <Route path="admin/periods" element={<AdminPeriodsPage />} />
              <Route path="admin/grade-scales" element={<AdminGradeScalesPage />} />
              <Route path="admin/documents" element={<AdminDocumentsPage />} />
              <Route path="admin/data" element={<AdminDataPage />} />
              <Route path="admin/activity" element={<AdminActivityPage />} />
              <Route path="admin/ai" element={<AdminAiPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

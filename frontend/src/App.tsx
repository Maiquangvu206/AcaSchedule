import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { DocumentsPage } from './pages/Documents';
import { AIPage } from './pages/AI';
import { Login } from './pages/Login';
import { SchedulePage } from './pages/Schedule';
import { TranscriptPage } from './pages/Transcript';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="transcript" element={<TranscriptPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="ai" element={<AIPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

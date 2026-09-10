import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import IdleScreen from './pages/IdleScreen'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import AdminLogin from './pages/admin/AdminLogin'
import StudentPortal from './pages/student/StudentPortal'
import TeacherPortal from './pages/teacher/TeacherPortal'
import AdminPortal from './pages/admin/AdminPortal'
import SmartboardPage from './pages/tools/SmartboardPage'
import CanvasModePage from './pages/tools/CanvasModePage'
import SplitScreenPage from './pages/tools/SplitScreenPage'
import FormulaFinderPage from './pages/tools/FormulaFinderPage'
import HealthPage from './pages/tools/HealthPage'
import { LoadingSpinner } from './components/ui/EmptyState'
import KioskKeyboardManager from './components/ui/KioskKeyboardManager'

function RequireAuth({ children, role }: { children: React.ReactNode; role: string }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/" replace />
  if (user.isFirstLogin) return <Navigate to="/change-password" replace />
  return <>{children}</>
}

function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/admin/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />
  if (user.isFirstLogin) return <Navigate to="/change-password" replace />
  return <>{children}</>
}

function AuthRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.isFirstLogin) return <Navigate to="/change-password" replace />
  if (user.role === 'STUDENT') return <Navigate to="/student" replace />
  if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <KioskKeyboardManager />
        <Routes>
          {/* Public */}
          <Route path="/" element={<IdleScreen />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<AuthRedirect />} />

          {/* Student Portal */}
          <Route
            path="/student/*"
            element={
              <RequireAuth role="STUDENT">
                <StudentPortal />
              </RequireAuth>
            }
          />

          {/* Teacher Portal */}
          <Route
            path="/teacher/*"
            element={
              <RequireAuth role="TEACHER">
                <TeacherPortal />
              </RequireAuth>
            }
          />

          {/* Admin Portal */}
          <Route
            path="/admin/*"
            element={
              <RequireAdminAuth>
                <AdminPortal />
              </RequireAdminAuth>
            }
          />

          {/* Public tools */}
          <Route path="/health"      element={<HealthPage />} />
          <Route path="/smartboard"  element={<SmartboardPage />} />
          <Route path="/canvas"      element={<CanvasModePage />} />
          <Route path="/splitscreen" element={<SplitScreenPage />} />
          <Route path="/formula"     element={<FormulaFinderPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

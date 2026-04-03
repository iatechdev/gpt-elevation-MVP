import { Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage }    from './pages/LandingPage.tsx'
import { LoginPage }      from './pages/LoginPage.tsx'
import { CheckinPage }    from './pages/CheckinPage.tsx'
import { ChatPage }       from './pages/ChatPage.tsx'
import { PricingPage }    from './pages/PricingPage.tsx'
import { AdminLayout }    from './layouts/AdminLayout.tsx'
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx'
import { AdminPrompts }   from './pages/admin/AdminPrompts.tsx'
import { AdminContent } from './pages/admin/AdminContent.tsx'
import { AdminUsers }  from './pages/admin/AdminUsers.tsx'
import { AdminMetrics }  from './pages/admin/AdminMetrics.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AdminRoute }     from './components/AdminRoute.tsx'
import { TherapistLayout }    from './layouts/TherapistLayout.tsx'
import { TherapistDashboard } from './pages/therapist/TherapistDashboard.tsx'
import { TherapistPatient }   from './pages/therapist/TherapistPatient.tsx'
import { TherapistRoute }     from './components/TherapistRoute.tsx'
import { UserProgress } from './pages/UserProgress.tsx'
import { UserDashboard } from './pages/UserDashboard.tsx'

export default function App() {
  return (
    <Routes>

      {/* Públicas */}
      <Route path="/"        element={<LandingPage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/precios" element={<PricingPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Usuario regular */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app/checkin" element={<CheckinPage />} />
        <Route path="/app/chat"    element={<ChatPage />} />
        <Route path="/app/progress" element={<UserProgress />} />
        <Route path="/app/dashboard" element={<UserDashboard />} />
      </Route>

      {/* Backoffice admin/superadmin */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="prompts"   element={<AdminPrompts />} />
        <Route path="contenido" element={<AdminContent />} />
        <Route path="usuarios"  element={<AdminUsers  />} />
        <Route path="metricas"  element={<AdminMetrics  />} />
      </Route>

{/* Therapist */}
<Route element={<TherapistRoute />}>
  <Route element={<TherapistLayout />}>
    <Route path="/therapist/dashboard" element={<TherapistDashboard />} />
    <Route path="/therapist/patient/:id" element={<TherapistPatient />} />
  </Route>
</Route>


      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  )
}
// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { LandingPage }    from './pages/LandingPage.tsx'
import { LoginPage }      from './pages/LoginPage.tsx'
import { ProfessionalApplicationPage } from './professional/ProfessionalApplicationPage.tsx'
import { CheckinPage }    from './pages/CheckinPage.tsx'
import { ChatPage }       from './pages/ChatPage.tsx'
import { PricingPage }    from './pages/PricingPage.tsx'
import { AdminLayout }    from './layouts/AdminLayout.tsx'
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx'
import { AdminPrompts }   from './pages/admin/AdminPrompts.tsx'
import { AdminContent }   from './pages/admin/AdminContent.tsx'
import { AdminUsers }     from './pages/admin/AdminUsers.tsx'
import { AdminMetrics }   from './pages/admin/AdminMetrics.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AdminRoute }     from './components/AdminRoute.tsx'
import { TherapistLayout }    from './layouts/TherapistLayout.tsx'
import { TherapistDashboard } from './pages/therapist/TherapistDashboard.tsx'
import { TherapistPatient }   from './pages/therapist/TherapistPatient.tsx'
import { SessionRoom }        from './pages/therapist/SessionRoom.tsx'
import { UserSessionRoom }    from './pages/user/SessionRoom.tsx'
import { TherapistRoute }     from './components/TherapistRoute.tsx'
import { UserProgress }  from './pages/UserProgress.tsx'
import { UserDashboard } from './pages/UserDashboard.tsx'
import { MyTherapist }   from './pages/MyTherapist.tsx'
import { Onboarding }    from './pages/Onboarding.tsx'
import { EvidenceListPage, EvidenceDetailPage, EvidenceCreatePage } from './pages/EvidencePages.tsx'
import { SkillMapPage }  from './pages/SkillMapPage.tsx'
import { BoardRoute }    from './components/BoardRoute.tsx'
import { BoardLayout }   from './layouts/BoardLayout.tsx'
import { BoardManifest } from './pages/board/BoardManifest.tsx'
import { FacilitationPreview } from './facilitation/FacilitationPreview'
import { Participants, ParticipantDetail, NewReview, OwnReviews } from './facilitation/Pages'
import { CatalogBrowser, CatalogManager } from './routeCatalog/CatalogPages'
import { CompassPage } from './compass/CompassPage'
import { CareerShell } from './career/CareerShell'
import { RoutesScreen, ExperimentList, ExperimentScreen, PlanScreen } from './career/CareerPages'
import { ExercisePage } from './exercises/ExercisePage'

import { FeedbackPage } from './pilot/FeedbackPage'
import { PilotMetricsPage } from './pilot/PilotMetricsPage'
import { RegisteredRoutes } from './space/RegisteredRoutes'
import { JournalPage } from './space/JournalPage'
import { BridgePage } from './bridge/BridgePage'
import { SpaceToolsPage } from './space/SpaceToolsPage'
import { SpaceSession } from './space/SpaceSession'
export default function App() {
  return (
    <RegisteredRoutes><Routes>

      {/* Public */}
      <Route path="/"        element={<LandingPage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/profesionales" element={<ProfessionalApplicationPage />} /> {/* ES-95 — solicitud pública de profesionales */}
      <Route path="/pricing" element={<PricingPage />} />

      {/* Regular user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<FacilitationPreview />}>
          <Route path="/facilitation" element={<Participants />} />
          <Route path="/facilitation/participants/:id" element={<ParticipantDetail />} />
          <Route path="/facilitation/participants/:id/reviews/new" element={<NewReview />} />
          <Route path="/app/professional-reviews" element={<OwnReviews />} />
        </Route>
        <Route path="/app/feedback" element={<FeedbackPage />} />
        <Route path="/app/route-catalog" element={<CatalogBrowser />} />
        <Route path="/app/route-catalog/roles/:roleKey" element={<CatalogBrowser />} />
        <Route path="/app/compass" element={<CompassPage />} />
        <Route path="/app/next-step" element={<CareerShell />}>
          <Route index element={<RoutesScreen />} />
          <Route path="experiments" element={<ExperimentList />} />
          <Route path="experiments/:id" element={<ExperimentScreen />} />
          <Route path="plan" element={<PlanScreen />} />
        </Route>
        <Route path="/app/exercises" element={<ExercisePage />} />
        <Route path="/app/bridge" element={<BridgePage />} /> {/* ES-111 — El Puente */}
        <Route path="/app/diary" element={<JournalPage />} />
        <Route path="/app/diary/new" element={<JournalPage />} />
        <Route path="/app/diary/:id" element={<JournalPage />} />
        <Route path="/app/space/tools" element={<SpaceToolsPage />} />
        <Route path="/app/onboarding"   element={<Onboarding />} />
        <Route path="/app/checkin"      element={<CheckinPage />} />
        <Route path="/app/chat"         element={<SpaceSession><ChatPage /></SpaceSession>} />
        <Route path="/app/progress"     element={<UserProgress />} />
        <Route path="/app/dashboard"    element={<SpaceSession><UserDashboard /></SpaceSession>} />
        <Route path="/app/evidence" element={<EvidenceListPage />} />
        <Route path="/app/evidence/new" element={<EvidenceCreatePage />} />
        <Route path="/app/evidence/:id" element={<EvidenceDetailPage />} />
        <Route path="/app/skill-map"    element={<SkillMapPage />} />
        <Route path="/app/my-therapist" element={<MyTherapist />} />
        {/* HU-067 — sala de videollamada para el paciente */}
        <Route path="/app/session/:id"  element={<UserSessionRoom />} />
      </Route>

      <Route path="/admin/pilot-metrics" element={<AdminRoute><AdminLayout pilotPreview /></AdminRoute>}>
        <Route index element={<PilotMetricsPage />} />
      </Route>
      {/* Admin backoffice */}
      <Route path="/admin/route-catalog" element={<AdminRoute><CatalogManager /></AdminRoute>} />
      <Route path="/admin/route-catalog/:id" element={<AdminRoute><CatalogManager /></AdminRoute>} />
      <Route path="/admin/route-catalog/:id/:kind/:itemKey" element={<AdminRoute><CatalogManager /></AdminRoute>} />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="prompts"   element={<AdminPrompts />} />
        <Route path="content"   element={<AdminContent />} />
        <Route path="users"     element={<AdminUsers />} />
        <Route path="metrics"   element={<AdminMetrics />} />
        <Route path="manifest"  element={<BoardManifest />} />
      </Route>

      {/* Therapist */}
      <Route element={<TherapistRoute />}>
        <Route element={<TherapistLayout />}>
          <Route path="/therapist/dashboard"   element={<TherapistDashboard />} />
          <Route path="/therapist/patient/:id" element={<TherapistPatient />} />
        </Route>
        {/* HU-067 — sala de videollamada (fuera del layout, pantalla completa) */}
        <Route path="/therapist/session/:id" element={<SessionRoom />} />
      </Route>

      {/* Ethics Board */}
      <Route path="/board" element={
        <BoardRoute>
          <BoardLayout />
        </BoardRoute>
      }>
        <Route index element={<Navigate to="/board/manifest" replace />} />
        <Route path="manifest" element={<BoardManifest />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes></RegisteredRoutes>
  )
}

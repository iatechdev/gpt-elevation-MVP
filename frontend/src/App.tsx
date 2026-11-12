// frontend/src/App.tsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useLanguage } from './i18n/useLanguage'
import { LandingPage } from './pages/LandingPage.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AdminRoute } from './components/AdminRoute.tsx'
import { TherapistRoute } from './components/TherapistRoute.tsx'

import { RouteErrorBoundary } from './components/RouteErrorBoundary.tsx'
import { RegisteredRoutes } from './space/RegisteredRoutes'
import { SpaceSession } from './space/SpaceSession'
// ES-129: cada pantalla fuera de la portada y el login se descarga al entrar en su ruta; así /login no arrastra admin, terapeuta, junta ni mapas.
const ProfessionalApplicationPage = lazy(() => import('./professional/ProfessionalApplicationPage.tsx').then(m => ({ default: m.ProfessionalApplicationPage })))
const LoginPage = lazy(() => import('./pages/LoginPage.tsx').then(m => ({ default: m.LoginPage }))) // ES-155: entrar usa el marco de Cartografía; ya no va en el arranque (se precarga en reposo desde la portada y al pasar el cursor por «Entrar»)
const ForgotPasswordPage = lazy(() => import('./access/PasswordResetPages.tsx').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./access/PasswordResetPages.tsx').then(m => ({ default: m.ResetPasswordPage })))
const CheckinPage = lazy(() => import('./pages/CheckinPage.tsx').then(m => ({ default: m.CheckinPage })))
const ChatPage = lazy(() => import('./pages/ChatPage.tsx').then(m => ({ default: m.ChatPage })))
const PricingPage = lazy(() => import('./pages/PricingPage.tsx').then(m => ({ default: m.PricingPage })))
const DesignSystemPage = lazy(() => import('./cartografia/DesignSystemPage.tsx').then(m => ({ default: m.DesignSystemPage }))) // ES-152 — página interna de componentes
const AdminLayout = lazy(() => import('./layouts/AdminLayout.tsx').then(m => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.tsx').then(m => ({ default: m.AdminDashboard })))
const AdminPrompts = lazy(() => import('./pages/admin/AdminPrompts.tsx').then(m => ({ default: m.AdminPrompts })))
const AdminContent = lazy(() => import('./pages/admin/AdminContent.tsx').then(m => ({ default: m.AdminContent })))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.tsx').then(m => ({ default: m.AdminUsers })))
const AdminMetrics = lazy(() => import('./pages/admin/AdminMetrics.tsx').then(m => ({ default: m.AdminMetrics })))
const TherapistLayout = lazy(() => import('./layouts/TherapistLayout.tsx').then(m => ({ default: m.TherapistLayout })))
const TherapistDashboard = lazy(() => import('./pages/therapist/TherapistDashboard.tsx').then(m => ({ default: m.TherapistDashboard })))
const TherapistPatient = lazy(() => import('./pages/therapist/TherapistPatient.tsx').then(m => ({ default: m.TherapistPatient })))
const SessionRoom = lazy(() => import('./pages/therapist/SessionRoom.tsx').then(m => ({ default: m.SessionRoom })))
const UserSessionRoom = lazy(() => import('./pages/user/SessionRoom.tsx').then(m => ({ default: m.UserSessionRoom })))
const UserProgress = lazy(() => import('./pages/UserProgress.tsx').then(m => ({ default: m.UserProgress })))
const UserDashboard = lazy(() => import('./pages/UserDashboard.tsx').then(m => ({ default: m.UserDashboard })))
const MyTherapist = lazy(() => import('./pages/MyTherapist.tsx').then(m => ({ default: m.MyTherapist })))
const Onboarding = lazy(() => import('./pages/Onboarding.tsx').then(m => ({ default: m.Onboarding })))
const ResumesPage = lazy(() => import('./context/resume/ResumesPage').then(m => ({ default: m.ResumesPage })))
const ResumeSkillsPage = lazy(() => import('./evidence/ResumeSkillsPage').then(m => ({ default: m.ResumeSkillsPage })))
const EvidenceListPage = lazy(() => import('./pages/EvidencePages.tsx').then(m => ({ default: m.EvidenceListPage })))
const EvidenceDetailPage = lazy(() => import('./pages/EvidencePages.tsx').then(m => ({ default: m.EvidenceDetailPage })))
const EvidenceCreatePage = lazy(() => import('./pages/EvidencePages.tsx').then(m => ({ default: m.EvidenceCreatePage })))
const EvidenceEditPage = lazy(() => import('./pages/EvidencePages.tsx').then(m => ({ default: m.EvidenceEditPage })))
const SkillMapPage = lazy(() => import('./pages/SkillMapPage.tsx').then(m => ({ default: m.SkillMapPage })))
const ManifestoPage = lazy(() => import('./pages/ManifestoPage.tsx').then(m => ({ default: m.ManifestoPage }))) // ES-207 — manifiesto ético público
const BoardManifest = lazy(() => import('./pages/board/BoardManifest.tsx').then(m => ({ default: m.BoardManifest })))
const FacilitationPreview = lazy(() => import('./facilitation/FacilitationPreview').then(m => ({ default: m.FacilitationPreview })))
const Participants = lazy(() => import('./facilitation/Pages').then(m => ({ default: m.Participants })))
const ParticipantDetail = lazy(() => import('./facilitation/Pages').then(m => ({ default: m.ParticipantDetail })))
const NewReview = lazy(() => import('./facilitation/Pages').then(m => ({ default: m.NewReview })))
const OwnReviews = lazy(() => import('./facilitation/Pages').then(m => ({ default: m.OwnReviews })))
const CatalogBrowser = lazy(() => import('./routeCatalog/PersonCatalog.tsx').then(m => ({ default: m.CatalogBrowser })))
const CatalogManager = lazy(() => import('./routeCatalog/CatalogPages').then(m => ({ default: m.CatalogManager })))
const CompassPage = lazy(() => import('./compass/CompassPage').then(m => ({ default: m.CompassPage })))
const CareerShell = lazy(() => import('./career/CareerShell').then(m => ({ default: m.CareerShell })))
const SkillCatalogManager = lazy(() => import('./skill-catalog/SkillCatalogPages').then(m => ({ default: m.SkillCatalogManager })))
const RoutesScreen = lazy(() => import('./career/CareerPages').then(m => ({ default: m.RoutesScreen })))
const ExperimentList = lazy(() => import('./career/CareerPages').then(m => ({ default: m.ExperimentList })))
const ExperimentScreen = lazy(() => import('./career/CareerPages').then(m => ({ default: m.ExperimentScreen })))
const PlanScreen = lazy(() => import('./career/CareerPages').then(m => ({ default: m.PlanScreen })))
const ExercisePage = lazy(() => import('./exercises/ExercisePage').then(m => ({ default: m.ExercisePage })))
const FeedbackPage = lazy(() => import('./pilot/FeedbackPage').then(m => ({ default: m.FeedbackPage })))
const PilotMetricsPage = lazy(() => import('./pilot/PilotMetricsPage').then(m => ({ default: m.PilotMetricsPage })))
const JournalPage = lazy(() => import('./space/JournalPage').then(m => ({ default: m.JournalPage })))
const BridgePage = lazy(() => import('./bridge/BridgePage').then(m => ({ default: m.BridgePage })))
const DataPage = lazy(() => import('./space/DataPage').then(m => ({ default: m.DataPage })))
const PlanPage = lazy(() => import('./space/PlanPage').then(m => ({ default: m.PlanPage })))
const SpaceToolsPage = lazy(() => import('./space/SpaceToolsPage').then(m => ({ default: m.SpaceToolsPage })))

// Mientras baja el bloque de la ruta se muestra el texto «Cargando...» que ya existe en ES y EN.
function RouteFallback() {
  const { t } = useLanguage()
  return <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center text-sm opacity-70">{t('loading')}</div>
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <RegisteredRoutes><RouteErrorBoundary resetKey={pathname}><Suspense fallback={<RouteFallback />}><Routes>

      {/* Public */}
      <Route path="/"        element={<LandingPage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} /> {/* ES-132 */}
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/profesionales" element={<ProfessionalApplicationPage />} /> {/* ES-95 — solicitud pública de profesionales */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/manifiesto" element={<ManifestoPage />} /> {/* ES-207 — lectura pública del manifiesto ético */}
      <Route path="/design-system" element={<DesignSystemPage />} /> {/* ES-152 — sin datos ni navegación; solo documenta el sistema */}

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
        <Route path="/app/data" element={<DataPage />} /> {/* ES-135 — Mis datos: exportar y eliminar la cuenta */}
        <Route path="/app/plan" element={<PlanPage />} /> {/* ES-174 — Mi plan */}
        <Route path="/app/onboarding"   element={<Onboarding />} />
        <Route path="/app/context/resumes" element={<ResumesPage />} /> {/* ES-109 — mis hojas de vida */}
        <Route path="/app/checkin"      element={<CheckinPage />} />
        <Route path="/app/chat"         element={<SpaceSession><ChatPage /></SpaceSession>} />
        <Route path="/app/progress"     element={<UserProgress />} />
        <Route path="/app/dashboard"    element={<SpaceSession><UserDashboard /></SpaceSession>} />
        <Route path="/app/evidence" element={<EvidenceListPage />} />
        <Route path="/app/evidence/new" element={<EvidenceCreatePage />} />
        <Route path="/app/evidence/resume-skills" element={<ResumeSkillsPage />} /> {/* ES-110 — habilidades de la hoja de vida */}
        <Route path="/app/evidence/:id" element={<EvidenceDetailPage />} />
        <Route path="/app/evidence/:id/edit" element={<EvidenceEditPage />} />
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
      <Route path="/admin/skill-catalog" element={<AdminRoute><SkillCatalogManager /></AdminRoute>} />
      <Route path="/admin/skill-catalog/:id" element={<AdminRoute><SkillCatalogManager /></AdminRoute>} />
      <Route path="/admin/skill-catalog/:id/skills/:skillKey" element={<AdminRoute><SkillCatalogManager /></AdminRoute>} />
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

      {/* Ethics Board — ES-207: la junta ya no edita el manifiesto; sus rutas antiguas llevan a la página pública */}
      <Route path="/board/*" element={<Navigate to="/manifiesto" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes></Suspense></RouteErrorBoundary></RegisteredRoutes>
  )
}

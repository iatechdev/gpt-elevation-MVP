// ES-153: compuerta por rol. Anónimo → /login; verificando → estado; sin conexión → reintento; rol sin permiso → pantalla «sin acceso».
// Las compuertas antiguas (ProtectedRoute, AdminRoute, TherapistRoute, BoardRoute) delegan aquí; el servidor decide además en cada API.
// Las pantallas de la compuerta (y su CSS) se cargan bajo demanda para no engordar la carga inicial.
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { gateDecision, type Zone } from './access'
import { useVerifiedSession } from './useVerifiedSession'

const GateStatus = lazy(() => import('./GateScreens').then(m => ({ default: m.GateStatus })))
const NoAccess = lazy(() => import('./GateScreens').then(m => ({ default: m.NoAccess })))

export function RoleGate({ zone, children }: { zone?: Zone; children?: ReactNode }) {
  const { pathname } = useLocation()
  const { state, retry } = useVerifiedSession()
  const decision = gateDecision(state.status === 'verified' ? { status: 'verified', role: state.session.role } : state, pathname, zone)
  if (decision === 'login') return <Navigate to="/login" replace />
  if (decision === 'checking') return <Suspense fallback={null}><GateStatus kind="checking" /></Suspense>
  if (decision === 'unavailable') return <Suspense fallback={null}><GateStatus kind="unavailable" onRetry={retry} /></Suspense>
  if (decision === 'noAccess' && state.status === 'verified') return <Suspense fallback={null}><NoAccess session={state.session} /></Suspense>
  return <>{children ?? <Outlet />}</>
}

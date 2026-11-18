// ES-153: compuerta por rol. Anónimo → /login; verificando → estado; sin conexión → reintento; rol sin permiso → pantalla «sin acceso».
// Las compuertas antiguas (ProtectedRoute, AdminRoute, TherapistRoute, BoardRoute) delegan aquí; el servidor decide además en cada API.
// Las pantallas de la compuerta (y su CSS) se cargan bajo demanda para no engordar la carga inicial.
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { gateDecision, withFarewell, type Zone } from './access'
import { useVerifiedSession } from './useVerifiedSession'
import { forgetReturn, rememberReturn } from '../access/returnTo'
import { isFarewell } from '../access/farewell'

const GateStatus = lazy(() => import('./GateScreens').then(m => ({ default: m.GateStatus })))
const NoAccess = lazy(() => import('./GateScreens').then(m => ({ default: m.NoAccess })))

export function RoleGate({ zone, children }: { zone?: Zone; children?: ReactNode }) {
  const { pathname, search } = useLocation()
  const { state, retry } = useVerifiedSession()
  const gated = gateDecision(state.status === 'verified' ? { status: 'verified', role: state.session.role } : state, pathname, zone)
  // ES-346: tras pedir la eliminación de la cuenta la sesión local ya se cerró; «Mis datos» muestra solo su aviso de resultado (marca en memoria, solo en esa ruta).
  const decision = withFarewell(gated, isFarewell(pathname))
  // ES-330: a /login se va recordando la ruta pedida (solo ruta relativa interna validada); LoginPage la usa tras entrar.
  useEffect(() => { if (decision === 'login') rememberReturn(pathname, search) }, [decision, pathname, search])
  // Llegar a una pantalla permitida consume lo recordado (la ruta ya se usó o no corresponde): no queda nada para otra sesión.
  useEffect(() => { if (decision === 'allow') forgetReturn() }, [decision])
  if (decision === 'login') return <Navigate to="/login" replace />
  if (decision === 'checking') return <Suspense fallback={null}><GateStatus kind="checking" /></Suspense>
  if (decision === 'unavailable') return <Suspense fallback={null}><GateStatus kind="unavailable" onRetry={retry} /></Suspense>
  if (decision === 'noAccess' && state.status === 'verified') return <Suspense fallback={null}><NoAccess session={state.session} /></Suspense>
  return <>{children ?? <Outlet />}</>
}

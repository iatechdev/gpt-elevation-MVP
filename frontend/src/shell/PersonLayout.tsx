// ES-153 (paso 1): layout de ruta de la persona. El marco (encabezado, menú de usuario, «Saltar al contenido», <main> con foco y pie) NO se desmonta
// al cambiar de pantalla: el Suspense y el límite de error van dentro del <main>. La sala de sesión (/app/session/:id) queda fuera de este layout.
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/RouteErrorBoundary'
import { MemberChrome, PersonChrome } from './frames'
import { isMigratedPersonPath, isRoleFramePath, PersonLayoutContext, personFooterHidden } from './personLayoutState'
import { useShellCopy } from './useShellCopy'

function ScreenLoading() {
  const { c } = useShellCopy()
  return <div className="cg-screen-loading" role="status" aria-live="polite"><span>{c.loadingScreen}</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>
}

export function PersonLayout() {
  const { pathname } = useLocation(); const Chrome = isRoleFramePath(pathname) ? MemberChrome : PersonChrome // ES-359 (PR5): Mis datos y Revisiones, en el marco del rol
  return (
    <PersonLayoutContext.Provider value>
      <Chrome migrated={isMigratedPersonPath(pathname)} footer={!personFooterHidden(pathname)}>
        <RouteErrorBoundary resetKey={pathname}><Suspense fallback={<ScreenLoading />}><Outlet /></Suspense></RouteErrorBoundary>
      </Chrome>
    </PersonLayoutContext.Provider>
  )
}

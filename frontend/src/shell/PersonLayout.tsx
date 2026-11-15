// ES-153 (paso 1): layout de ruta de la persona. El marco (encabezado, menú de usuario, «Saltar al contenido», <main> con foco y pie) NO se desmonta
// al cambiar de pantalla: el Suspense y el límite de error van dentro del <main>. La sala de sesión (/app/session/:id) queda fuera de este layout.
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/RouteErrorBoundary'
import { PersonChrome } from './frames'
import { isMigratedPersonPath, PersonLayoutContext, personFooterHidden } from './personLayoutState'
import { useShellCopy } from './useShellCopy'

function ScreenLoading() {
  const { c } = useShellCopy()
  return <div className="cg-screen-loading" role="status" aria-live="polite"><span>{c.loadingScreen}</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>
}

export function PersonLayout() {
  const { pathname } = useLocation()
  return (
    <PersonLayoutContext.Provider value>
      <PersonChrome migrated={isMigratedPersonPath(pathname)} footer={!personFooterHidden(pathname)}>
        <RouteErrorBoundary resetKey={pathname}><Suspense fallback={<ScreenLoading />}><Outlet /></Suspense></RouteErrorBoundary>
      </PersonChrome>
    </PersonLayoutContext.Provider>
  )
}

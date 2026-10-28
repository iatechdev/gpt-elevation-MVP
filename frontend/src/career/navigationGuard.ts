// Registrar antes de BrowserRouter. Fuera del recorrido no hay manejador ni efecto en la navegación.
let active: ((event: PopStateEvent) => void) | null = null
window.addEventListener('popstate', event => active?.(event), true)
export function registerCareerGuard(handler: (event: PopStateEvent) => void) {
  active = handler
  return () => { if (active === handler) active = null }
}

// ES-197 (PERF-03): precarga de los bloques de las rutas probables siguientes. No cambia nada visible.
//   - Al pasar el cursor o enfocar un enlace interno (menú o tarjetas) (tras 80 ms, para no descargar al cruzar el cursor de paso).
//   - En reposo del navegador, 3 s después de la carga, solo las rutas más usadas del área actual (persona, profesional, administración).
// Respeta `saveData` y las conexiones 2g (no precarga), baja UN bloque a la vez y nunca lanza: un fallo de red se ignora (la navegación real lo intentará y,
// si falla, lo atrapa el límite de error de ES-129). Los especificadores son los mismos de los `lazy()` de App.tsx (lo comprueba una prueba).
type Loader = () => Promise<unknown>
export type Connection = { saveData?: boolean; effectiveType?: string } | undefined

export const ROUTE_LOADERS: Record<string, Loader[]> = {
  '/app/skill-map': [() => import('./pages/SkillMapPage.tsx')],
  '/app/chat': [() => import('./pages/ChatPage.tsx')],
  '/app/evidence': [() => import('./pages/EvidencePages.tsx')],
  '/app/diary': [() => import('./space/JournalPage')],
  '/app/next-step': [() => import('./career/CareerShell'), () => import('./career/CareerPages')],
  '/app/checkin': [() => import('./pages/CheckinPage.tsx')],
  '/app/bridge': [() => import('./bridge/BridgePage')],
  '/app/my-therapist': [() => import('./pages/MyTherapist.tsx')],
  '/app/space/tools': [() => import('./space/SpaceToolsPage')],
  '/app/progress': [() => import('./pages/UserProgress.tsx')],
  '/app/plan': [() => import('./space/PlanPage')],
  '/app/data': [() => import('./space/DataPage')],
  '/app/dashboard': [() => import('./pages/UserDashboard.tsx')],
  '/therapist/dashboard': [() => import('./layouts/TherapistLayout.tsx'), () => import('./pages/therapist/TherapistDashboard.tsx')],
  '/admin/users': [() => import('./layouts/AdminLayout.tsx'), () => import('./pages/admin/AdminUsers.tsx')],
  '/admin/prompts': [() => import('./layouts/AdminLayout.tsx'), () => import('./pages/admin/AdminPrompts.tsx')],
  '/admin/content': [() => import('./layouts/AdminLayout.tsx'), () => import('./pages/admin/AdminContent.tsx')],
  '/admin/metrics': [() => import('./layouts/AdminLayout.tsx'), () => import('./pages/admin/AdminMetrics.tsx')],
}

// Rutas que se precargan en reposo, según el área en la que está la persona.
export const IDLE_ROUTES: Record<string, string[]> = {
  '/app': ['/app/skill-map', '/app/chat', '/app/evidence'],
  '/therapist': ['/therapist/dashboard'],
  '/admin': ['/admin/users', '/admin/prompts'],
}

export const IDLE_DELAY_MS = 3000
export const HOVER_DELAY_MS = 80

/** ¿Se permite precargar con esta conexión? No con ahorro de datos ni con 2g. */
export function prefetchAllowed(connection: Connection): boolean {
  if (!connection) return true
  if (connection.saveData) return false
  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g'
}

/** Clave de ROUTE_LOADERS para una ruta: coincidencia exacta o por el segmento padre más largo (p. ej. /app/evidence/new → /app/evidence). */
export function routeKey(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  let best: string | null = null
  for (const key of Object.keys(ROUTE_LOADERS)) if ((clean === key || clean.startsWith(key + '/')) && (!best || key.length > best.length)) best = key
  return best
}

export function idleRoutesFor(pathname: string): string[] {
  const area = Object.keys(IDLE_ROUTES).find(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
  return area ? IDLE_ROUTES[area] : []
}

/** Cola que baja un bloque a la vez, una sola vez por ruta, ignorando errores. */
export function createPrefetcher(options: { loaders?: Record<string, Loader[]>; connection?: () => Connection } = {}) {
  const loaders = options.loaders ?? ROUTE_LOADERS
  const connection = options.connection ?? (() => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: Connection }).connection))
  const done = new Set<string>()
  const queue: string[] = []
  let running = false
  async function drain() {
    if (running) return
    running = true
    try {
      while (queue.length) {
        if (!prefetchAllowed(connection())) { queue.length = 0; break }
        const key = queue.shift() as string
        for (const load of loaders[key] ?? []) { try { await load() } catch { /* sin red o bloque ausente: lo resuelve la navegación real */ } }
      }
    } finally { running = false }
  }
  return {
    request(pathname: string): boolean {
      const key = options.loaders ? (pathname in loaders ? pathname : null) : routeKey(pathname)
      if (!key || done.has(key) || queue.includes(key) || !prefetchAllowed(connection())) return false
      done.add(key); queue.push(key); void drain()
      return true
    },
    get completed() { return [...done] },
  }
}

/** Engancha los eventos del documento. Devuelve una función que los quita. */
export function installRoutePrefetch(): () => void {
  if (typeof document === 'undefined') return () => undefined
  const prefetcher = createPrefetcher()
  let timer: number | undefined
  const target = (event: Event): string | null => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!anchor || anchor.origin !== window.location.origin) return null
    return anchor.pathname
  }
  const arm = (event: Event) => { const path = target(event); if (!path) return; window.clearTimeout(timer); timer = window.setTimeout(() => prefetcher.request(path), HOVER_DELAY_MS) }
  const disarm = () => window.clearTimeout(timer)
  document.addEventListener('pointerover', arm); document.addEventListener('focusin', arm)
  document.addEventListener('pointerout', disarm); document.addEventListener('focusout', disarm)
  const idle = () => { for (const path of idleRoutesFor(window.location.pathname)) prefetcher.request(path) }
  let idleTimer: number | undefined
  const schedule = () => { const run = () => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(idle, { timeout: 5000 }) : window.setTimeout(idle, 0)); idleTimer = window.setTimeout(run, IDLE_DELAY_MS) }
  if (document.readyState === 'complete') schedule(); else window.addEventListener('load', schedule, { once: true })
  return () => {
    document.removeEventListener('pointerover', arm); document.removeEventListener('focusin', arm)
    document.removeEventListener('pointerout', disarm); document.removeEventListener('focusout', disarm)
    window.clearTimeout(timer); window.clearTimeout(idleTimer); window.removeEventListener('load', schedule)
  }
}

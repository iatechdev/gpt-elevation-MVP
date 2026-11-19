// ES-310 (PR 1, marco de Administración): qué pantallas de /admin ya usan Cartografía. Una ruta migrada pide al marco el tema claro/oscuro del sistema y deja de usar el ámbito de tokens
// antiguos (`elv-theme`); las demás siguen como hoy (tema claro, sin cambios visuales). Cada PR de migración de una pantalla de Administración AGREGA su ruta aquí (Panel y Métricas, Guías, Catálogo de rutas,
// Personas usuarias). Cada PR de pantalla agrega la suya; sin esa línea la pantalla sigue en claro fijo.
export const MIGRATED_ADMIN_PATHS: readonly string[] = ['/admin/route-catalog', '/admin/users', '/admin/dashboard', '/admin/metrics', '/admin/prompts', '/admin/content', '/admin/skill-catalog']

/** `/admin/users` coincide con `/admin/users` y `/admin/users/…`, no con `/admin/users-old`. */
export function isMigratedAdminPath(pathname: string, list: readonly string[] = MIGRATED_ADMIN_PATHS): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return list.some((entry) => path === entry || path.startsWith(entry + '/'))
}

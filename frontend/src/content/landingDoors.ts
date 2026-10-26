// Lógica pura del héroe de la landing (ES-63): destino de las puertas y titular con última palabra subrayada.

type StorageLike = Pick<Storage, 'getItem'>

// Sin sesión: /login. Con sesión: el mismo destino por rol que usa LoginPage (la ruta /app no existe).
export function doorTarget(storage?: StorageLike | null): string {
  try {
    const store = storage ?? window.localStorage
    if (!store.getItem('elevation_token')) return '/login'
    const role = store.getItem('elevation_role') ?? 'user'
    if (role === 'admin' || role === 'superadmin') return '/admin/dashboard'
    if (role === 'therapist') return '/therapist/dashboard'
    if (role === 'board') return '/board/manifest'
    return store.getItem('elevation_onboarding') === 'done' ? '/app/dashboard' : '/app/onboarding'
  } catch {
    return '/login'
  }
}

// Separa la última palabra (para el subrayado ocre); el texto completo se conserva intacto.
export function splitLastWord(title: string): { head: string; last: string } {
  const match = /^(.*?)(\S+)(\s*)$/s.exec(title)
  if (!match) return { head: title, last: '' }
  return { head: match[1], last: match[2] + match[3] }
}

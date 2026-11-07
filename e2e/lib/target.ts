// ES-147 · Destino permitido de las pruebas: localhost o el staging. Nunca producción ni otro host.
export const DEFAULT_STAGING = 'https://backend-staging-e3a6.up.railway.app'

const STAGING_HOST = /^backend-staging-[a-z0-9-]+\.up\.railway\.app$/
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

export function resolveBaseUrl(raw: string | undefined = process.env.E2E_BASE_URL): string {
  const value = (raw && raw.trim()) || DEFAULT_STAGING
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`E2E_BASE_URL no es una URL válida.`) }
  const local = LOCAL_HOSTS.includes(url.hostname)
  const staging = url.protocol === 'https:' && STAGING_HOST.test(url.hostname)
  if (!local && !staging) {
    throw new Error(`E2E_BASE_URL (${url.hostname}) no está permitido: solo localhost o un staging https://backend-staging-*.up.railway.app.`)
  }
  return url.origin
}

// Cuentas de prueba: solo por variables de entorno. Nunca se imprimen ni se guardan en reportes.
export function credentialsFor(role: 'USER' | 'THERAPIST' | 'ADMIN' | 'SUPERADMIN') {
  const email = process.env[`E2E_${role}_EMAIL`]
  const password = process.env[`E2E_${role}_PASSWORD`]
  return email && password ? { email, password } : null
}

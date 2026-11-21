// ES-369 (QA-424-1/2): la marca «ya registré mi ánimo hoy» de este navegador. Antes era una fecha suelta (`elevation_checkin_date`, new Date().toDateString()): servía a cualquier
// persona que entrara en el mismo navegador sin cerrar sesión (sesión vencida) y usaba el día del navegador, no el de la persona.
// Ahora la marca lleva a su DUEÑA (el id que ya viaja en el token; no es secreto) y el DÍA en la zona de la persona (el mismo que usa el servidor, E393-3: todayKey(date, zone)).
// La zona la devuelve /api/user/progress; se recuerda por persona para que Hoy, el chat y Mi panel calculen el mismo día sin pedirla. Todo el acceso al almacenamiento tolera que esté bloqueado.
import { todayKey } from '../pages/dashboardWeek.ts'

export const CHECKIN_MARK_KEY = 'elevation_checkin'
export const PERSON_ZONE_KEY = 'elevation_tz'
/** Claves de versiones anteriores: ya no se leen; se borran al cerrar sesión. */
export const LEGACY_CHECKIN_KEY = 'elevation_checkin_date'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const defaultStore = (): Store | null => { try { return localStorage } catch { return null } }

/** Id de la persona que lleva el token (lectura del payload, sin verificar firma: solo sirve para rotular la marca; el servidor decide el acceso). */
export function personIdFromToken(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const payload: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')))
    const id = payload && typeof payload === 'object' ? (payload as { id?: unknown }).id : null
    return typeof id === 'number' && Number.isSafeInteger(id) ? String(id) : typeof id === 'string' && /^\d{1,15}$/.test(id) ? id : null
  } catch { return null }
}

const readJson = (store: Store, key: string): Record<string, unknown> | null => {
  try { const value: unknown = JSON.parse(store.getItem(key) ?? 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null } catch { return null }
}

/** Zona recordada de ESTA persona (o null si aún no se conoce o es de otra persona). */
export function rememberedZone(token: string, store: Store | null = defaultStore()): string | null {
  const id = personIdFromToken(token)
  if (!store || !id) return null
  const saved = readJson(store, PERSON_ZONE_KEY)
  return saved && saved.id === id && typeof saved.zone === 'string' && saved.zone ? saved.zone : null
}

/** Recuerda la zona de la persona (la devuelve /api/user/progress). */
export function rememberZone(token: string, zone: string | null, store: Store | null = defaultStore()): void {
  const id = personIdFromToken(token)
  if (!store || !id || !zone) return
  try { store.setItem(PERSON_ZONE_KEY, JSON.stringify({ id, zone })) } catch { /* almacenamiento no disponible */ }
}

/** El día de hoy de ESTA persona: AAAA-MM-DD en su zona (UTC mientras no se conozca). */
export const personToday = (token: string, now: Date = new Date(), store: Store | null = defaultStore()): string => todayKey(now, rememberedZone(token, store))

/** ¿Esta persona ya registró su ánimo hoy en este navegador? Falso con otra persona, otro día, sin token o con el almacenamiento bloqueado. */
export function checkinDone(token: string, now: Date = new Date(), store: Store | null = defaultStore()): boolean {
  const id = personIdFromToken(token)
  if (!store || !id) return false
  const mark = readJson(store, CHECKIN_MARK_KEY)
  return !!mark && mark.id === id && mark.day === personToday(token, now, store)
}

/** Marca el registro de hoy para esta persona. */
export function markCheckin(token: string, now: Date = new Date(), store: Store | null = defaultStore()): void {
  const id = personIdFromToken(token)
  if (!store || !id) return
  try { store.setItem(CHECKIN_MARK_KEY, JSON.stringify({ id, day: personToday(token, now, store) })) } catch { /* almacenamiento no disponible */ }
}

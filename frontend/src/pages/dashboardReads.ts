// ES-332: estado de las lecturas de «Mi panel» (/app/dashboard). Lógica pura (sin React ni red) para poder probarla en `npm test`.
// Cada lectura es `loading | ok | error`; cada tarjeta se alimenta de una o más lecturas. Una tarjeta con una lectura caída muestra su aviso y «Reintentar»,
// que repite SOLO las lecturas fallidas de esa tarjeta; mientras no hay respuesta nunca se pinta un dato (ni «0» ni «—»).
export type Read = 'progress' | 'upcoming' | 'therapist' | 'recommendations' | 'plan'
export type ReadState = 'loading' | 'ok' | 'error'
export type Card = 'progress' | 'session' | 'plan' | 'recs'

export const READS: Read[] = ['progress', 'upcoming', 'therapist', 'recommendations', 'plan']
export const CARD_READS: Record<Card, Read[]> = { progress: ['progress'], session: ['upcoming', 'therapist'], plan: ['plan'], recs: ['recommendations'] }
export const CARD_HEADING: Record<Card, string> = { progress: 'dash-progress', session: 'dash-session', plan: 'dash-plan', recs: 'dash-recs' }
export const INITIAL_READS: Record<Read, ReadState> = { progress: 'loading', upcoming: 'loading', therapist: 'loading', recommendations: 'loading', plan: 'loading' }

/** Lecturas que alimentan lo que se ve de la tarjeta: «Próxima sesión» usa la del profesional solo si no hay sesión próxima. */
export const visibleReads = (card: Card, hasUpcoming: boolean): Read[] => (card === 'session' && hasUpcoming ? ['upcoming'] : CARD_READS[card])

/** Estado de la tarjeta: error si alguna lectura visible falló; cargando si alguna sigue sin respuesta; datos si todas respondieron. */
export function cardStateOf(readState: Record<Read, ReadState>, hasUpcoming: boolean, card: Card): ReadState {
  const states = visibleReads(card, hasUpcoming).map((read) => readState[read])
  return states.includes('error') ? 'error' : states.includes('loading') ? 'loading' : 'ok'
}

/** Lecturas que «Reintentar» debe repetir en esa tarjeta: solo las que fallaron (las que ya respondieron no se piden otra vez). */
export const failedReads = (readState: Record<Read, ReadState>, card: Card): Read[] => CARD_READS[card].filter((read) => readState[read] === 'error')

// ES-111 (D4): origen de los insights de la pantalla. Hoy ninguna parte del sistema genera insights a partir del diario (falta decidir quién y con qué consentimiento),
// así que sin el interruptor la lista está vacía y la pantalla lo dice. Con el interruptor se muestran datos de EJEMPLO, marcados como tales y sin origen real.
import type { Insight } from './logic'

const EXAMPLES: { es: Insight; en: Insight }[] = [
  {
    es: { id: 'ejemplo-1', date: '2024-11-15', status: 'hypothesis', key: 'energy_gives', example: true, fragment: 'Hoy en la reunión sostuve la presión del cliente sin perder el hilo. Me sorprendió no entrar en pánico.', text: 'Liderazgo en situaciones de alta presión' },
    en: { id: 'ejemplo-1', date: '2024-11-15', status: 'hypothesis', key: 'energy_gives', example: true, fragment: 'Today in the meeting I held the client’s pressure without losing the thread. I was surprised I did not panic.', text: 'Leadership under high pressure' },
  },
  {
    es: { id: 'ejemplo-2', date: '2024-11-03', status: 'hypothesis', key: 'values', example: true, fragment: 'Reorganicé el tablero del equipo y por fin sentí que el trabajo era mío.', text: 'Pensamiento sistémico y apropiación del trabajo' },
    en: { id: 'ejemplo-2', date: '2024-11-03', status: 'hypothesis', key: 'values', example: true, fragment: 'I reorganised the team board and finally felt the work was mine.', text: 'Systems thinking and ownership of the work' },
  },
  {
    es: { id: 'ejemplo-3', date: '2024-10-28', status: 'unassessed', key: 'interests', example: true, fragment: 'El cliente cambió los requisitos por tercera vez. Armé un mapa de decisiones para el equipo.', text: 'Claridad al estructurar decisiones con incertidumbre' },
    en: { id: 'ejemplo-3', date: '2024-10-28', status: 'unassessed', key: 'interests', example: true, fragment: 'The client changed the requirements for the third time. I built a decision map for the team.', text: 'Clarity when structuring decisions under uncertainty' },
  },
]

export const fixturesEnabled = (env: Record<string, unknown> | undefined) => env?.VITE_BRIDGE_INSIGHTS_FIXTURES === 'true'
export function loadInsights(lang: 'es' | 'en', env: Record<string, unknown> | undefined = import.meta.env): Insight[] {
  return fixturesEnabled(env) ? EXAMPLES.map(pair => pair[lang]) : []
}

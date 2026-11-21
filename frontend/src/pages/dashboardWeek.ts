// «Mi panel»: fechas de la semana y de la tendencia de ánimo. Lógica pura (sin React ni red) y con prueba.
// Los registros de ánimo traen `date` como texto AAAA-MM-DD (columna DATEONLY): el día EN LA ZONA de la persona (E393-3; antes el UTC del servidor). Antes la pantalla mezclaba
// el día UTC (tendencia) con la hora local (semana): un registro del lunes se descartaba en UTC−5 (se parseaba como 00:00 UTC, antes del lunes local),
// los domingos la semana empezaba «mañana» y se contaba 0, y pasadas las 19:00 la tendencia desplazaba un día (etiqueta local, datos del día UTC).
// Ahora TODO se calcula con el mismo día (el de los registros, en UTC) y se comparan textos AAAA-MM-DD, sin horas locales.
const DAY_MS = 86_400_000

/** Día de hoy como AAAA-MM-DD en la ZONA de la persona (E393-3): la misma con que el servidor guarda `date` (la de su contexto o America/Bogota; la devuelve /api/user/progress).
 *  Sin zona (servidor anterior) o con una zona que el navegador no conoce, el día UTC, como antes. */
export const todayKey = (now: Date, timeZone?: string | null): string => {
  if (timeZone) { try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) } catch { /* zona desconocida: UTC */ } }
  return now.toISOString().slice(0, 10)
}

const dayFrom = (key: string): number => Date.parse(`${key}T00:00:00Z`)
const keyFrom = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/** Lunes de la semana de `today` (AAAA-MM-DD). El domingo pertenece a la semana que empezó seis días antes. */
export function weekStartKey(today: string): string {
  const weekday = new Date(dayFrom(today)).getUTCDay() // 0 = domingo
  return keyFrom(dayFrom(today) - ((weekday + 6) % 7) * DAY_MS)
}

type Dated = { date: string }

/** Registros de la semana en curso (de su lunes en adelante). */
export const entriesThisWeek = (logs: Dated[], today: string): number => {
  const monday = weekStartKey(today)
  return logs.filter((log) => String(log.date).slice(0, 10) >= monday).length
}

/** Los 7 últimos días terminando en `today` (AAAA-MM-DD y su fecha, para rotular con el día de la semana en UTC). */
export const lastSevenDays = (today: string): { dateStr: string; date: Date }[] =>
  Array.from({ length: 7 }, (_, index) => {
    const ms = dayFrom(today) - (6 - index) * DAY_MS
    return { dateStr: keyFrom(ms), date: new Date(ms) }
  })

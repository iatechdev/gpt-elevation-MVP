// ES-173 (HU-P22): utilidades puras de «Tu progreso» (sin React, para poder probarlas). Escala 1–5, «N de 5», tendencia en palabra.
export type Trend = 'up' | 'same' | 'down'

/** Lleva cualquier valor numérico a un nivel entero 1–5. */
export const level = (value: number): number => Math.min(5, Math.max(1, Math.round(value)))

/** Sustituye `{clave}` por su valor; `$` en el valor se conserva tal cual (String.replace con función). */
export const fill = (text: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text)

/** Compara entrada y salida de UNA sesión: sube, baja o igual. No es una medición de salud. */
export const trendOf = (checkin: number, checkout: number): Trend => {
  const before = level(checkin); const after = level(checkout)
  return after > before ? 'up' : after < before ? 'down' : 'same'
}

/** Símbolo que acompaña a la palabra (nunca la sustituye). */
export const TREND_SYMBOL: Record<Trend, string> = { up: '↑', same: '=', down: '↓' }

/** Fecha corta de un día. Las fechas de solo día («AAAA-MM-DD», sin hora) se interpretan como UTC: formatearlas en la zona local las mostraba un día antes en Colombia (E272-2). Con hora, rige la zona de la persona. */
export function formatDay(value: string, locale: string): string {
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', ...(dayOnly ? { timeZone: 'UTC' } : {}) })
}

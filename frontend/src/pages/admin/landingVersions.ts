// ES-279 (pantalla): lógica pura del aviso de conflicto de edición simultánea en «Textos públicos». Contrato del servidor (PR #250):
//   GET /api/landing-content/versions?lang=  → [{ key, lang, value, updatedAt, updatedBy }]   (solo superadministración)
//   PUT /api/landing-content { key, lang, value, expectedUpdatedAt }  → 200 { updatedAt } · 409 { code: 'version_conflict', current: { value, updatedAt, updatedBy } | null } · 400 · 403
export interface LandingVersion { value: string; updatedAt: string; updatedBy: string | null }
export type SaveOutcome =
  | { kind: 'saved'; updatedAt: string | null }
  | { kind: 'conflict'; current: LandingVersion | null }
  | { kind: 'forbidden' }
  | { kind: 'error' }

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** key → versión (updatedAt) de cada texto guardado. Lo que no tenga forma válida se ignora; si no es una lista, devuelve null (la pantalla lo trata como error de carga). */
export function readVersions(data: unknown): Record<string, string> | null {
  if (!Array.isArray(data)) return null
  const out: Record<string, string> = {}
  for (const row of data) if (isRecord(row) && typeof row.key === 'string' && typeof row.updatedAt === 'string' && row.updatedAt) out[row.key] = row.updatedAt
  return out
}

function readCurrent(value: unknown): LandingVersion | null {
  if (!isRecord(value) || typeof value.value !== 'string' || typeof value.updatedAt !== 'string' || !value.updatedAt) return null
  return { value: value.value, updatedAt: value.updatedAt, updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : null }
}

/** Qué pasó con un guardado. Un 409 sin `current` utilizable se trata como «el texto ya no existe» (current = null). */
export function readSaveOutcome(status: number, body: unknown): SaveOutcome {
  if (status === 200) return { kind: 'saved', updatedAt: isRecord(body) && typeof body.updatedAt === 'string' ? body.updatedAt : null }
  if (status === 409 && isRecord(body) && body.code === 'version_conflict') return { kind: 'conflict', current: readCurrent(body.current) }
  if (status === 403) return { kind: 'forbidden' }
  return { kind: 'error' }
}

/** Id del aviso de conflicto de un texto (lo enlaza aria-describedby del campo). */
export const conflictId = (fieldKey: string): string => `landing-conflict-${fieldKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`

/** Versión que se envía como `expectedUpdatedAt`: la leída para ese texto, o null si el texto aún no tenía registro. */
export const expectedFor = (versions: Record<string, string>, key: string): string | null => (Object.prototype.hasOwnProperty.call(versions, key) ? versions[key] : null)

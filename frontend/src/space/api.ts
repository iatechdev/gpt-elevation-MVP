export type Entry = { id: number; date: string; content: string; createdAt: string; updatedAt: string }
export type ChatMessage = { role: 'user' | 'bot'; text: string }
export type Intent = Readonly<{ message: string; lang: string; requestId: string; contextEntryIds?: readonly number[] }>
export class SpaceError extends Error {
  status: number
  code: string
  retryable: boolean
  constructor(status: number, code = '', retryable = false) {
    super('Space request failed'); this.status = status; this.code = code; this.retryable = retryable
  }
}
const backend = import.meta.env?.VITE_BACKEND_URL || ''
export function validDate(date: string, now = Date.now()) {
  const parsed = new Date(`${date}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && parsed.getTime() <= now + 36 * 3600000
}
export function validDraft(date: string, content: string) { return validDate(date) && !!content.trim() && content.length <= 10000 }
export function entry(value: unknown): Entry {
  if (!value || typeof value !== 'object') throw new SpaceError(502)
  const e = value as Record<string, unknown>
  if (!Number.isSafeInteger(e.id) || Number(e.id) < 1 || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || typeof e.content !== 'string' || typeof e.createdAt !== 'string' || typeof e.updatedAt !== 'string' || !Number.isFinite(Date.parse(e.updatedAt))) throw new SpaceError(502)
  return { id: Number(e.id), date: e.date, content: e.content, createdAt: e.createdAt, updatedAt: e.updatedAt }
}
export function makeIntent(message: string, lang: string, ids: number[], requestId = crypto.randomUUID()): Intent {
  if (!message.trim() || message.trim().length > 4000 || ids.length > 3 || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 1) || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw new SpaceError(400)
  return Object.freeze({ message: message.trim(), lang, requestId, ...(ids.length ? { contextEntryIds: Object.freeze([...ids]) } : {}) })
}
export async function request(token: string, path: string, options?: RequestInit): Promise<unknown> {
  if (!token || localStorage.getItem('elevation_token') !== token) throw new SpaceError(401)
  const response = await fetch(`${backend}${path}`, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
  if (localStorage.getItem('elevation_token') !== token) throw new SpaceError(401)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new SpaceError(response.status, typeof data?.code === 'string' ? data.code : '', data?.retryable === true)
  return data
}
export async function listEntries(token: string) {
  const data = await request(token, '/api/diary?limit=100') as { entries?: unknown }
  if (!data || !Array.isArray(data.entries) || data.entries.length > 100) throw new SpaceError(502)
  return data.entries.map(entry)
}
export async function readEntry(token: string, id: number) { return entry(await request(token, `/api/diary/${id}`)) }
export async function history(token: string): Promise<ChatMessage[]> {
  const data = await request(token, '/api/messages')
  if (!Array.isArray(data) || data.some(m => !m || !['user', 'bot'].includes(m.role) || typeof m.text !== 'string')) throw new SpaceError(502)
  return data.map(m => ({ role: m.role, text: m.text }))
}

import { newRequestId } from './selfAssessApi'

/** Propuestas de la IA para el mapa (ES-28 en el servidor). La IA PROPONE; la persona decide y confirma. Nada se guarda al proponer. */
export const MAX_SKILLS = 8
export type AiFailure = 'expired' | 'budget' | 'unavailable' | 'provider' | 'invalid_output' | 'no_evidence' | 'proposal_expired' | 'changed' | 'invalid' | 'uncertain' | 'error'
export class AiProposalError extends Error {
  readonly reason: AiFailure
  constructor(reason: AiFailure) { super(reason); this.reason = reason }
}
export type Confidence = 'low' | 'medium' | 'high'
export type Ref = { evidenceId: number; version: number; quote?: string }
export type Proposal = { skillKey: string; level: number | null; evidenceRefs: Ref[]; rationale: string; confidence: Confidence | null; confidenceReason: { es?: string; en?: string } | null }
export type Warning = { skillKey: string; code: 'no_declared_autonomy' | 'level_capped' }
export type Proposed = { proposals: Proposal[]; warnings: Warning[]; token: string; expiresAt: string }
/** Qué hace la persona con cada propuesta: aceptarla, bajarla a un nivel menor, dejarla sin evaluar (retira su nivel vigente), o no guardarla. */
export type Choice = 'accept' | 'skip' | 'null' | '1' | '2' | '3'

export { newRequestId }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string'

/** Lo que el servidor puede devolver se valida: una respuesta con otra forma nunca se pinta como propuesta. */
export function parseProposed(value: unknown): Proposed {
  if (!object(value) || !Array.isArray(value.proposals) || !Array.isArray(value.warnings) || !text(value.token) || !text(value.expiresAt) || Number.isNaN(Date.parse(value.expiresAt))) throw new AiProposalError('error')
  const proposals = value.proposals.map((p): Proposal => {
    if (!object(p) || !text(p.skillKey) || !text(p.rationale) || !Array.isArray(p.evidenceRefs)
      || !(p.level === null || (typeof p.level === 'number' && Number.isInteger(p.level) && p.level >= 1 && p.level <= 4))
      || !(p.confidence === null || p.confidence === 'low' || p.confidence === 'medium' || p.confidence === 'high')
      || !(p.confidenceReason === null || object(p.confidenceReason))) throw new AiProposalError('error')
    const refs = p.evidenceRefs.map((r): Ref => {
      if (!object(r) || !Number.isSafeInteger(r.evidenceId) || !Number.isSafeInteger(r.version)) throw new AiProposalError('error')
      return { evidenceId: r.evidenceId as number, version: r.version as number, ...(text(r.quote) ? { quote: r.quote } : {}) }
    })
    return { skillKey: p.skillKey, level: p.level as number | null, evidenceRefs: refs, rationale: p.rationale, confidence: p.confidence as Confidence | null, confidenceReason: p.confidenceReason as Proposal['confidenceReason'] }
  })
  const warnings = value.warnings.filter((w): w is Warning => object(w) && text(w.skillKey) && (w.code === 'no_declared_autonomy' || w.code === 'level_capped'))
  return { proposals, warnings, token: value.token, expiresAt: value.expiresAt }
}

/** Opciones de cada propuesta: con nivel → aceptar, bajar a cada nivel menor, sin evaluar, no guardar. Sin nivel → solo no guardar (y retirar el nivel vigente si ya había uno). Nunca subir. */
export function choicesFor(proposal: Proposal, hasCurrent: boolean): Choice[] {
  if (proposal.level === null) return hasCurrent ? ['skip', 'null'] : ['skip']
  const lower = Array.from({ length: proposal.level - 1 }, (_, i) => String(proposal.level! - 1 - i) as Choice)
  return ['accept', ...lower, 'null', 'skip']
}
export const defaultChoice = (proposal: Proposal): Choice => proposal.level === null ? 'skip' : 'accept'
/** Nivel que quedaría guardado con esa elección (null = retirar). `undefined` = no se guarda. */
export function finalLevel(proposal: Proposal, choice: Choice): number | null | undefined {
  if (choice === 'skip') return undefined
  if (choice === 'null') return null
  if (choice === 'accept') return proposal.level
  const level = Number(choice)
  return proposal.level !== null && level >= 1 && level < proposal.level ? level : undefined
}

/** Cuerpo de `POST /api/skill-map/proposals/confirm`. Las propuestas viajan EXACTAMENTE como llegaron (sin citas textuales ni confianza): el token firmado las verifica. */
export function buildConfirmBody(input: { requestId: string; token: string; proposals: readonly Proposal[]; choices: Readonly<Record<string, Choice>> }) {
  const accept: string[] = []; const overrides: Record<string, number | null> = {}
  for (const proposal of input.proposals) {
    const choice = input.choices[proposal.skillKey] ?? defaultChoice(proposal)
    const level = finalLevel(proposal, choice)
    if (level === undefined) { if (choice !== 'skip') throw new AiProposalError('invalid'); continue }
    accept.push(proposal.skillKey)
    if (level !== proposal.level) overrides[proposal.skillKey] = level
  }
  if (accept.length < 1 || accept.length > MAX_SKILLS) throw new AiProposalError('invalid')
  return {
    token: input.token, requestId: input.requestId, accept, ...(Object.keys(overrides).length ? { overrides } : {}),
    proposals: input.proposals.map(p => ({ skillKey: p.skillKey, level: p.level, evidenceRefs: p.evidenceRefs.map(r => ({ evidenceId: r.evidenceId, version: r.version })), rationale: p.rationale })),
  }
}

async function codeOf(response: Response): Promise<string> {
  try { const body: unknown = await response.json(); return object(body) && text(body.code) ? body.code : '' } catch { return '' }
}
function failureOf(status: number, code: string): AiFailure {
  if (status === 401) return 'expired'
  if (status === 429) return 'budget'
  if (status === 410) return 'proposal_expired'
  if (status === 409 || code === 'evidence_not_valid') return 'changed'
  if (status === 422 && code === 'no_evidence') return 'no_evidence'
  if (status === 400 || status === 422) return 'invalid'
  if (status === 503) return 'unavailable'
  if (status === 502) return code === 'invalid_model_output' ? 'invalid_output' : 'provider'
  if (status >= 500) return 'uncertain'
  return 'error'
}
async function post(path: string, { baseUrl, token, body, signal, fetcher }: { baseUrl: string; token: string; body: unknown; signal?: AbortSignal; fetcher: typeof fetch }) {
  if (!token) throw new AiProposalError('expired')
  let response: Response
  try {
    response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST', cache: 'no-store', signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  } catch (error) { if (signal?.aborted) throw error; throw new AiProposalError('uncertain') }
  if (!response.ok) throw new AiProposalError(failureOf(response.status, await codeOf(response)))
  return response
}

/** `POST /api/skill-map/proposals`: nunca se manda un id de persona; el servidor usa solo el titular del token. Sin respuesta: no se sabe si se gastó cupo → «incierto». */
export async function requestProposals({ baseUrl, token, skillKeys, locale, signal, fetcher = fetch }: {
  baseUrl: string; token: string; skillKeys: readonly string[]; locale: 'es' | 'en'; signal?: AbortSignal; fetcher?: typeof fetch
}): Promise<Proposed> {
  const keys = [...new Set(skillKeys)]
  if (keys.length < 1 || keys.length > MAX_SKILLS) throw new AiProposalError('invalid')
  const response = await post('/api/skill-map/proposals', { baseUrl, token, signal, fetcher, body: { skillKeys: keys, locale } })
  let json: unknown
  try { json = await response.json() } catch { throw new AiProposalError('error') }
  return parseProposed(json)
}

/** `POST /api/skill-map/proposals/confirm`. El mismo requestId en los reintentos hace el guardado idempotente. */
export async function confirmProposals({ baseUrl, token, body, signal, fetcher = fetch }: {
  baseUrl: string; token: string; body: ReturnType<typeof buildConfirmBody>; signal?: AbortSignal; fetcher?: typeof fetch
}): Promise<{ saved: number; cleared: number }> {
  const response = await post('/api/skill-map/proposals/confirm', { baseUrl, token, body, signal, fetcher })
  let json: unknown = null
  try { json = await response.json() } catch { /* el servidor guardó; solo falta el conteo */ }
  const count = (key: string) => object(json) && Array.isArray(json[key]) ? json[key].length : object(json) && typeof json[key] === 'number' ? json[key] as number : 0
  return { saved: count('saved'), cleared: count('cleared') }
}

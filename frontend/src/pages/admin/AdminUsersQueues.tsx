// ES-186 parte D · Pestañas «Emparejamientos» y «Solicitudes de plan»: cada una con su propio cargando / error con «Reintentar» / vacío (nunca se traga el error) y el efecto
// visible de la acción. Si otra persona ya resolvió la solicitud (409 request_closed) se dice y se recarga la lista. Sin diálogos del navegador.
import { useState } from 'react'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { colors, radius, spacing } from '../../styles/tokens'
import { AdminDialog } from './AdminDialog'
import { adminRequest } from './adminUsersApi.ts'
import { MSG, resolveResult } from './adminUsersLogic.ts'
import { btn, field, label, notice } from './adminUsersStyles.ts'

export interface ListState<T> { items: T[]; state: 'loading' | 'ok' | 'error'; reload: () => void; retry: () => void }
export interface MatchingItem { id: number; user: { id: number; name: string; email: string }; chosenTherapist: { id: number; name: string }; answers: { area?: string; style?: string; language?: string }; createdAt: string }
export interface PlanItem { id: number; status: string; createdAt: string; requester: { id: number; name: string; email: string }; plan: { id: number; slug: string; name_es: string; name_en: string; price: number; currency: string } }

type Msg = { kind: 'ok' | 'error'; text: string; translated?: boolean } | null
const card = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', padding: `${spacing.md} ${spacing.lg}`, background: colors.bgMuted, borderRadius: radius.md, border: `0.5px solid ${colors.border}` } as const

function Frame<T>({ list, empty, children }: { list: ListState<T>; empty: string; children: React.ReactNode }) {
  const tr = useAdminText()
  if (list.state === 'loading') return <p role="status" style={{ color: colors.textMuted, fontSize: '0.875rem' }}>{tr('Cargando...')}</p>
  if (list.state === 'error') return (
    <div role="alert" style={notice('error')}>
      <span>{tr('No se pudo cargar esta sección.')} </span>
      <button type="button" style={btn.ghost} onClick={list.retry}>{tr('Reintentar')}</button>
    </div>
  )
  if (list.items.length === 0) return <p style={{ color: colors.textMuted, fontSize: '0.875rem' }}>{tr(empty)}</p>
  return <>{children}</>
}

export function MatchingPanel({ list, onResolved }: { list: ListState<MatchingItem>; onResolved: () => void }) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  async function confirmMatch(item: MatchingItem) {
    setBusyId(item.id); setMsg(null)
    const reply = await adminRequest(`/api/admin/matching/${item.id}/confirm`, { method: 'POST', body: {} })
    setBusyId(null)
    const result = resolveResult(reply.status, reply.data)
    if (result.kind === 'ok') { setMsg({ kind: 'ok', translated: true, text: `${tr('Emparejamiento confirmado:')} ${item.user?.name} → ${item.chosenTherapist?.name}.` }); onResolved() }
    else { setMsg({ kind: 'error', text: result.message }); if (result.kind === 'closed') onResolved() }
  }
  return (
    <div>
      <div aria-live="polite">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} style={notice(msg.kind)}>{msg.translated ? msg.text : tr(msg.text)}</div>}</div>
      <Frame list={list} empty={MSG.noMatching}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {list.items.map((item) => (
            <li key={item.id} style={card}>
              <div>
                <div style={{ fontWeight: 500, color: colors.text, overflowWrap: 'anywhere' }}>{item.user?.name} → {item.chosenTherapist?.name}</div>
                <div style={{ fontSize: '0.78rem', color: colors.textMuted, marginTop: spacing.xs }}>
                  {tr('Área')}: {item.answers?.area ?? '—'} · {tr('Estilo')}: {item.answers?.style ?? '—'} · {tr('Idioma')}: {item.answers?.language ?? '—'} · {new Date(item.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button type="button" style={{ ...btn.primary, ...(busyId === item.id ? btn.disabled : {}) }} onClick={() => void confirmMatch(item)} disabled={busyId !== null} aria-busy={busyId === item.id}>
                {busyId === item.id ? tr('Procesando...') : tr('Confirmar emparejamiento')}
              </button>
            </li>
          ))}
        </ul>
      </Frame>
    </div>
  )
}

export function PlanRequestsPanel({ list, onResolved }: { list: ListState<PlanItem>; onResolved: () => void }) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [rejecting, setRejecting] = useState<PlanItem | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const planName = (p: PlanItem['plan']) => (lang === 'en' ? p.name_en : p.name_es) || p.name_es

  async function resolve(item: PlanItem, verb: 'approve' | 'reject') {
    setBusyId(item.id); setMsg(null)
    const reply = await adminRequest(`/api/admin/plan-requests/admin/${item.id}/${verb}`, { method: 'PUT', body: verb === 'reject' ? { adminNote: note.trim() } : {} })
    setBusyId(null)
    const result = resolveResult(reply.status, reply.data)
    if (result.kind === 'ok') {
      setRejecting(null); setNote('')
      setMsg({ kind: 'ok', translated: true, text: verb === 'approve' ? `${tr('Solicitud aprobada:')} ${planName(item.plan)} → ${item.requester.name}.` : `${tr('Solicitud rechazada:')} ${item.requester.name}.` })
      onResolved()
    } else { if (verb === 'reject') setRejecting(null); setMsg({ kind: 'error', text: result.message }); if (result.kind === 'closed') onResolved() }
  }

  return (
    <div>
      <div aria-live="polite">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} style={notice(msg.kind)}>{msg.translated ? msg.text : tr(msg.text)}</div>}</div>
      <Frame list={list} empty={MSG.noPlanRequests}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {list.items.map((item) => (
            <li key={item.id} style={card}>
              <div>
                <div style={{ fontWeight: 500, color: colors.text, overflowWrap: 'anywhere' }}>{item.requester.name} <span style={{ color: colors.textMuted }}>→</span> <strong style={{ color: colors.primaryDark }}>{planName(item.plan)}</strong>
                  <span style={{ fontSize: '0.78rem', color: colors.textMuted, marginLeft: 6 }}>${item.plan.price} {item.plan.currency}{tr('/mes')}</span></div>
                <div style={{ fontSize: '0.78rem', color: colors.textMuted, marginTop: spacing.xs, overflowWrap: 'anywhere' }}>{item.requester.email}</div>
              </div>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button type="button" style={{ ...btn.primary, ...(busyId === item.id ? btn.disabled : {}) }} onClick={() => void resolve(item, 'approve')} disabled={busyId !== null} aria-busy={busyId === item.id}>{busyId === item.id ? tr('Procesando...') : tr('Aprobar')}</button>
                <button type="button" style={btn.danger} onClick={() => { setRejecting(item); setNote(''); setNoteError(''); setMsg(null) }} disabled={busyId !== null}>{tr('Rechazar…')}</button>
              </div>
            </li>
          ))}
        </ul>
      </Frame>
      {rejecting && (
        <AdminDialog title={tr('Rechazar solicitud')} onClose={() => setRejecting(null)} busy={busyId !== null}>
          <p style={{ fontSize: '0.875rem', color: colors.text, margin: `0 0 ${spacing.md}` }}>{rejecting.requester.name} → {planName(rejecting.plan)}</p>
          <label style={label} htmlFor="au-reject-note">{tr('Motivo (obligatorio)')}</label>
          <textarea id="au-reject-note" style={{ ...field, minHeight: 90, padding: spacing.md }} value={note} maxLength={500} onChange={(e) => { setNote(e.target.value); setNoteError('') }}
            aria-invalid={noteError ? true : undefined} aria-describedby={noteError ? 'au-reject-error' : undefined} />
          {noteError && <p id="au-reject-error" role="alert" style={{ fontSize: '0.8rem', color: colors.danger, margin: `${spacing.xs} 0 0` }}>{tr(noteError)}</p>}
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.lg }}>
            <button type="button" style={btn.ghost} onClick={() => setRejecting(null)} disabled={busyId !== null}>{tr('Cancelar')}</button>
            <button type="button" style={{ ...btn.danger, ...(busyId !== null ? btn.disabled : {}) }} disabled={busyId !== null} aria-busy={busyId === rejecting.id}
              onClick={() => { if (!note.trim()) { setNoteError(MSG.noReason); return } void resolve(rejecting, 'reject') }}>{busyId !== null ? tr('Procesando...') : tr('Rechazar')}</button>
          </div>
        </AdminDialog>
      )}
    </div>
  )
}

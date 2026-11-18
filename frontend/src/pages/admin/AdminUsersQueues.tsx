// ES-186 parte D · Pestañas «Emparejamientos» y «Solicitudes de plan»: cada una con su propio cargando / error con «Reintentar» / vacío (nunca se traga el error) y el efecto
// visible de la acción. Si otra persona ya resolvió la solicitud (409 request_closed) se dice y se recarga la lista. Sin diálogos del navegador.
// ES-310 (PR 5): Cartografía (ItemList, Button, Dialog, TextAreaField). Mismos textos, mismos estados y misma lógica.
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, TextAreaField } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import '../progressCopy.ts'
import { answerLabel } from '../../progress/answerLabels.ts'
import { adminRequest } from './adminUsersApi.ts'
import { MSG, resolveResult } from './adminUsersLogic.ts'
import './adminUsers.css'

export interface ListState<T> { items: T[]; state: 'loading' | 'ok' | 'error'; reload: () => void; retry: () => void }
export interface MatchingItem { id: number; user: { id: number; name: string; email: string }; chosenTherapist: { id: number; name: string }; answers: { area?: string; style?: string; language?: string }; createdAt: string }
export interface PlanItem { id: number; status: string; createdAt: string; requester: { id: number; name: string; email: string }; plan: { id: number; slug: string; name_es: string; name_en: string; price: number; currency: string } }

type Msg = { kind: 'ok' | 'error'; text: string; translated?: boolean } | null

function Frame<T>({ list, empty, children }: { list: ListState<T>; empty: string; children: React.ReactNode }) {
  const tr = useAdminText()
  if (list.state === 'loading') return <p role="status" className="cg-hint">{tr('Cargando...')}</p>
  if (list.state === 'error') return (
    <div role="alert" className="cg-banner cg-banner--error">
      <span className="cg-banner__title">{tr('No se pudo cargar esta sección.')} </span>
      <div className="pg-actions"><Button variant="ghost" onClick={list.retry}>{tr('Reintentar')}</Button></div>
    </div>
  )
  if (list.items.length === 0) return <p className="cg-hint">{tr(empty)}</p>
  return <>{children}</>
}

export function MatchingPanel({ list, onResolved }: { list: ListState<MatchingItem>; onResolved: () => void }) {
  const tr = useAdminText()
  const { lang, t } = useLanguage()
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
    <div className="cg-card pg-card au-panel">
      <div aria-live="polite" className="pg-live">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'cg-banner cg-banner--error' : 'cg-banner'}><span className="cg-banner__title">{msg.translated ? msg.text : tr(msg.text)}</span></div>}</div>
      <Frame list={list} empty={MSG.noMatching}>
        <ul className="cg-items">
          {list.items.map((item) => (
            <li key={item.id} className="cg-item">
              <strong className="au-name">{item.user?.name} → {item.chosenTherapist?.name}</strong>
              <p className="cg-hint au-name">
                {tr('Área')}: {answerLabel('area', item.answers?.area, t)} · {tr('Estilo')}: {answerLabel('style', item.answers?.style, t)} · {tr('Idioma')}: {answerLabel('language', item.answers?.language, t)} · {new Date(item.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <div className="pg-actions">
                <Button onClick={() => void confirmMatch(item)} disabled={busyId !== null} aria-busy={busyId === item.id}>
                  {busyId === item.id ? tr('Procesando...') : tr('Confirmar emparejamiento')}
                </Button>
              </div>
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
  const opener = useRef<HTMLElement | null>(null)
  // El foco vuelve al botón «Rechazar…» que abrió el diálogo (si la fila ya no existe, no queda foco forzado).
  useEffect(() => { if (rejecting === null && opener.current) { const target = opener.current; opener.current = null; if (target.isConnected) target.focus() } }, [rejecting])
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
    <div className="cg-card pg-card au-panel">
      <div aria-live="polite" className="pg-live">{msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'cg-banner cg-banner--error' : 'cg-banner'}><span className="cg-banner__title">{msg.translated ? msg.text : tr(msg.text)}</span></div>}</div>
      <Frame list={list} empty={MSG.noPlanRequests}>
        <ul className="cg-items">
          {list.items.map((item) => (
            <li key={item.id} className="cg-item">
              <div className="pg-itemtop">
                <strong className="au-name">{item.requester.name} → {planName(item.plan)}</strong>
                <span className="pg-price">${item.plan.price} {item.plan.currency}{tr('/mes')}</span>
              </div>
              <span className="cg-hint au-name">{item.requester.email}</span>
              <div className="pg-actions">
                <Button onClick={() => void resolve(item, 'approve')} disabled={busyId !== null} aria-busy={busyId === item.id}>{busyId === item.id ? tr('Procesando...') : tr('Aprobar')}</Button>
                <Button variant="ghost" onClick={(e) => { opener.current = e.currentTarget; setRejecting(item); setNote(''); setNoteError(''); setMsg(null) }} disabled={busyId !== null}>{tr('Rechazar…')}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Frame>
      {rejecting && (
        <Dialog open title={tr('Rechazar solicitud')} onClose={() => { if (busyId === null) setRejecting(null) }}
          actions={<><Button variant="ghost" onClick={() => setRejecting(null)} disabled={busyId !== null}>{tr('Cancelar')}</Button>
            <Button variant="danger" disabled={busyId !== null} aria-busy={busyId === rejecting.id}
              onClick={() => { if (!note.trim()) { setNoteError(MSG.noReason); return } void resolve(rejecting, 'reject') }}>{busyId !== null ? tr('Procesando...') : tr('Rechazar')}</Button></>}>
          <p>{rejecting.requester.name} → {planName(rejecting.plan)}</p>
          <TextAreaField id="au-reject-note" label={tr('Motivo (obligatorio)')} value={note} maxLength={500} onChange={(e) => { setNote(e.target.value); setNoteError('') }} error={noteError ? tr(noteError) : undefined} />
        </Dialog>
      )}
    </div>
  )
}

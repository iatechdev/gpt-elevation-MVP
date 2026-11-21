// ES-303 (PR B) · La persona revisora (profesional) crea invitaciones de un solo uso, copia el código (se muestra UNA vez) y anula las activas. Diseño aprobado: ES-303 comentarios 12827, 12828 y 12839.
// El código solo vive en el estado de este panel mientras está abierto: al pulsar «Listo» (o salir) se descarta y el servidor no puede volver a darlo (solo guarda su hash). Panel NO modal con aviso en región viva.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Card } from '../cartografia/pieces'
import { Chip } from '../cartografia/controls'
import { dateText } from '../routeCatalog/person'
import { API } from '../routeCatalog/shared'
import { useAuthCopy } from './useAuthCopy'
import { activeInvites, inviteLink, MAX_ACTIVE_INVITES, problemOf, reviewAuthApi, type InviteView } from './reviewAuthApi'

function RevokeDialog({ onKeep, onConfirm, busy }: { onKeep: () => void; onConfirm: () => void; busy: boolean }) {
  const { t } = useAuthCopy(); const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return (
    <dialog ref={ref} className="cg-dialog" aria-labelledby="revoke-title" onCancel={event => { event.preventDefault(); if (!busy) onKeep() }}>
      <h2 id="revoke-title" className="cg-h2">{t('revokeTitle')}</h2>
      <p>{t('revokeBody')}</p>
      <div className="cg-dialog__actions"><button className="cg-btn" type="button" autoFocus disabled={busy} onClick={onKeep}>{t('revokeKeep')}</button><button className="cg-btn cg-btn--ghost" type="button" disabled={busy} onClick={onConfirm}>{t('revokeYes')}</button></div>
    </dialog>
  )
}

export function InviteIssuer({ token, onSession }: { token: string; onSession: () => void }) {
  const { t, lang } = useAuthCopy()
  const api = useMemo(() => reviewAuthApi(API, token), [token])
  const [invites, setInvites] = useState<InviteView[] | null>(null); const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading'); const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false); const [fresh, setFresh] = useState<{ code: string | null } | null>(null); const [copied, setCopied] = useState<'' | 'copied' | 'linkCopied' | 'copyFailed'>('')
  const [message, setMessage] = useState<'' | 'full' | 'createError' | 'notAllowed' | 'revoked' | 'revokeError'>(''); const [toRevoke, setToRevoke] = useState<InviteView | null>(null); const [revoking, setRevoking] = useState(false)
  const pendingId = useRef<string | null>(null); const freshRef = useRef<HTMLElement>(null); const messageRef = useRef<HTMLDivElement>(null); const openerRef = useRef<HTMLButtonElement>(null); const revokeOpener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void api.invites(controller.signal).then(rows => { if (!controller.signal.aborted) { setInvites(rows); setStatus('ok') } })
      .catch(error => { if (!controller.signal.aborted) { if (problemOf(error) === 'session') onSession(); else setStatus('error') } })
    return () => controller.abort()
  }, [api, attempt, onSession])
  useEffect(() => { if (fresh) freshRef.current?.focus() }, [fresh])

  const refresh = useCallback(() => setAttempt(n => n + 1), [])
  // F421-1: al cerrar el diálogo SIN anular (Escape o «Conservar») el foco vuelve al botón que lo abrió; con «Sí, anular» el foco va al aviso.
  const keepRevoke = () => { setToRevoke(null); requestAnimationFrame(() => revokeOpener.current?.focus()) }
  const active = invites ? activeInvites(invites) : 0; const full = active >= MAX_ACTIVE_INVITES
  useEffect(() => { if (message) messageRef.current?.focus() }, [message, full]) // `full` también: tras el 409 el aviso pasa del banner del servidor al derivado de la lista y el foco debe seguirlo
  const when = (value: string) => dateText(value, lang) ?? ''

  async function create() {
    // El MISMO intento reutiliza el MISMO requestId (un reintento tras un corte de red no duplica ni gasta otra invitación); tras un éxito se genera otro.
    const requestId = pendingId.current ?? crypto.randomUUID(); pendingId.current = requestId
    setCreating(true); setMessage(''); setCopied('')
    try {
      const out = await api.createInvite(requestId); pendingId.current = null
      setFresh({ code: out.code }); refresh() // sin código = reintento de una invitación ya creada: se explica que el código solo se mostró una vez
    } catch (error) {
      const found = problemOf(error)
      if (found === 'session') { onSession(); return }
      if (found === 'full') { pendingId.current = null; setMessage('full'); refresh() } else if (found === 'invalid' || found === 'gone') { pendingId.current = null; setMessage('notAllowed') } else setMessage('createError')
    } finally { setCreating(false) }
  }
  async function copy(what: 'copied' | 'linkCopied') {
    if (!fresh?.code) return
    try { await navigator.clipboard.writeText(what === 'copied' ? fresh.code : inviteLink(window.location.origin, fresh.code)); setCopied(what) } catch { setCopied('copyFailed') }
  }
  async function revoke() {
    if (!toRevoke) return
    setRevoking(true)
    try { await api.revokeInvite(toRevoke.id); setMessage('revoked') } catch (error) { if (problemOf(error) === 'session') { onSession(); return } setMessage('revokeError') } finally { setRevoking(false); setToRevoke(null); refresh() }
  }
  const stateLabel = (invite: InviteView) => (invite.status === 'active' ? t('stActive') : invite.status === 'used' ? t('stUsed') : invite.status === 'expired' ? t('stExpired') : t('stRevoked2'))
  const detail = (invite: InviteView) => (invite.status === 'used' && invite.usedAt ? t('usedOn', { date: when(invite.usedAt) }) : invite.status === 'revoked' && invite.revokedAt ? t('revokedOn', { date: when(invite.revokedAt) }) : t('expires', { date: when(invite.expiresAt) }))

  return (
    <div className="rv-stack">
      <p className="cg-hint">{t('inviteLead')}</p>
      {/* F421-2: el aviso del tope es UNO solo: el derivado de la lista (con 10 activas) o, justo tras un 409 y antes de recargar, el del servidor. */}
      {message && !(message === 'full' && full) && <div ref={messageRef} tabIndex={-1}><Banner kind={message === 'revoked' ? 'note' : 'error'} title={t(message)} /></div>}
      {/* O303-focus (QA-421 v2): tras el 409 el botón queda deshabilitado y el aviso derivado de la lista reemplaza al del servidor: el foco se queda en el aviso (no cae en <body>). */}
      {full && (message === 'full' ? <div ref={messageRef} tabIndex={-1}><Banner kind="error" title={t('full')} /></div> : <Banner kind="error" title={t('full')} />)}
      <div className="cg-row"><button ref={openerRef} type="button" className="cg-btn" disabled={creating || full || status === 'loading'} onClick={() => void create()}>{creating ? t('creating') : t('create')}</button></div>
      {fresh && (
        <Card as="section" className="rv-card">
          <section ref={freshRef} tabIndex={-1} aria-labelledby="rv-new-title">
            <h2 id="rv-new-title" className="cg-h2">{t('newTitle')}</h2>
            {fresh.code ? <>
              <p className="rv-code" translate="no">{fresh.code}</p>
              <p role="status" aria-live="polite"><strong>{t('newWarn')}</strong></p>
              <div className="cg-row">
                <button type="button" className="cg-btn" onClick={() => void copy('copied')}>{t('copyCode')}</button>
                <button type="button" className="cg-btn cg-btn--ghost" onClick={() => void copy('linkCopied')}>{t('copyLink')}</button>
                <button type="button" className="cg-btn cg-btn--ghost" onClick={() => { setFresh(null); setCopied(''); requestAnimationFrame(() => openerRef.current?.focus()) }}>{t('done')}</button>
              </div>
              <p role="status" aria-live="polite" className="cg-small cg-muted">{copied ? t(copied) : ''}</p>
            </> : <p>{t('replay')}</p>}
          </section>
        </Card>
      )}
      <Card as="section" className="rv-card">
        <h2 className="cg-h2">{t('invitesTitle')}</h2>
        {status === 'loading' && <p role="status" className="cg-muted">{t('loading')}</p>}
        {status === 'error' && <Banner kind="error" title={t('invitesError')}><div className="cg-row"><button className="cg-btn cg-btn--ghost" type="button" onClick={() => { setStatus('loading'); refresh() }}>{t('retry')}</button></div></Banner>}
        {status === 'ok' && invites && invites.length === 0 && <p>{t('invitesNone')}</p>}
        {status === 'ok' && invites && invites.length > 0 && (
          <ul className="rv-list">
            {invites.map(invite => (
              <li key={invite.id} className="rv-row">
                <div className="rv-row__top"><strong>{t('invitation')} #{invite.id}</strong><Chip tone={invite.status === 'active' ? 'ok' : 'neutral'} symbol={invite.status === 'active' ? '✓' : '○'}>{stateLabel(invite)}</Chip></div>
                <p className="cg-hint">{t('createdOn', { date: when(invite.createdAt) })} · {detail(invite)}</p>
                {invite.status === 'active' && <div className="cg-row"><button type="button" className="cg-btn cg-btn--ghost" aria-label={`${t('revokeTitle')} #${invite.id}`} onClick={event => { revokeOpener.current = event.currentTarget; setToRevoke(invite) }}>{t('revoke')}</button></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {toRevoke && <RevokeDialog busy={revoking} onKeep={keepRevoke} onConfirm={() => void revoke()} />}
    </div>
  )
}

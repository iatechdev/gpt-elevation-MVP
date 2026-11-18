// frontend/src/components/TherapistSharingCard.tsx
// ES-329 (Mi profesional): SOLO cambia la presentación (Cartografía: tarjeta, botones y Dialog con foco atrapado y foco devuelto); la lógica de permiso, incertidumbre (ES-244) y desvinculación no cambia.
// ES-100 (con el API de ES-96) — la propia persona decide si comparte sus datos con SU terapeuta y puede desvincularse.
// Interruptor accesible (role="switch"), confirmación en diálogo modal con foco atrapado, ES/EN. El permiso va ligado al terapeuta actual
// (el servidor resuelve el alcance; el cliente nunca elige a quién autoriza).

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { localizeServerError } from '../i18n/serverError'
import { Button } from '../cartografia/controls'
import { Banner } from '../cartografia/pieces'
import { Dialog } from '../cartografia/interactive'

const API = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''
const headers = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' })

interface Props {
  therapistName: string
  onUnlinked: () => void
}

type Status = 'loading' | 'granted' | 'off' | 'hidden' | 'loaderror'

export function TherapistSharingCard({ therapistName, onUnlinked }: Props) {
  const { t, lang } = useLanguage()
  const [status, setStatus] = useState<Status>('loading')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState('')
  const [reloadKey, setReloadKey] = useState(0) // ES-169: «Reintentar» tras un error al leer el permiso
  // ES-244: un cambio de permiso cuyo resultado no se conoce (corte, tiempo agotado, 5xx) NO se da por fallido: se relee el estado real del servidor.
  // `unsure` guarda el cambio pedido; `unknown` = ni siquiera se pudo releer: entonces no se muestra ningún interruptor (sería un estado inventado).
  const [unsure, setUnsure] = useState<'granted' | 'revoked' | null>(null)
  const [unknown, setUnknown] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/consents`, { headers: headers() })
        if (!res.ok) throw new Error()
        const body = await res.json()
        const entry = (body.consents ?? []).find((c: { purpose: string }) => c.purpose === 'therapist_sharing')
        if (!alive) return
        // Sin entrada o sin terapeuta vinculado (applicable === false) la tarjeta no se muestra.
        setStatus(!entry || entry.applicable === false ? 'hidden' : entry.status === 'granted' ? 'granted' : 'off')
      } catch {
        if (alive) setStatus('loaderror') // ES-169: un error de lectura ya no oculta la tarjeta en silencio: se dice y se puede reintentar
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  // Lee el permiso real (mismo GET que la carga). null = no se pudo leer.
  const readReal = async (): Promise<'granted' | 'off' | 'hidden' | null> => {
    try {
      const res = await fetch(`${API}/api/consents`, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(15000) })
      if (!res.ok) return null
      const body = await res.json()
      const entry = (body.consents ?? []).find((c: { purpose: string }) => c.purpose === 'therapist_sharing')
      return !entry || entry.applicable === false ? 'hidden' : entry.status === 'granted' ? 'granted' : 'off'
    } catch { return null }
  }
  // Tras un resultado incierto: relee y deja la pantalla = lo que dice el servidor. Solo declara éxito si lo leído coincide con lo pedido.
  const verify = async (target: 'granted' | 'revoked') => {
    setChecking(true); setMessage(null)
    const real = await readReal()
    setChecking(false)
    if (real === null) { setUnknown(true); setUnsure(target); return }
    setUnknown(false)
    if (real === 'hidden') { setStatus('hidden'); setUnsure(null); return }
    setStatus(real)
    if ((real === 'granted') === (target === 'granted')) { setUnsure(null); setMessage({ kind: 'ok', text: t('mt_share_saved') }); return }
    // El servidor aún no muestra el cambio: puede no haberse aplicado o estar aplicándose. Se dice lo que se ve y se deja «Comprobar».
    setUnsure(target); setMessage({ kind: 'error', text: t(target === 'granted' ? 'mt_share_not_seen_on' : 'mt_share_not_seen_off') })
  }

  const toggle = async () => {
    if (saving || checking || status === 'loading' || status === 'hidden' || status === 'loaderror') return
    const next = status === 'granted' ? 'revoked' : 'granted'
    setSaving(true)
    setMessage(null); setUnsure(null); setUnknown(false)
    let uncertain = false
    try {
      // PUT con el estado deseado: repetirlo es idempotente en el servidor (`changed` indica si hubo cambio), no hace falta requestId.
      const res = await fetch(`${API}/api/consents/therapist_sharing`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status: next }), signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        setStatus(next === 'granted' ? 'granted' : 'off')
        setMessage({ kind: 'ok', text: t('mt_share_saved') })
      } else if (res.status >= 500) {
        uncertain = true // el servidor pudo aplicarlo antes de fallar
      } else {
        const body = await res.json().catch(() => ({}))
        setMessage({ kind: 'error', text: localizeServerError(body.error, lang, t('mt_share_error')) }) // respuesta definitiva: no se aplicó
      }
    } catch {
      uncertain = true // sin respuesta (corte o tiempo agotado): el servidor pudo haberlo aplicado
    } finally {
      setSaving(false)
    }
    if (uncertain) await verify(next)
  }
  const closeDialog = useCallback(() => {
    setConfirming(false)
    setUnlinkError('')
  }, [])

  // El diálogo (Dialog de Cartografía) atrapa el foco, cierra con Esc y devuelve el foco al botón que lo abrió.

  const unlink = async () => {
    setUnlinking(true)
    setUnlinkError('')
    try {
      const res = await fetch(`${API}/api/sessions/user/my-therapist`, { method: 'DELETE', headers: headers() })
      if (!res.ok) throw new Error()
      setConfirming(false)
      onUnlinked()
    } catch {
      setUnlinkError(t('mt_unlink_error'))
    } finally {
      setUnlinking(false)
    }
  }

  // ES-329: mientras se lee el permiso se reserva el alto de la tarjeta (evita que las sesiones salten hacia abajo al aparecer); sin permiso aplicable no se muestra nada.
  if (status === 'loading') return <div className="pc-reserve" aria-hidden="true" />
  if (status === 'hidden') return null
  if (status === 'loaderror') {
    return (
      <Banner kind="error" title={t('mt_share_load_error')}>
        <div className="pg-actions"><Button onClick={() => { setStatus('loading'); setReloadKey(k => k + 1) }}>{t('mt_share_retry')}</Button></div>
      </Banner>
    )
  }
  const on = status === 'granted'
  const live = saving ? t('mt_share_saving') : checking ? t('mt_share_checking') : unknown && unsure ? t(unsure === 'granted' ? 'mt_share_unsure_on' : 'mt_share_unsure_off') : message?.text ?? ''

  return (
    <section className="cg-card pg-card" aria-labelledby="mt-share-label">
      <div className="pc-top">
        <div>
          <h2 id="mt-share-label">{t('mt_share_title')}</h2>
          <p id="mt-share-desc">{t('mt_share_desc')}</p>
        </div>
        {unknown && unsure ? (
          <Button onClick={() => void verify(unsure)} disabled={checking}>{checking ? t('mt_share_checking') : t('mt_share_check')}</Button>
        ) : (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="mt-share-label"
          aria-describedby="mt-share-desc"
          disabled={saving || checking}
          onClick={toggle}
          className="pc-switch"
        >
          <span className="pc-switch-knob" aria-hidden="true" />
          <span className="sr-only">{on ? t('mt_share_on') : t('mt_share_off')}</span>
        </button>
        )}
      </div>

      <div role="status" aria-live="polite" className={live && message?.kind === 'error' && !saving && !checking && !(unknown && unsure) ? 'cg-error pc-live' : 'cg-hint pc-live'}>{live}</div>
      {unsure && !unknown && !checking && (
        <div className="pg-actions"><Button variant="ghost" onClick={() => void verify(unsure)}>{t('mt_share_check')}</Button></div>
      )}

      <div className="pg-actions"><Button variant="danger" onClick={() => setConfirming(true)}>{t('mt_unlink_btn')}</Button></div>

      <Dialog open={confirming} onClose={() => { if (!unlinking) closeDialog() }} title={t('mt_unlink_title').replace('{name}', therapistName)}
        actions={<>
          <Button variant="ghost" onClick={closeDialog} disabled={unlinking}>{t('mt_unlink_cancel')}</Button>
          <Button variant="danger" onClick={unlink} disabled={unlinking} aria-busy={unlinking}>{unlinking ? t('mt_unlink_working') : t('mt_unlink_confirm')}</Button>
        </>}>
        <p id="mt-unlink-body">{t('mt_unlink_body')}</p>
        {unlinkError && <p role="alert" className="cg-error">{unlinkError}</p>}
      </Dialog>
    </section>
  )
}

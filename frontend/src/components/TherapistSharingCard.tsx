// frontend/src/components/TherapistSharingCard.tsx
// ES-100 (con el API de ES-96) — la propia persona decide si comparte sus datos con SU terapeuta y puede desvincularse.
// Interruptor accesible (role="switch"), confirmación en diálogo modal con foco atrapado, ES/EN. El permiso va ligado al terapeuta actual
// (el servidor resuelve el alcance; el cliente nunca elige a quién autoriza).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { localizeServerError } from '../i18n/serverError'

const API = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''
const headers = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' })

interface Props {
  therapistName: string
  onUnlinked: () => void
}

type Status = 'loading' | 'granted' | 'off' | 'hidden'

export function TherapistSharingCard({ therapistName, onUnlinked }: Props) {
  const { t, lang } = useLanguage()
  const [status, setStatus] = useState<Status>('loading')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState('')
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

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
        if (alive) setStatus('hidden')
      }
    })()
    return () => { alive = false }
  }, [])

  const toggle = async () => {
    if (saving || status === 'loading' || status === 'hidden') return
    const next = status === 'granted' ? 'revoked' : 'granted'
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`${API}/api/consents/therapist_sharing`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status: next }) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setMessage({ kind: 'error', text: localizeServerError(body.error, lang, t('mt_share_error')) })
        return
      }
      setStatus(next === 'granted' ? 'granted' : 'off')
      setMessage({ kind: 'ok', text: t('mt_share_saved') })
    } catch {
      setMessage({ kind: 'error', text: t('mt_share_error') })
    } finally {
      setSaving(false)
    }
  }

  const closeDialog = useCallback(() => {
    setConfirming(false)
    setUnlinkError('')
    openerRef.current?.focus() // devuelve el foco al botón que abrió el diálogo
  }, [])

  // Diálogo: foco inicial en «Cancelar», Tab atrapado dentro, Esc cierra (salvo mientras se desvincula).
  useEffect(() => {
    if (!confirming) return
    const root = dialogRef.current
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
    focusables()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !unlinking) { event.preventDefault(); closeDialog(); return }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirming, unlinking, closeDialog])

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

  if (status === 'loading' || status === 'hidden') return null
  const on = status === 'granted'

  return (
    <div style={{ background: '#fff', borderRadius: '1rem', border: '0.5px solid #E7E5E4', boxShadow: '0 2px 12px rgba(26,28,27,0.06)', padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="mt-share-label" style={{ fontWeight: 600, color: '#1C1917', fontSize: '0.95rem' }}>{t('mt_share_title')}</div>
          <p id="mt-share-desc" style={{ fontSize: '0.82rem', color: '#57534E', lineHeight: 1.55, margin: '0.35rem 0 0' }}>{t('mt_share_desc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="mt-share-label"
          aria-describedby="mt-share-desc"
          disabled={saving}
          onClick={toggle}
          style={{
            flexShrink: 0, minWidth: 56, minHeight: 44, padding: '0 4px', border: 'none', background: 'none',
            cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span aria-hidden="true" style={{
            position: 'relative', width: 48, height: 28, borderRadius: 999, background: on ? '#4A6741' : '#78716C',
            transition: 'background 0.15s', display: 'inline-block',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s',
            }} />
          </span>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {on ? t('mt_share_on') : t('mt_share_off')}
          </span>
        </button>
      </div>

      <div role="status" aria-live="polite" style={{ minHeight: '1.2rem', marginTop: '0.5rem', fontSize: '0.78rem', color: message?.kind === 'error' ? '#B91C1C' : '#4A6741' }}>
        {saving ? t('mt_share_saving') : message?.text ?? ''}
      </div>

      <button
        type="button"
        ref={openerRef}
        onClick={() => setConfirming(true)}
        style={{
          marginTop: '0.75rem', minHeight: 44, padding: '0.5rem 1rem', background: 'transparent', border: '0.5px solid #B91C1C',
          borderRadius: '0.85rem', color: '#B91C1C', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}
      >
        {t('mt_unlink_btn')}
      </button>

      {confirming && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !unlinking) closeDialog() }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mt-unlink-title"
            aria-describedby="mt-unlink-body"
            style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: 420, boxSizing: 'border-box' }}
          >
            <h2 id="mt-unlink-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              {t('mt_unlink_title').replace('{name}', therapistName)}
            </h2>
            <p id="mt-unlink-body" style={{ fontSize: '0.875rem', color: '#44403C', lineHeight: 1.6, margin: '0 0 1rem' }}>{t('mt_unlink_body')}</p>
            {unlinkError && <p role="alert" style={{ color: '#B91C1C', fontSize: '0.82rem', margin: '0 0 0.75rem' }}>{unlinkError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={closeDialog} disabled={unlinking}
                style={{ minHeight: 44, padding: '0.5rem 1.1rem', background: 'transparent', border: '0.5px solid #D6D3D1', borderRadius: '0.85rem', color: '#44403C', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                {t('mt_unlink_cancel')}
              </button>
              <button type="button" onClick={unlink} disabled={unlinking}
                style={{ minHeight: 44, padding: '0.5rem 1.1rem', background: '#B91C1C', border: 'none', borderRadius: '0.85rem', color: '#fff', cursor: unlinking ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                {unlinking ? t('mt_unlink_working') : t('mt_unlink_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

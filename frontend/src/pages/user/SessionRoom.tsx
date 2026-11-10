// frontend/src/pages/user/SessionRoom.tsx
// HU-067 — Vista de la persona para unirse a la videollamada
// ES-100 — textos vía i18n ES/EN y errores del servidor en el idioma de la persona (ES93-B4)
// ES-169 PR3 — estados «conectando» → «antes de entrar» (se explica el permiso de cámara y micrófono ANTES de que el navegador lo pida) → «en curso»;
// «aún no comienza» y «error» con reintento sin recargar toda la página. Pedir la sala es una LECTURA (GET /user/:id/join, sin escrituras): repetirla o recargar no repite ninguna acción.

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeServerError } from '../../i18n/serverError'
import '../../styles/therapist.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

type Phase = 'connecting' | 'not_started' | 'error' | 'ready' | 'in_room'

const primaryButton: React.CSSProperties = {
  minHeight: 44, padding: '0.6rem 1.25rem', background: '#4A6741', color: '#fff',
  border: 'none', borderRadius: '0.65rem', cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
}
const secondaryButton: React.CSSProperties = {
  minHeight: 44, padding: '0.6rem 1.25rem', background: 'transparent',
  border: '1px solid #78716C', borderRadius: '0.65rem',
  color: '#44403C', cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
}
const centered: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: '100vh',
  fontFamily: 'Inter, sans-serif', gap: '1rem', padding: '2rem', textAlign: 'center',
}

export function UserSessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [meetingUrl, setMeetingUrl] = useState<string | null>(null)
  const [phase, setPhase]           = useState<Phase>('connecting')
  const [error, setError]           = useState('')
  const [attempt, setAttempt]       = useState(0) // el botón de reintento vuelve a pedir la sala sin recargar la página

  useEffect(() => {
    let alive = true
    const joinSession = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/user/${id}/join`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) {
          // El servidor responde en inglés «Session has not started yet.» cuando la sesión aún no empieza.
          if (typeof data.error === 'string' && data.error.startsWith('Session has not started yet')) setPhase('not_started')
          else { setError(localizeServerError(data.error, lang, t('room_join_error'))); setPhase('error') }
          return
        }
        setMeetingUrl(data.meetingUrl)
        setPhase('ready')
      } catch {
        if (!alive) return
        setError(t('room_connection_error')); setPhase('error')
      }
    }
    void joinSession()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se une una vez por sala (o por reintento); el idioma solo afecta al texto del error
  }, [id, attempt])

  const retry = () => { setError(''); setPhase('connecting'); setAttempt(a => a + 1) }
  const home = () => navigate('/app/dashboard')

  if (phase === 'connecting') return (
    <div role="status" aria-busy="true" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, sans-serif', color: '#57534E',
    }}>
      <div>{t('room_join_loading')}</div>
    </div>
  )

  if (phase === 'error' || phase === 'not_started') return (
    <div style={centered}>
      <h1 role="alert" style={{ fontSize: '1rem', fontWeight: 500, color: '#1C1917', margin: 0 }}>
        {phase === 'not_started' ? t('room_not_started_title') : error}
      </h1>
      {phase === 'not_started' && (
        <div style={{ fontSize: '0.875rem', color: '#57534E', maxWidth: 360, lineHeight: 1.6 }}>
          {t('room_not_started_body')}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={retry} style={primaryButton}>{t('room_retry')}</button>
        <button onClick={home} style={secondaryButton}>{t('room_home')}</button>
      </div>
    </div>
  )

  // La sala está lista, pero el navegador pedirá cámara y micrófono en cuanto cargue el video: se explica antes y la persona decide cuándo entrar.
  if (phase === 'ready') return (
    <div style={centered}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.4rem', color: '#1C1917', margin: 0 }}>
        {t('room_pre_title')}
      </h1>
      <p style={{ fontSize: '0.9rem', color: '#44403C', maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
        {t('room_pre_body')}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => setPhase('in_room')} autoFocus style={primaryButton}>{t('room_pre_enter')}</button>
        <button onClick={home} style={secondaryButton}>{t('room_home')}</button>
      </div>
    </div>
  )

  return (
    <div className="th-a11y" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1C1917' }}>
      {/* Header mínimo */}
      <div style={{
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <h1 style={{ color: '#E7E5E4', fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 400, margin: 0 }}>
          {t('room_in_progress')}
        </h1>
        <button
          onClick={home}
          style={{
            minHeight: 44, padding: '0.4rem 0.85rem', background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.35)', borderRadius: '0.5rem',
            color: '#D6D3D1', fontSize: '0.78rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {t('room_leave')}
        </button>
      </div>

      {/* iframe Daily.co */}
      <iframe
        src={meetingUrl ?? ''}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, border: 'none' }}
        title={t('room_iframe_title')}
      />
    </div>
  )
}

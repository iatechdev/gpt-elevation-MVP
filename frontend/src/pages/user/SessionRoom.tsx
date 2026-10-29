// frontend/src/pages/user/SessionRoom.tsx
// HU-067 — Vista del paciente para unirse a la videollamada
// ES-100 — textos vía i18n ES/EN y errores del servidor en el idioma de la persona (ES93-B4)

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { localizeServerError } from '../../i18n/serverError'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

export function UserSessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [meetingUrl, setMeetingUrl] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [notStarted, setNotStarted] = useState(false)

  useEffect(() => {
    const joinSession = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/user/${id}/join`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          // El servidor responde en inglés «Session has not started yet.» cuando la sesión aún no empieza.
          if (typeof data.error === 'string' && data.error.startsWith('Session has not started yet')) setNotStarted(true)
          else setError(localizeServerError(data.error, lang, t('room_join_error')))
          return
        }
        setMeetingUrl(data.meetingUrl)
      } catch {
        setError(t('room_connection_error'))
      } finally {
        setLoading(false)
      }
    }
    joinSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se une una sola vez por sala; el idioma solo afecta al texto del error
  }, [id])

  if (loading) return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, sans-serif', color: '#57534E',
      flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ fontSize: '1.5rem' }} aria-hidden="true">🎥</div>
      <div>{t('room_join_loading')}</div>
    </div>
  )

  if (error || notStarted) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', gap: '1rem', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem' }} aria-hidden="true">⏳</div>
      <div role="alert" style={{ fontSize: '1rem', fontWeight: 500, color: '#1C1917' }}>
        {notStarted ? t('room_not_started_title') : error}
      </div>
      {notStarted && (
        <div style={{ fontSize: '0.875rem', color: '#57534E', maxWidth: 360, lineHeight: 1.6 }}>
          {t('room_not_started_body')}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            minHeight: 44, padding: '0.6rem 1.25rem', background: '#4A6741', color: '#fff',
            border: 'none', borderRadius: '0.65rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
          }}
        >
          {t('room_retry')}
        </button>
        <button
          onClick={() => navigate('/app/dashboard')}
          style={{
            minHeight: 44, padding: '0.6rem 1.25rem', background: 'transparent',
            border: '0.5px solid #A8A29E', borderRadius: '0.65rem',
            color: '#44403C', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
          }}
        >
          {t('room_home')}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1C1917' }}>
      {/* Header mínimo */}
      <div style={{
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ color: '#E7E5E4', fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 400 }}>
          {t('room_in_progress')}
        </span>
        <button
          onClick={() => navigate('/app/dashboard')}
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

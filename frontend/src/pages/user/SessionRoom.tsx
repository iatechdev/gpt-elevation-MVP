// frontend/src/pages/user/SessionRoom.tsx
// HU-067 — Vista del paciente para unirse a la videollamada

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') || ''

export function UserSessionRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meetingUrl, setMeetingUrl] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    const joinSession = async () => {
      try {
        const res = await fetch(`${API}/api/sessions/user/${id}/join`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'No se pudo unir a la sesión.')
          return
        }
        setMeetingUrl(data.meetingUrl)
      } catch {
        setError('Error de conexión.')
      } finally {
        setLoading(false)
      }
    }
    joinSession()
  }, [id])

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, sans-serif', color: '#78716C',
      flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ fontSize: '1.5rem' }}>🎥</div>
      <div>Conectando a tu sesión...</div>
    </div>
  )

  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      fontFamily: 'Inter, sans-serif', gap: '1rem', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem' }}>⏳</div>
      <div style={{ fontSize: '1rem', fontWeight: 500, color: '#1C1917' }}>
        La sesión aún no ha comenzado
      </div>
      <div style={{ fontSize: '0.875rem', color: '#78716C', maxWidth: 360, lineHeight: 1.6 }}>
        {error === 'Session has not started yet.'
          ? 'Tu terapeuta todavía no ha iniciado la videollamada. Por favor esperá unos minutos e intentá de nuevo.'
          : error}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          onClick={() => { setLoading(true); setError(''); window.location.reload() }}
          style={{
            padding: '0.6rem 1.25rem', background: '#6B7D5C', color: '#fff',
            border: 'none', borderRadius: '0.65rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
          }}
        >
          Reintentar
        </button>
        <button
          onClick={() => navigate('/app/dashboard')}
          style={{
            padding: '0.6rem 1.25rem', background: 'transparent',
            border: '0.5px solid #E7E5E4', borderRadius: '0.65rem',
            color: '#78716C', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
          }}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1C1917' }}>
      {/* Header mínimo */}
      <div style={{
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ color: '#E7E5E4', fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 400 }}>
          Elevation — Sesión en curso
        </span>
        <button
          onClick={() => navigate('/app/dashboard')}
          style={{
            padding: '0.4rem 0.85rem', background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem',
            color: '#A8A29E', fontSize: '0.78rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Salir
        </button>
      </div>

      {/* iframe Daily.co */}
      <iframe
        src={meetingUrl ?? ''}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, border: 'none' }}
        title="Sesión Elevation"
      />
    </div>
  )
}
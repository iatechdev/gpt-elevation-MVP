// frontend/src/components/MatchingModal.tsx
// HU-060 — Modal de matching reutilizable

import { useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'

const API      = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''

interface TherapistSuggestion {
  therapistId:   number
  therapistName: string
  score:         number
  reason:        string
}

interface Props {
  onClose:   () => void
  onSuccess: (therapistName: string) => void
}

const TOPICS = [
  { key: 'anxiety',        es: 'Ansiedad',        en: 'Anxiety' },
  { key: 'relationships',  es: 'Relaciones',       en: 'Relationships' },
  { key: 'self-knowledge', es: 'Autoconocimiento', en: 'Self-knowledge' },
  { key: 'habits',         es: 'Hábitos',          en: 'Habits' },
  { key: 'other',          es: 'Otro',             en: 'Other' },
]

const APPROACHES = [
  { key: 'reflective',  es: 'Reflexivo',    en: 'Reflective' },
  { key: 'structured',  es: 'Estructurado', en: 'Structured' },
  { key: 'spiritual',   es: 'Espiritual',   en: 'Spiritual' },
  { key: 'practical',   es: 'Práctico',     en: 'Practical' },
]

const LANGUAGES = [
  { key: 'es',   es: 'Español', en: 'Spanish' },
  { key: 'en',   es: 'Inglés',  en: 'English' },
  { key: 'both', es: 'Ambos',   en: 'Both' },
]

export function MatchingModal({ onClose, onSuccess }: Props) {
  const { lang } = useLanguage()

  // Step: 'form' | 'results' | 'success'
  const [step,        setStep]        = useState<'form' | 'results' | 'success'>('form')
  const [topic,       setTopic]       = useState('')
  const [approach,    setApproach]    = useState('')
  const [language,    setLanguage]    = useState('')
  const [searching,   setSearching]   = useState(false)
  const [choosing,    setChoosing]    = useState(false)
  const [requestId,   setRequestId]   = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<TherapistSuggestion[]>([])
  const [error,       setError]       = useState('')

  const canSearch = topic && approach && language

  const handleSearch = async () => {
    if (!canSearch) return
    setSearching(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/matching/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          answers: { area: topic, style: approach, language },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? (lang === 'es' ? 'Error buscando terapeutas.' : 'Error searching therapists.'))
        return
      }
      setRequestId(data.requestId)
      setSuggestions(data.suggestions ?? [])
      setStep('results')
    } catch {
      setError(lang === 'es' ? 'Error de conexión.' : 'Connection error.')
    } finally {
      setSearching(false)
    }
  }

  const handleChoose = async (therapistId: number, therapistName: string) => {
    if (!requestId) return
    setChoosing(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/matching/choose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ requestId, therapistId }),
      })
      if (!res.ok) {
        setError(lang === 'es' ? 'Error seleccionando terapeuta.' : 'Error selecting therapist.')
        return
      }
      setStep('success')
      setTimeout(() => {
        onSuccess(therapistName)
        onClose()
      }, 2500)
    } catch {
      setError(lang === 'es' ? 'Error de conexión.' : 'Connection error.')
    } finally {
      setChoosing(false)
    }
  }

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.85rem',
    borderRadius: '999px',
    border: `1px solid ${selected ? '#6B7D5C' : '#E7E5E4'}`,
    background: selected ? '#EAF0E6' : '#fff',
    color: selected ? '#4A6741' : '#78716C',
    fontSize: '0.82rem',
    fontWeight: selected ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.15s',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(28,25,23,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: '1rem',
        padding: '2rem', width: '100%', maxWidth: 520,
        boxShadow: '0 8px 32px rgba(26,28,27,0.14)',
        fontFamily: 'Inter, sans-serif',
        maxHeight: '90vh', overflowY: 'auto',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.25rem', color: '#1C1917', margin: 0 }}>
            {step === 'success'
              ? (lang === 'es' ? '¡Terapeuta elegido!' : 'Therapist chosen!')
              : step === 'results'
              ? (lang === 'es' ? 'Terapeutas para vos' : 'Therapists for you')
              : (lang === 'es' ? 'Encontremos tu terapeuta ideal' : 'Let\'s find your ideal therapist')}
          </h2>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C', padding: 4 }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78716C', marginBottom: '0.5rem' }}>
                {lang === 'es' ? '¿Qué querés trabajar?' : 'What do you want to work on?'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {TOPICS.map(t => (
                  <button key={t.key} onClick={() => setTopic(t.key)} style={chipStyle(topic === t.key)}>
                    {lang === 'es' ? t.es : t.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78716C', marginBottom: '0.5rem' }}>
                {lang === 'es' ? '¿Qué enfoque preferís?' : 'What approach do you prefer?'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {APPROACHES.map(a => (
                  <button key={a.key} onClick={() => setApproach(a.key)} style={chipStyle(approach === a.key)}>
                    {lang === 'es' ? a.es : a.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#78716C', marginBottom: '0.5rem' }}>
                {lang === 'es' ? '¿En qué idioma?' : 'In which language?'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {LANGUAGES.map(l => (
                  <button key={l.key} onClick={() => setLanguage(l.key)} style={chipStyle(language === l.key)}>
                    {lang === 'es' ? l.es : l.en}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={!canSearch || searching}
              style={{
                width: '100%', padding: '0.85rem',
                background: canSearch ? '#6B7D5C' : '#E7E5E4',
                color: canSearch ? '#fff' : '#A8A29E',
                border: 'none', borderRadius: '0.85rem',
                fontSize: '0.9rem', fontWeight: 500,
                cursor: canSearch ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, sans-serif',
                marginTop: '0.25rem',
              }}
            >
              {searching
                ? (lang === 'es' ? 'Buscando...' : 'Searching...')
                : (lang === 'es' ? 'Buscar →' : 'Search →')}
            </button>
          </div>
        )}

        {/* ── RESULTS STEP ── */}
        {step === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#78716C', fontSize: '0.875rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>😔</div>
                {lang === 'es'
                  ? 'No encontramos terapeutas disponibles ahora. Volvé a intentar más tarde.'
                  : 'No therapists available right now. Try again later.'}
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 0.5rem' }}>
                  {lang === 'es'
                    ? `Encontramos ${suggestions.length} terapeuta${suggestions.length !== 1 ? 's' : ''} compatible${suggestions.length !== 1 ? 's' : ''} con tu perfil:`
                    : `We found ${suggestions.length} compatible therapist${suggestions.length !== 1 ? 's' : ''} for you:`}
                </p>
                {suggestions.map(s => (
                  <div key={s.therapistId} style={{
                    padding: '1rem',
                    border: '0.5px solid #E7E5E4',
                    borderRadius: '0.85rem',
                    background: '#FAFAF9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: '#EAF0E6', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 600, color: '#6B7D5C',
                      }}>
                        {s.therapistName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1C1917' }}>
                          {s.therapistName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#6B7D5C', fontWeight: 600 }}>
                          {lang === 'es' ? 'Compatibilidad' : 'Match'}: {s.score}/10
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#78716C', margin: '0 0 0.75rem', lineHeight: 1.5, fontStyle: 'italic' }}>
                      {s.reason}
                    </p>
                    <button
                      onClick={() => handleChoose(s.therapistId, s.therapistName)}
                      disabled={choosing}
                      style={{
                        width: '100%', padding: '0.6rem',
                        background: choosing ? '#A8B5A2' : '#6B7D5C',
                        color: '#fff', border: 'none', borderRadius: '0.65rem',
                        fontSize: '0.82rem', fontWeight: 500,
                        cursor: choosing ? 'not-allowed' : 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {choosing
                        ? (lang === 'es' ? 'Seleccionando...' : 'Selecting...')
                        : (lang === 'es' ? '✓ Elegir este terapeuta' : '✓ Choose this therapist')}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setStep('form')}
                  style={{ background: 'none', border: 'none', color: '#A8A29E', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: '0.25rem' }}
                >
                  ← {lang === 'es' ? 'Volver a buscar' : 'Search again'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <p style={{ fontSize: '0.95rem', color: '#1C1917', lineHeight: 1.6, margin: 0 }}>
              {lang === 'es'
                ? '¡Perfecto! Tu solicitud fue enviada. El equipo de Elevation confirmará la asignación pronto.'
                : 'Perfect! Your request was sent. The Elevation team will confirm the assignment shortly.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
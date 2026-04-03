// frontend/src/pages/UserDashboard.tsx
// HU-061 — User Dashboard unificado con check-in integrado

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const API      = import.meta.env.VITE_BACKEND_URL || ''
const getToken = () => localStorage.getItem('elevation_token') ?? ''

// ── Types ─────────────────────────────────────────────────────────────────────
type Message        = { role: string; text: string }
type MoodLog        = { id: number; date: string; checkin_mood: number | null; checkout_mood: number | null }
type Recommendation = { id: number; category: string; content: string; generatedAt: string }
type UpcomingSession = {
  id: number; scheduledAt: string; duration: number
  meetingUrl: string | null; status: string
  therapistName: string; therapistEmail: string
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😔', 3: '😐', 4: '🙂', 5: '😊',
}

const CHECKOUT_MOODS = [
  { emoji: '😞', value: 1 },
  { emoji: '😔', value: 2 },
  { emoji: '😐', value: 3 },
  { emoji: '🙂', value: 4 },
  { emoji: '😊', value: 5 },
]

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  })
}

export function UserDashboard() {
  const { t, lang, setLang } = useLanguage()
  const navigate              = useNavigate()

  // ── Check-in state ───────────────────────────────────────────────────────
  const [checkedIn,      setCheckedIn]      = useState(false)
  const [todayMood,      setTodayMood]      = useState<number | null>(null)
  const [checkingIn,     setCheckingIn]     = useState(false)

  // ── Chat state ───────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Progress state ───────────────────────────────────────────────────────
  const [moodLogs,      setMoodLogs]      = useState<MoodLog[]>([])
  const [sessionsWeek,  setSessionsWeek]  = useState(0)

  // ── Upcoming session ─────────────────────────────────────────────────────
  const [upcomingSession, setUpcomingSession] = useState<UpcomingSession | null>(null)
  const [therapistId,     setTherapistId]     = useState<number | null>(null)

  // ── Recommendations ──────────────────────────────────────────────────────
  const [recommendations,  setRecommendations]  = useState<Recommendation[]>([])
  const [expandedRec,      setExpandedRec]      = useState<Recommendation | null>(null)
  const [loadingRecs,      setLoadingRecs]       = useState(false)

  // ── Matching modal ───────────────────────────────────────────────────────
  const [showMatching, setShowMatching] = useState(false)

  // ── Checkout modal ───────────────────────────────────────────────────────
  const [showCheckout,   setShowCheckout]   = useState(false)
  const [checkoutMood,   setCheckoutMood]   = useState<number | null>(null)
  const [starRating,     setStarRating]     = useState<number | null>(null)
  const [starHover,      setStarHover]      = useState<number | null>(null)
  const [checkoutSaving, setCheckoutSaving] = useState(false)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }

    // Check if already checked in today
    const alreadyCheckedIn = localStorage.getItem('elevation_checkin_date') === new Date().toDateString()
    setCheckedIn(alreadyCheckedIn)

    // Load data in parallel
    void loadProgress()
    void loadUpcomingSession()
    void loadRecommendations()

    if (alreadyCheckedIn) {
      void loadChatHistory()
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadProgress = async () => {
    try {
      const res = await apiFetch('/api/user/progress')
      if (!res.ok) return
      const data = await res.json()
      setMoodLogs(data.moodLogs ?? [])

      // Sessions this week
      const monday = new Date()
      monday.setDate(monday.getDate() - monday.getDay() + 1)
      monday.setHours(0, 0, 0, 0)
      const thisWeek = (data.moodLogs ?? []).filter((m: MoodLog) =>
        new Date(m.date) >= monday
      ).length
      setSessionsWeek(thisWeek)
    } catch { /* silent */ }
  }

  const loadUpcomingSession = async () => {
    try {
      const res = await apiFetch('/api/sessions/user/upcoming')
      if (!res.ok) return
      const data = await res.json()
      setUpcomingSession(data.session ?? null)

      // Check if user has therapist assigned
      const userRes = await apiFetch('/api/sessions/user/my-therapist')
      if (userRes.ok) {
        const userData = await userRes.json()
        setTherapistId(userData.therapist?.id ?? null)
      }
    } catch { /* silent */ }
  }

  const loadRecommendations = async () => {
    try {
      const res = await apiFetch('/api/recommendations')
      if (!res.ok) return
      const data = await res.json()
      setRecommendations(data.slice(0, 4))
    } catch { /* silent */ }
  }

  const loadChatHistory = async () => {
    try {
      const res = await apiFetch('/api/messages')
      if (!res.ok) return
      const hist = await res.json()
      const welcome = { role: 'bot', text: t('chat_welcome') }
      setMessages(hist.length > 0 ? [welcome, ...hist] : [welcome])
    } catch { /* silent */ }
  }

  // ── Check-in handler ──────────────────────────────────────────────────────
  const handleCheckin = async (mood: number) => {
    setCheckingIn(true)
    try {
      const res = await apiFetch('/api/mood/checkin', {
        method: 'POST',
        body: JSON.stringify({ mood }),
      })
      if (!res.ok) return
      setTodayMood(mood)
      setCheckedIn(true)
      localStorage.setItem('elevation_checkin_date', new Date().toDateString())
      // Load chat history now that check-in is done
      void loadChatHistory()
    } catch { /* silent */ }
    finally { setCheckingIn(false) }
  }

  // ── Chat handler ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || sending || !checkedIn) return
    const userText = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setSending(true)
    try {
      const res  = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userText }),
      })
      const data = await res.json() as { reply: string }
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: t('chat_error') }])
    }
    setSending(false)
  }

  // ── Checkout handler ──────────────────────────────────────────────────────
  const handleCheckout = async (mood: number) => {
    setCheckoutSaving(true)
    try {
      await apiFetch('/api/mood/checkout', { method: 'POST', body: JSON.stringify({ mood }) })
      if (starRating !== null) {
        await apiFetch('/api/rating', { method: 'POST', body: JSON.stringify({ rating: starRating }) })
      }
    } catch { /* silent */ }
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    localStorage.removeItem('elevation_checkin_date')
    navigate('/login')
  }

  // ── Generate recommendations ──────────────────────────────────────────────
  const handleGenerateRecs = async () => {
    setLoadingRecs(true)
    try {
      const res = await apiFetch('/api/recommendations/generate', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setRecommendations(data.slice(0, 4))
    } catch { /* silent */ }
    finally { setLoadingRecs(false) }
  }

  // ── Mood trend for last 7 days ────────────────────────────────────────────
  const getMoodTrend = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toISOString().split('T')[0]
      const log = moodLogs.find(m => m.date === dateStr)
      const moods = [log?.checkin_mood, log?.checkout_mood].filter(Boolean) as number[]
      const avg   = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null
      return { dateStr, avg }
    })
  }

  const trendColor = (avg: number | null) => {
    if (avg === null)  return '#E7E5E4'
    if (avg >= 3.5)    return '#6B7D5C'
    if (avg >= 2.5)    return '#F59E0B'
    return '#EF4444'
  }

  const formatSession = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
      weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '1rem',
    border: '0.5px solid #E7E5E4',
    boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
    padding: '1.25rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'Inter, sans-serif' }}>

      {/* ── HEADER ── */}
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        background: 'rgba(249,249,247,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(231,229,228,0.5)',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 1100, width: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A8A29E', textTransform: 'uppercase' }}>
            {t('logo')}
          </span>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {(['es', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid #D6D2C4', background: lang === l ? '#6B7D5C' : 'transparent', color: lang === l ? '#FAF8F4' : '#A8A29E', cursor: 'pointer' }}>
                {l.toUpperCase()}
              </button>
            ))}
            <button onClick={() => navigate('/app/progress')}
              style={{ fontSize: '0.78rem', color: '#78716C', background: 'none', border: 'none', cursor: 'pointer' }}>
              {lang === 'es' ? 'Mi progreso' : 'My progress'}
            </button>
            <button onClick={() => navigate('/app/my-therapist')}
              style={{ fontSize: '0.78rem', color: '#78716C', background: 'none', border: 'none', cursor: 'pointer' }}>
              {lang === 'es' ? 'Mi terapeuta' : 'My therapist'}
            </button>
            <button onClick={() => setShowCheckout(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '76px 1.5rem 2rem', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── COLUMNA IZQUIERDA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Widget 1 — Estado emocional */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              ♡ {lang === 'es' ? 'Estado emocional' : 'Emotional state'}
            </div>
            {checkedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ fontSize: '2rem' }}>{MOOD_EMOJI[todayMood ?? 3]}</div>
                <div style={{ fontSize: '0.78rem', color: '#6B7D5C' }}>
                  {lang === 'es' ? '✓ Ya registraste tu estado de hoy' : '✓ Check-in done for today'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#78716C', margin: 0 }}>
                  {lang === 'es' ? '¿Cómo llegás hoy?' : 'How are you arriving today?'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {CHECKOUT_MOODS.map(m => (
                    <button key={m.value} onClick={() => { if (!checkingIn) void handleCheckin(m.value) }}
                      disabled={checkingIn}
                      style={{
                        width: 44, height: 44, borderRadius: '50%', fontSize: '1.3rem',
                        border: '1px solid #E7E5E4', background: 'white',
                        cursor: checkingIn ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#6B7D5C'; e.currentTarget.style.background = '#EAF0E6' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E5E4'; e.currentTarget.style.background = 'white' }}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Widget 2 — Tu progreso */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              ↗ {lang === 'es' ? 'Tu progreso' : 'Your progress'}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1C1917' }}>{sessionsWeek}</div>
              <div style={{ fontSize: '0.75rem', color: '#78716C' }}>
                {lang === 'es' ? 'sesiones esta semana' : 'sessions this week'}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#78716C', marginBottom: '0.4rem' }}>
              {lang === 'es' ? 'Tendencia emocional' : 'Emotional trend'}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {getMoodTrend().map(({ dateStr, avg }) => (
                <div key={dateStr} title={dateStr}
                  style={{ flex: 1, height: 28, borderRadius: 4, background: trendColor(avg) }} />
              ))}
            </div>
          </div>

          {/* Widget 3 — Próxima sesión */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              📅 {lang === 'es' ? 'Próxima sesión' : 'Upcoming session'}
            </div>
            {upcomingSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1C1917' }}>
                  {lang === 'es' ? 'Con' : 'With'} {upcomingSession.therapistName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78716C' }}>
                  {formatSession(upcomingSession.scheduledAt)} — {upcomingSession.duration} min
                </div>
                <button disabled title={lang === 'es' ? 'Próximamente' : 'Coming soon'}
                  style={{ marginTop: '0.5rem', padding: '0.5rem 0.85rem', background: '#E7E5E4', color: '#A8A29E', border: 'none', borderRadius: '0.65rem', fontSize: '0.78rem', cursor: 'not-allowed' }}>
                  {lang === 'es' ? 'Entrar a videollamada' : 'Join videocall'}
                </button>
              </div>
            ) : therapistId ? (
              <p style={{ fontSize: '0.82rem', color: '#78716C', margin: 0 }}>
                {lang === 'es' ? 'Tu terapeuta aún no ha agendado una sesión.' : 'Your therapist has not scheduled a session yet.'}
              </p>
            ) : (
              <button onClick={() => setShowMatching(true)}
                style={{ padding: '0.5rem 0.85rem', background: '#6B7D5C', color: '#fff', border: 'none', borderRadius: '0.65rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                🤝 {lang === 'es' ? 'Buscar mi terapeuta' : 'Find my therapist'}
              </button>
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA — CHAT ── */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', position: 'sticky', top: 76 }}>

          {!checkedIn ? (
            // Chat bloqueado
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem' }}>💬</div>
              <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '1rem', color: '#A8A29E', textAlign: 'center', margin: 0 }}>
                {lang === 'es'
                  ? 'Seleccioná cómo llegás hoy para comenzar tu conversación.'
                  : 'Select how you\'re arriving today to start your conversation.'}
              </p>
            </div>
          ) : (
            <>
              {/* Mensajes */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                {messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '80%', background: '#F5F3EF', borderRadius: '1.25rem 1.25rem 0.25rem 1.25rem', padding: '0.85rem 1rem', fontSize: '0.95rem', color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div style={{ borderLeft: '2px solid #0d9488', paddingLeft: '1rem' }}>
                        <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#0d9488', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{t('logo')} ·</span>
                        <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.95rem', color: '#1C1917', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div style={{ borderLeft: '2px solid #0d9488', paddingLeft: '1rem' }}>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#0d9488', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{t('logo')} ·</span>
                    <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.9rem', color: '#A8A29E', margin: 0 }}>{t('chat_thinking')}</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '0.5px solid #E7E5E4', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
                  placeholder={t('chat_placeholder')} rows={2}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.9rem', color: '#1C1917', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }} />
                {input.trim() && (
                  <button onClick={() => void handleSend()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', padding: 4, display: 'flex', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SECCIÓN RECOMENDACIONES ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: 0 }}>
            ✨ {lang === 'es' ? 'Recomendaciones para vos' : 'Recommendations for you'}
          </h2>
          <button onClick={() => void handleGenerateRecs()} disabled={loadingRecs}
            style={{ fontSize: '0.78rem', color: '#6B7D5C', background: 'none', border: '0.5px solid #6B7D5C', borderRadius: '0.65rem', padding: '0.35rem 0.75rem', cursor: loadingRecs ? 'not-allowed' : 'pointer' }}>
            {loadingRecs ? '...' : lang === 'es' ? 'Generar nuevas' : 'Generate new'}
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#A8A29E', fontSize: '0.875rem' }}>
            {lang === 'es' ? 'Aún no tenés recomendaciones. ¡Generá las primeras!' : 'No recommendations yet. Generate your first ones!'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {recommendations.map(rec => (
              <div key={rec.id} style={{ ...cardStyle, cursor: 'pointer' }}
                onClick={() => setExpandedRec(rec)}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', marginBottom: '0.35rem' }}>
                  {t(`rec_category_${rec.category}`)}
                </div>
                <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#1C1917', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
                  {rec.content.length > 100 ? rec.content.slice(0, 100) + '...' : rec.content}
                </p>
                <span style={{ fontSize: '0.75rem', color: '#6B7D5C' }}>
                  {lang === 'es' ? 'Explorar →' : 'Explore →'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL RECOMENDACIÓN ── */}
      {expandedRec && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setExpandedRec(null)}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(26,28,27,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', marginBottom: '0.5rem' }}>
              {t(`rec_category_${expandedRec.category}`)}
            </div>
            <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '1rem', color: '#1C1917', lineHeight: 1.75, margin: '0 0 1.5rem' }}>
              {expandedRec.content}
            </p>
            <button onClick={() => setExpandedRec(null)}
              style={{ padding: '0.5rem 1.25rem', background: '#6B7D5C', color: '#fff', border: 'none', borderRadius: '0.65rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL CHECKOUT ── */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,28,27,0.15)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FAF8F4', borderRadius: '1.25rem', padding: '2.5rem 2rem', maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', border: '0.5px solid #E7E5E4' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', color: '#A8A29E', margin: 0, textTransform: 'uppercase' }}>CHECK-OUT</p>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 400, color: '#1C1917', margin: 0, textAlign: 'center' }}>
              {lang === 'es' ? '¿Cómo te vas?' : 'How are you leaving?'}
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {CHECKOUT_MOODS.map(m => (
                <button key={m.value} onClick={() => setCheckoutMood(m.value)}
                  style={{ width: 52, height: 52, borderRadius: '50%', fontSize: '1.5rem', border: checkoutMood === m.value ? '2px solid #0d9488' : '1px solid #E7E5E4', background: checkoutMood === m.value ? '#F0FDFA' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.emoji}
                </button>
              ))}
            </div>
            {checkoutMood !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#78716C', margin: 0 }}>
                  {lang === 'es' ? '¿Cómo fue la conversación?' : 'How was the conversation?'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => setStarRating(star)}
                      onMouseEnter={() => setStarHover(star)} onMouseLeave={() => setStarHover(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: star <= (starHover ?? starRating ?? 0) ? '#6B7D5C' : '#D6D2C4' }}>★</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button onClick={() => { if (checkoutMood !== null) void handleCheckout(checkoutMood) }}
                disabled={checkoutMood === null || checkoutSaving}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', border: 'none', background: checkoutMood !== null ? 'linear-gradient(135deg,#00685f,#008378)' : '#E7E5E4', color: checkoutMood !== null ? 'white' : '#A8A29E', fontSize: '0.875rem', fontWeight: 500, cursor: checkoutMood !== null ? 'pointer' : 'not-allowed' }}>
                {checkoutSaving ? '...' : lang === 'es' ? 'Cerrar sesión' : 'Sign out'}
              </button>
              <button onClick={() => { localStorage.removeItem('elevation_token'); localStorage.removeItem('elevation_role'); localStorage.removeItem('elevation_name'); localStorage.removeItem('elevation_checkin_date'); navigate('/login') }}
                style={{ padding: '0.85rem 1rem', borderRadius: '0.85rem', border: '0.5px solid #D6D2C4', background: 'transparent', color: '#78716C', fontSize: '0.875rem', cursor: 'pointer' }}>
                {lang === 'es' ? 'Saltar' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
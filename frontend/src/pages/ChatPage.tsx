import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

type Message     = { role: string; text: string }
type PromptData  = { version: number; content: string; approved_by?: string }
type VersionData = { id: number; version: number; status: string; proposed_by: string }
type LandingContent = Record<string, string>

async function apiFetch(path: string, token: string, options?: RequestInit) {
  return fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
}

const LANDING_KEYS = [
  { key: 'hero_title',         label: 'Título hero' },
  { key: 'hero_subtitle',      label: 'Subtítulo hero' },
  { key: 'cta_primary',        label: 'CTA principal' },
  { key: 'cta_final_title',    label: 'Título CTA final' },
  { key: 'cta_final_subtitle', label: 'Subtítulo CTA final' },
]

const CHECKOUT_MOODS = [
  { emoji: '😞', value: 0 },
  { emoji: '😔', value: 1 },
  { emoji: '😐', value: 2 },
  { emoji: '🙂', value: 3 },
  { emoji: '😊', value: 4 },
]

export function ChatPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const role = localStorage.getItem('elevation_role') ?? 'user'
  const getToken = () => localStorage.getItem('elevation_token') ?? ''

  // Chat
  const [messages,        setMessages]        = useState<Message[]>([])
  const [input,           setInput]           = useState('')
  const [sending,         setSending]         = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Admin panel
  const [adminOpen,       setAdminOpen]       = useState(false)
  const [adminTab,        setAdminTab]        = useState<'prompts' | 'landing'>('prompts')
  const [promptText,      setPromptText]      = useState('')
  const [promptSaving,    setPromptSaving]    = useState(false)
  const [promptMsg,       setPromptMsg]       = useState('')
  const [promptMode,      setPromptMode]      = useState<'view' | 'edit'>('view')
  const [activePrompt,    setActivePrompt]    = useState<PromptData | null>(null)
  const [pendingVersions, setPendingVersions] = useState<VersionData[]>([])
  const [allVersions,     setAllVersions]     = useState<VersionData[]>([])
  const [rejectNote,      setRejectNote]      = useState('')
  const [rejectingId,     setRejectingId]     = useState<number | null>(null)

  // HU-039 — Contenido landing
  const [landingTab,     setLandingTab]     = useState<'es' | 'en'>('es')
  const [landingContent, setLandingContent] = useState<{ es: LandingContent; en: LandingContent }>({ es: {}, en: {} })
  const [landingEdits,   setLandingEdits]   = useState<{ es: LandingContent; en: LandingContent }>({ es: {}, en: {} })
  const [landingSaving,  setLandingSaving]  = useState<string | null>(null)
  const [landingMsg,     setLandingMsg]     = useState<{ key: string; msg: string; ok: boolean } | null>(null)

  // HU-021 — Check-out de ánimo
  const [showCheckout,   setShowCheckout]   = useState(false)
  const [checkoutMood,   setCheckoutMood]   = useState<number | null>(null)
  const [checkoutSaving, setCheckoutSaving] = useState(false)

  // HU-051 — Wellness recommendations
  const [recommendations, setRecommendations] = useState<{id: number; category: string; content: string; generatedAt: string}[]>([])
  const [loadingRecs,     setLoadingRecs]     = useState(false)
  const [recsError,       setRecsError]       = useState('')
  const [showRecs,        setShowRecs]        = useState(false)

  // HU-022 — Calificación con estrellas
  const [starRating,     setStarRating]     = useState<number | null>(null)
  const [starHover,      setStarHover]      = useState<number | null>(null)

  const loadActivePrompt = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/prompt/elevation_system_prompt', getToken())
      if (res.ok) {
        const data = await res.json() as PromptData
        setActivePrompt(data)
        setPromptText(data.content ?? '')
      }
    } catch { /* silencioso */ }
  }, [])

  const loadVersions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/superadmin/prompt/elevation_system_prompt/versions', getToken())
      if (res.ok) {
        const data = await res.json() as VersionData[]
        setAllVersions(data)
        setPendingVersions(data.filter(v => v.status === 'pending_review'))
      }
    } catch { /* silencioso */ }
  }, [])

  const loadLandingContent = useCallback(async () => {
    try {
      const [resEs, resEn] = await Promise.all([
        fetch(`${BACKEND}/api/landing-content?lang=es`),
        fetch(`${BACKEND}/api/landing-content?lang=en`),
      ])
      const es = resEs.ok ? await resEs.json() as LandingContent : {}
      const en = resEn.ok ? await resEn.json() as LandingContent : {}
      setLandingContent({ es, en })
      setLandingEdits({ es: { ...es }, en: { ...en } })
    } catch { /* silencioso */ }
  }, [])

  // HU-051 — Load existing recommendations on mount
  const loadExistingRecs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/recommendations', getToken())
      if (!res.ok) return
      const data = await res.json()
      if (data.length > 0) { setRecommendations(data); setShowRecs(true) }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }
    setMessages([{ role: 'bot', text: t('chat_welcome') }])
    void apiFetch('/api/messages', token).then(async res => {
      if (res.ok) {
        const hist = await res.json() as Message[]
        if (hist.length > 0) setMessages(prev => [prev[0], ...hist])
      }
    })
    // HU-051 — Load existing recommendations
    void loadExistingRecs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleLogout = () => {
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    localStorage.removeItem('elevation_checkin_date')
    navigate('/login')
  }

  // HU-021 + HU-022 — Guardar checkout + rating y cerrar sesión
  const handleCheckout = async (mood: number) => {
    setCheckoutSaving(true)
    try {
      await apiFetch('/api/mood/checkout', getToken(), {
        method: 'POST',
        body: JSON.stringify({ mood }),
      })
    } catch { /* silencioso */ }
    if (starRating !== null) {
      try {
        await apiFetch('/api/rating', getToken(), {
          method: 'POST',
          body: JSON.stringify({ rating: starRating }),
        })
      } catch { /* silencioso */ }
    }
    setCheckoutSaving(false)
    setShowCheckout(false)
    setCheckoutMood(null)
    setStarRating(null)
    handleLogout()
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const userText = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setSending(true)
    try {
      const res  = await apiFetch('/api/chat', getToken(), {
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

  // HU-051 — Generate recommendations
  const handleGenerateRecs = async () => {
    setLoadingRecs(true)
    setRecsError('')
    setShowRecs(true)
    try {
      const res = await apiFetch('/api/recommendations/generate', getToken(), { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRecommendations(data)
    } catch {
      setRecsError(t('rec_error'))
    } finally {
      setLoadingRecs(false)
    }
  }

  const openAdmin = () => {
    void loadActivePrompt()
    if (role === 'superadmin') {
      void loadVersions()
      void loadLandingContent()
    }
    setAdminOpen(true)
  }

  const proposePrompt = async () => {
    if (!promptText.trim()) return
    setPromptSaving(true)
    try {
      const res  = await apiFetch('/api/admin/prompt/propose', getToken(), {
        method: 'POST',
        body: JSON.stringify({ key: 'elevation_system_prompt', content: promptText }),
      })
      const data = await res.json() as { message?: string }
      setPromptMsg(data.message ?? t('admin_send'))
      setPromptMode('view')
      void loadActivePrompt()
    } catch { setPromptMsg('Error al enviar.') }
    setPromptSaving(false)
    setTimeout(() => setPromptMsg(''), 4000)
  }

  const approveVersion = async (id: number) => {
    try {
      await apiFetch(`/api/superadmin/prompt/${id}/approve`, getToken(), { method: 'POST' })
      setPromptMsg(`✓ ${t('admin_approve')}`)
      void loadActivePrompt()
      void loadVersions()
    } catch { setPromptMsg('Error al aprobar.') }
    setTimeout(() => setPromptMsg(''), 4000)
  }

  const rejectVersion = async (id: number) => {
    try {
      await apiFetch(`/api/superadmin/prompt/${id}/reject`, getToken(), {
        method: 'POST',
        body: JSON.stringify({ note: rejectNote }),
      })
      setPromptMsg('Versión rechazada.')
      setRejectingId(null)
      setRejectNote('')
      void loadVersions()
    } catch { setPromptMsg('Error al rechazar.') }
    setTimeout(() => setPromptMsg(''), 4000)
  }

  const rollbackVersion = async (id: number) => {
    if (!confirm('¿Seguro que querés activar esta versión anterior?')) return
    try {
      await apiFetch(`/api/superadmin/prompt/${id}/rollback`, getToken(), { method: 'POST' })
      setPromptMsg('✓ Rollback exitoso.')
      void loadActivePrompt()
      void loadVersions()
    } catch { setPromptMsg('Error en rollback.') }
    setTimeout(() => setPromptMsg(''), 4000)
  }

  const saveLandingField = async (key: string, langCode: 'es' | 'en') => {
    const value = landingEdits[langCode][key]
    if (!value?.trim()) return
    setLandingSaving(`${langCode}-${key}`)
    try {
      const res = await apiFetch('/api/landing-content', getToken(), {
        method: 'PUT',
        body: JSON.stringify({ key, lang: langCode, value }),
      })
      if (res.ok) {
        setLandingContent(prev => ({ ...prev, [langCode]: { ...prev[langCode], [key]: value } }))
        setLandingMsg({ key: `${langCode}-${key}`, msg: '✓ Guardado', ok: true })
      } else {
        setLandingMsg({ key: `${langCode}-${key}`, msg: '✗ Error al guardar', ok: false })
      }
    } catch {
      setLandingMsg({ key: `${langCode}-${key}`, msg: '✗ Error de conexión', ok: false })
    }
    setLandingSaving(null)
    setTimeout(() => setLandingMsg(null), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9f9f7', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(249,249,247,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(231,229,228,0.5)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 680, width: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 24 }} />
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A8A29E', textTransform: 'uppercase' }}>{t('logo')}</span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {(['es', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid #D6D2C4', background: lang === l ? '#6B7D5C' : 'transparent', color: lang === l ? '#FAF8F4' : '#A8A29E', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {l.toUpperCase()}
              </button>
            ))}
            {['admin', 'superadmin'].includes(role) && (
              <button onClick={openAdmin} title={t('admin_title')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex', padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </button>
            )}
            {/* HU-051 — Recommendations toggle */}
            <button
              onClick={() => setShowRecs(!showRecs)}
              title={t('rec_title')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: showRecs ? '#6B7D5C' : '#A8A29E', display: 'flex', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </button>
            <button onClick={() => setShowCheckout(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      <main style={{ maxWidth: 680, width: '100%', margin: '0 auto', paddingTop: 80, paddingBottom: 120, paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '80%', background: 'white', borderRadius: '1.25rem 1.25rem 0.25rem 1.25rem', padding: '1rem 1.25rem', boxShadow: '0 2px 12px rgba(26,28,27,0.06)', color: '#1C1917', fontSize: '1rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div style={{ borderLeft: '2px solid #0d9488', paddingLeft: '1.25rem' }}>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#0d9488', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{t('logo')} ·</span>
                  <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '1.05rem', color: '#1C1917', lineHeight: 1.85, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div style={{ borderLeft: '2px solid #0d9488', paddingLeft: '1.25rem' }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#0d9488', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{t('logo')} ·</span>
              <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.95rem', color: '#A8A29E', margin: 0 }}>{t('chat_thinking')}</p>
            </div>
          )}
            {/* HU-052 — Progress link */}
            <button
              onClick={() => navigate('/app/progress')}
              title={lang === 'es' ? 'Mi progreso' : 'My progress'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', display: 'flex', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </button>
          {/* HU-051 — Wellness Recommendations */}
          {showRecs && (
            <div style={{ borderLeft: '2px solid #6B7D5C', paddingLeft: '1.25rem' }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: '#6B7D5C', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                {t('rec_title')}
              </span>
              <p style={{ fontSize: '0.78rem', color: '#78716C', margin: '0 0 1rem', fontFamily: 'Inter, sans-serif' }}>
                {t('rec_subtitle')}
              </p>
              {loadingRecs && (
                <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.95rem', color: '#A8A29E' }}>
                  {t('rec_loading')}
                </p>
              )}
              {recsError && (
                <p style={{ fontSize: '0.875rem', color: '#DC2626' }}>{recsError}</p>
              )}
              {!loadingRecs && recommendations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {recommendations.slice(0, 3).map(rec => (
                    <div key={rec.id} style={{
                      background: '#fff', borderRadius: '0.85rem',
                      border: '0.5px solid #E7E5E4', padding: '0.85rem 1rem',
                      boxShadow: '0 2px 8px rgba(26,28,27,0.04)',
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7D5C', marginBottom: '0.35rem', fontFamily: 'Inter, sans-serif' }}>
                        {t(`rec_category_${rec.category}`)}
                      </div>
                      <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.9rem', color: '#1C1917', lineHeight: 1.65, margin: 0 }}>
                        {rec.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { void handleGenerateRecs() }}
                disabled={loadingRecs}
                style={{
                  fontSize: '0.78rem', color: '#6B7D5C', background: 'none',
                  border: '0.5px solid #6B7D5C', borderRadius: '0.65rem',
                  padding: '0.4rem 0.85rem', cursor: loadingRecs ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {loadingRecs ? t('rec_loading') : recommendations.length > 0 ? t('rec_regenerate') : t('rec_generate')}
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 40, background: 'rgba(249,249,247,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(231,229,228,0.5)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={t('chat_placeholder')} rows={2}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '1rem', color: '#1C1917', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }} />
          {input.trim() && (
            <button onClick={() => { void handleSend() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', padding: 4, display: 'flex', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* HU-021 + HU-022 — Modal check-out + estrellas */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,28,27,0.15)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FAF8F4', borderRadius: '1.25rem', padding: '2.5rem 2rem', maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', border: '0.5px solid #E7E5E4' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', color: '#A8A29E', margin: 0, textTransform: 'uppercase' }}>CHECK-OUT</p>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 400, color: '#1C1917', margin: 0, textAlign: 'center' }}>
              {lang === 'es' ? '¿Cómo te vas?' : 'How are you leaving?'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#78716C', margin: 0, textAlign: 'center' }}>
              {lang === 'es' ? 'Tomá un momento antes de cerrar.' : 'Take a moment before closing.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {CHECKOUT_MOODS.map(m => (
                <button key={m.value} onClick={() => setCheckoutMood(m.value)}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', fontSize: '1.5rem',
                    border: checkoutMood === m.value ? '2px solid #0d9488' : '1px solid #E7E5E4',
                    background: checkoutMood === m.value ? '#F0FDFA' : 'white',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                  {m.emoji}
                </button>
              ))}
            </div>
            {checkoutMood !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <p style={{ fontSize: '0.8rem', color: '#78716C', margin: 0 }}>
                  {lang === 'es' ? '¿Cómo fue la conversación?' : 'How was the conversation?'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star}
                      onClick={() => setStarRating(star)}
                      onMouseEnter={() => setStarHover(star)}
                      onMouseLeave={() => setStarHover(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: 28, lineHeight: 1, transition: 'transform 0.1s', transform: starHover === star ? 'scale(1.2)' : 'scale(1)' }}>
                      <span style={{ color: star <= (starHover ?? starRating ?? 0) ? '#6B7D5C' : '#D6D2C4' }}>★</span>
                    </button>
                  ))}
                </div>
                {starRating && (
                  <p style={{ fontSize: '0.75rem', color: '#A8A29E', margin: 0 }}>
                    {['', '😞 Muy mala', '😐 Regular', '🙂 Buena', '😊 Muy buena', '✨ Excelente'][starRating]}
                  </p>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={() => { if (checkoutMood !== null) void handleCheckout(checkoutMood) }}
                disabled={checkoutMood === null || checkoutSaving}
                style={{
                  flex: 1, padding: '0.85rem', borderRadius: '0.85rem', border: 'none',
                  background: checkoutMood !== null ? 'linear-gradient(135deg,#00685f,#008378)' : '#E7E5E4',
                  color: checkoutMood !== null ? 'white' : '#A8A29E',
                  fontSize: '0.875rem', fontWeight: 500,
                  cursor: checkoutMood !== null ? 'pointer' : 'not-allowed',
                  fontFamily: 'Inter, sans-serif',
                }}>
                {checkoutSaving ? '...' : lang === 'es' ? 'Cerrar sesión' : 'Sign out'}
              </button>
              <button onClick={handleLogout}
                style={{ padding: '0.85rem 1rem', borderRadius: '0.85rem', border: '0.5px solid #D6D2C4', background: 'transparent', color: '#78716C', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {lang === 'es' ? 'Saltar' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel Admin */}
      {adminOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setAdminOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,28,27,0.1)', backdropFilter: 'blur(4px)' }} />
          <aside style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', background: '#F5F3EF', borderLeft: '1px solid #E7E5E4', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '0 0 60px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid #E7E5E4' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1C1917', margin: 0 }}>{t('admin_title')}</h2>
              <button onClick={() => setAdminOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {role === 'superadmin' && (
              <div style={{ display: 'flex', borderBottom: '1px solid #E7E5E4', background: '#FAF8F4' }}>
                {([['prompts', 'Prompts'], ['landing', 'Contenido Landing']] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setAdminTab(tab)}
                    style={{ flex: 1, padding: '0.75rem', fontSize: 12, fontWeight: adminTab === tab ? 600 : 400, color: adminTab === tab ? '#1C1917' : '#78716C', background: 'none', border: 'none', borderBottom: adminTab === tab ? '2px solid #6B7D5C' : '2px solid transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              {(adminTab === 'prompts' || role !== 'superadmin') && (
                <>
                  <div>
                    <h3 style={{ fontFamily: 'Playfair Display, serif', color: '#00685f', fontSize: '1.4rem', fontWeight: 400, marginBottom: '0.5rem' }}>{t('admin_brain')}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '0.2rem 0.75rem', borderRadius: 9999, background: '#F0FDFA', color: '#065f46', fontSize: 11, fontWeight: 500 }}>
                        {activePrompt ? `v${activePrompt.version}` : '—'} · {t('admin_active')}
                      </span>
                      {activePrompt?.approved_by && <span style={{ fontSize: 11, color: '#A8A29E' }}>{t('admin_approved_by')} {activePrompt.approved_by}</span>}
                      {role === 'superadmin' && pendingVersions.length > 0 && (
                        <span style={{ padding: '0.2rem 0.75rem', borderRadius: 9999, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600 }}>
                          ⏳ {pendingVersions.length} {pendingVersions.length > 1 ? t('admin_pending_plural') : t('admin_pending')}
                        </span>
                      )}
                    </div>
                  </div>
                  {promptMsg && <p style={{ fontSize: '0.8rem', color: '#0d9488', padding: '0.5rem 0.75rem', background: '#F0FDFA', borderRadius: '0.5rem', margin: 0 }}>{promptMsg}</p>}
                  {['admin', 'superadmin'].includes(role) && (
                    <>
                      <textarea value={promptText} onChange={promptMode === 'edit' ? e => setPromptText(e.target.value) : undefined} readOnly={promptMode === 'view'}
                        style={{ width: '100%', height: 260, padding: '1.25rem', background: promptMode === 'edit' ? 'white' : '#FAFAFA', border: `1px solid ${promptMode === 'edit' ? '#0d9488' : '#E7E5E4'}`, borderRadius: '0.75rem', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.7, color: promptMode === 'edit' ? '#1C1917' : '#78716C', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                      {promptMode === 'view' ? (
                        <button onClick={() => setPromptMode('edit')} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #0d9488', background: 'transparent', color: '#0d9488', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>{t('admin_propose')}</button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button onClick={() => { void proposePrompt() }} disabled={promptSaving || !promptText.trim()}
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: promptSaving || !promptText.trim() ? '#E7E5E4' : 'linear-gradient(135deg,#00685f,#008378)', color: promptSaving || !promptText.trim() ? '#A8A29E' : 'white', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
                            {promptSaving ? t('admin_sending') : t('admin_send')}
                          </button>
                          <button onClick={() => { setPromptMode('view'); void loadActivePrompt() }} style={{ background: 'none', border: 'none', color: '#78716C', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem 1rem' }}>{t('admin_cancel')}</button>
                        </div>
                      )}
                    </>
                  )}
                  {role === 'superadmin' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1C1917', margin: 0 }}>{t('admin_versions_pending')}</h4>
                      {pendingVersions.length === 0
                        ? <p style={{ fontSize: '0.8rem', color: '#A8A29E', margin: 0 }}>{t('admin_no_pending')}</p>
                        : pendingVersions.map(v => (
                          <div key={v.id} style={{ background: 'white', border: '1px solid #E7E5E4', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1C1917' }}>v{v.version}</span>
                              <span style={{ fontSize: 11, color: '#A8A29E' }}>{t('admin_proposed_by')} {v.proposed_by}</span>
                            </div>
                            {rejectingId === v.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder={t('admin_reject_note')} style={{ padding: '0.5rem 0.75rem', border: '1px solid #E7E5E4', borderRadius: '0.5rem', fontSize: '0.8rem', outline: 'none' }} />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button onClick={() => { void rejectVersion(v.id) }} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#DC2626', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>{t('admin_confirm_reject')}</button>
                                  <button onClick={() => { setRejectingId(null); setRejectNote('') }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E7E5E4', background: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>{t('admin_cancel')}</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => { void approveVersion(v.id) }} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: '#059669', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>{t('admin_approve')}</button>
                                <button onClick={() => setRejectingId(v.id)} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #DC2626', background: 'none', color: '#DC2626', fontSize: '0.8rem', cursor: 'pointer' }}>{t('admin_reject')}</button>
                              </div>
                            )}
                          </div>
                        ))
                      }
                      {allVersions.length > 0 && (
                        <>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1C1917', margin: '0.5rem 0 0' }}>{t('admin_versions_history')}</h4>
                          {allVersions.filter(v => v.status !== 'pending_review').map(v => (
                            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'white', border: '1px solid #E7E5E4', borderRadius: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1C1917' }}>v{v.version}</span>
                                <span style={{ fontSize: 11, color: v.status === 'active' ? '#059669' : '#A8A29E' }}>
                                  {v.status === 'active' ? t('admin_status_active') : v.status === 'approved' ? t('admin_status_approved') : v.status === 'rejected' ? t('admin_status_rejected') : t('admin_status_archived')}
                                </span>
                              </div>
                              {v.status !== 'active' && (
                                <button onClick={() => { void rollbackVersion(v.id) }} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E7E5E4', background: 'none', fontSize: 11, color: '#78716C', cursor: 'pointer' }}>{t('admin_rollback')}</button>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              {adminTab === 'landing' && role === 'superadmin' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['es', 'en'] as const).map(l => (
                      <button key={l} onClick={() => setLandingTab(l)}
                        style={{ padding: '0.4rem 1rem', borderRadius: '0.5rem', border: '0.5px solid #D6D2C4', background: landingTab === l ? '#6B7D5C' : 'transparent', color: landingTab === l ? '#FAF8F4' : '#78716C', fontSize: 12, fontWeight: landingTab === l ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {LANDING_KEYS.map(({ key, label }) => {
                    const fieldId = `${landingTab}-${key}`
                    const isSaving = landingSaving === fieldId
                    const feedback = landingMsg?.key === fieldId ? landingMsg : null
                    const hasChanged = landingEdits[landingTab][key] !== landingContent[landingTab][key]
                    return (
                      <div key={fieldId} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: 11, color: '#7A7A7A', letterSpacing: '0.05em' }}>{label}</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <textarea
                            value={landingEdits[landingTab][key] ?? ''}
                            onChange={e => setLandingEdits(prev => ({ ...prev, [landingTab]: { ...prev[landingTab], [key]: e.target.value } }))}
                            rows={2}
                            style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: `0.5px solid ${hasChanged ? '#6B7D5C' : '#D6D2C4'}`, background: '#FAF8F4', fontSize: 13, color: '#1C1917', resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }} />
                          <button onClick={() => { void saveLandingField(key, landingTab) }} disabled={isSaving || !hasChanged}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: isSaving || !hasChanged ? '#E7E5E4' : '#6B7D5C', color: isSaving || !hasChanged ? '#A8A29E' : '#FAF8F4', fontSize: 11, cursor: isSaving || !hasChanged ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {isSaving ? '...' : 'Guardar'}
                          </button>
                        </div>
                        {feedback && <span style={{ fontSize: 11, color: feedback.ok ? '#059669' : '#DC2626' }}>{feedback.msg}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
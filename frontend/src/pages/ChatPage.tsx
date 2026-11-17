import { memo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChatBar, ThreadNotices } from '../space/ChatBar'
import { ChatMenu } from '../space/ChatMenu'
import { Button, Dialog, ScaleField } from '../cartografia'
import { readEnterSends, writeEnterSends } from '../space/chatKeys'
import { CompassBanner } from '../space/CompassBanner'
import { usePersonalChat } from '../space/usePersonalChat'
import { ChatContext, ChatInput, ChatStatus, TruncatedNotice } from '../space/ChatControls'
import { ChatLimitsNotice } from '../space/ChatLimitsNotice'
import '../space/space.css' // ES-153: antes lo traía el menú de Mi espacio
import { useLanguage } from '../i18n/useLanguage'
import { copy } from '../space/copy'
import { clearPending } from '../space/pending'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

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

const CHECKOUT_MOODS = [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]

// ES-199: una burbuja de la conversación. Memoizada: solo se repinta si cambia su texto, su rol o las etiquetas (no al teclear). `children` lleva el aviso de la última respuesta.
const ChatBubble = memo(function ChatBubble({ role, text, you, logo, ai, children }: { role: 'user' | 'bot'; text: string; you: string; logo: string; ai: string; children?: ReactNode }) {
  return role === 'user' ? (
    <div className="chat-msg chat-msg--you">
      {/* ES-162: quién habla va en una etiqueta, no solo en el color */}
      <span className="chat-msg-who">{you}</span>
      <div className="chat-msg-body">
        {text}
      </div>
    </div>
  ) : (
    <div className="chat-msg chat-msg--bot">
      <span className="chat-msg-who">✦ {logo} · {ai}</span>
      <p className="chat-msg-text">{text}</p>
      {children}
    </div>
  )
})

export function ChatPage() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const role = localStorage.getItem('elevation_role') ?? 'user'
  const getToken = () => localStorage.getItem('elevation_token') ?? ''

  // Chat
  // ES-13: la Brújula profesional solo existe con la bandera encendida; sin ella, ?mode=compass se ignora y el chat es el normal.
  const [params] = useSearchParams()
  const compass = import.meta.env.VITE_ENABLE_COMPASS_CHAT === 'true' && params.get('mode') === 'compass'
  const chat = usePersonalChat(lang, true, compass ? 'compass' : undefined)
  const [compassStarted, setCompassStarted] = useState(false)
  useEffect(() => { if (chat.intent) setCompassStarted(true) }, [chat.intent])
  const { messages, busy: sending } = chat
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [enterSends, setEnterSends] = useState(readEnterSends) // «Enter envía»: preferencia de este navegador (desactivada por defecto); se cambia desde el menú
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
    // HU-051 — Load existing recommendations
    void loadExistingRecs()
  }, [navigate, loadExistingRecs])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [messages, sending])

  const handleLogout = () => {
    if (!chat.canLeave()) return
    clearPending() // QA-134-01: el mensaje pendiente del chat no sobrevive al cierre de sesión
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


  // HU-051 — Generate recommendations
  const handleGenerateRecs = async () => {
    setLoadingRecs(true)
    setRecsError('')
    setShowRecs(true)
    try {
      const res = await apiFetch('/api/recommendations/generate', getToken(), { method: 'POST', body: JSON.stringify({ lang }) })
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
    if (!confirm('¿Seguro que quieres activar esta versión anterior?')) return
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
    <div className="chat-shell">
      <h1 className="sr-only">{lang === 'es' ? 'Conversación' : 'Conversation'}</h1>

      {/* Mensajes */}
      {/* ES-123: la conversación ocupa el alto restante (scroll propio) entre la cabecera y la caja de mensaje, que va en el flujo y no fija con relleno de 300 px */}
      <div className="chat-main">
        <div className="chat-top">
          <ChatBar sent={messages.length} menu={<button type="button" className="chat-menu-btn space-ghost" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>{copy[lang].menu}</button>} />
          {compass && <CompassBanner lang={lang} started={compassStarted} canLeave={chat.canLeave} />}
        </div>
        <div className="chat-scroll" role="region" aria-label={copy[lang].conversation} tabIndex={0}>
        <div className="chat-transcript">
          {!messages.length && chat.loaded && <p>{t('chat_welcome')}</p>}
          {/* ES-199: cada burbuja se pinta una sola vez; teclear en el cuadro de mensaje ya no vuelve a pintar todo el historial. Solo la última (que lleva el aviso de respuesta cortada) se repinta. */}
          {messages.map((msg, i) => (
            <div key={i}>
              <ChatBubble role={msg.role} text={msg.text} you={copy[lang].you} logo={t('logo')} ai={copy[lang].ai}>
                {i === messages.length - 1 && msg.role !== 'user' && <TruncatedNotice chat={chat} />}
              </ChatBubble>
            </div>
          ))}
          {sending && (
            <div role="status" className="chat-msg chat-msg--bot">
              <span className="chat-msg-who">✦ {t('logo')} · {copy[lang].ai}</span>
              <p className="chat-msg-wait">{t('chat_thinking')}</p>
            </div>
          )}
          <ChatContext chat={chat} />
          <ThreadNotices />
          <ChatStatus chat={chat} />

          <div ref={chatEndRef} />
        </div>
        </div>
        <div className="chat-input-bar">
          <ChatInput chat={chat} enterSends={enterSends} />
          <ChatLimitsNotice />
        </div>
      </div>

      <ChatMenu open={menuOpen} onClose={() => setMenuOpen(false)} onProgress={() => { if (chat.canLeave()) navigate('/app/progress') }} onRecs={() => setShowRecs(true)}
        onAdmin={['admin', 'superadmin'].includes(role) ? openAdmin : undefined} onCheckout={() => setShowCheckout(true)} enterSends={enterSends} onEnterSends={value => { setEnterSends(value); writeEnterSends(value) }} />

      {/* HU-051 — Recomendaciones: hoja inferior (antes un bloque dentro del hilo que partía «Recomendaciones» a mitad de palabra, E293-2) */}
      <Dialog sheet open={showRecs} onClose={() => setShowRecs(false)} title={t('rec_title')}
        actions={<><Button variant="ghost" disabled={loadingRecs} onClick={() => { void handleGenerateRecs() }}>{loadingRecs ? t('rec_loading') : recommendations.length > 0 ? t('rec_regenerate') : t('rec_generate')}</Button><Button variant="ghost" onClick={() => setShowRecs(false)}>{copy[lang].close}</Button></>}>
        <p className="chat-recs-sub">{t('rec_subtitle')}</p>
        {loadingRecs && <p className="chat-recs-loading" role="status">{t('rec_loading')}</p>}
        {recsError && <p className="chat-recs-error" role="alert">{recsError}</p>}
        {!loadingRecs && recommendations.length > 0 && (
          <div className="chat-recs-list">
            {recommendations.slice(0, 3).map(rec => (
              <div key={rec.id} className="chat-rec">
                <div className="chat-rec-cat">{t(`rec_category_${rec.category}`)}</div>
                <p className="chat-rec-text">{rec.content}</p>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* HU-021 + HU-022 — Check-out + calificación: hoja inferior, sin emojis (el ánimo y la calificación se leen en palabras) */}
      <Dialog sheet open={showCheckout} onClose={() => { if (!checkoutSaving) setShowCheckout(false) }} title={t('checkout_title')}
        actions={<><Button disabled={checkoutMood === null || checkoutSaving} onClick={() => { if (checkoutMood !== null) void handleCheckout(checkoutMood) }}>{checkoutSaving ? '...' : t('checkout_signout')}</Button><Button variant="ghost" disabled={checkoutSaving} onClick={handleLogout}>{t('checkout_skip')}</Button></>}>
        <p className="chat-recs-sub">{t('checkout_label')} · {t('checkout_hint')}</p>
        <ScaleField legend={t('checkout_hint')} name="checkout-mood" value={checkoutMood === null ? '' : String(checkoutMood)} onChange={value => setCheckoutMood(Number(value))}
          options={CHECKOUT_MOODS.map(m => ({ value: String(m.value), label: t(`emo_${m.value + 1}`) }))} />
        {checkoutMood !== null && <ScaleField legend={t('checkout_rating')} name="checkout-rating" value={starRating === null ? '' : String(starRating)} onChange={value => setStarRating(Number(value))}
          options={[1, 2, 3, 4, 5].map(star => ({ value: String(star), label: t(`star_${star}`) }))} />}
      </Dialog>

      {/* Panel Admin */}
      {adminOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setAdminOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,28,27,0.1)', backdropFilter: 'blur(4px)' }} />
          <aside style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', background: '#F5F3EF', borderLeft: '1px solid #E7E5E4', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '0 0 60px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderBottom: '1px solid #E7E5E4' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1C1917', margin: 0 }}>{t('admin_title')}</h2>
              <button onClick={() => setAdminOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B645F', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {role === 'superadmin' && (
              <div style={{ display: 'flex', borderBottom: '1px solid #E7E5E4', background: '#FAF8F4' }}>
                {([['prompts', 'Prompts'], ['landing', 'Contenido Landing']] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setAdminTab(tab)}
                    style={{ flex: 1, padding: '0.75rem', fontSize: 12, fontWeight: adminTab === tab ? 600 : 400, color: adminTab === tab ? '#1C1917' : '#6B645F', background: 'none', border: 'none', borderBottom: adminTab === tab ? '2px solid #5C6B4E' : '2px solid transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
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
                      {activePrompt?.approved_by && <span style={{ fontSize: 11, color: '#6F6963' }}>{t('admin_approved_by')} {activePrompt.approved_by}</span>}
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
                        style={{ width: '100%', height: 260, padding: '1.25rem', background: promptMode === 'edit' ? 'white' : '#FAFAFA', border: `1px solid ${promptMode === 'edit' ? '#0d9488' : '#E7E5E4'}`, borderRadius: '0.75rem', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.7, color: promptMode === 'edit' ? '#1C1917' : '#6B645F', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                      {promptMode === 'view' ? (
                        <button onClick={() => setPromptMode('edit')} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #0d9488', background: 'transparent', color: '#0d9488', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>{t('admin_propose')}</button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button onClick={() => { void proposePrompt() }} disabled={promptSaving || !promptText.trim()}
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: promptSaving || !promptText.trim() ? '#E7E5E4' : 'linear-gradient(135deg,#00685f,#008378)', color: promptSaving || !promptText.trim() ? '#6F6963' : 'white', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
                            {promptSaving ? t('admin_sending') : t('admin_send')}
                          </button>
                          <button onClick={() => { setPromptMode('view'); void loadActivePrompt() }} style={{ background: 'none', border: 'none', color: '#6B645F', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem 1rem' }}>{t('admin_cancel')}</button>
                        </div>
                      )}
                    </>
                  )}
                  {role === 'superadmin' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1C1917', margin: 0 }}>{t('admin_versions_pending')}</h4>
                      {pendingVersions.length === 0
                        ? <p style={{ fontSize: '0.8rem', color: '#6F6963', margin: 0 }}>{t('admin_no_pending')}</p>
                        : pendingVersions.map(v => (
                          <div key={v.id} style={{ background: 'white', border: '1px solid #E7E5E4', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1C1917' }}>v{v.version}</span>
                              <span style={{ fontSize: 11, color: '#6F6963' }}>{t('admin_proposed_by')} {v.proposed_by}</span>
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
                                <span style={{ fontSize: 11, color: v.status === 'active' ? '#059669' : '#6F6963' }}>
                                  {v.status === 'active' ? t('admin_status_active') : v.status === 'approved' ? t('admin_status_approved') : v.status === 'rejected' ? t('admin_status_rejected') : t('admin_status_archived')}
                                </span>
                              </div>
                              {v.status !== 'active' && (
                                <button onClick={() => { void rollbackVersion(v.id) }} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #E7E5E4', background: 'none', fontSize: 11, color: '#6B645F', cursor: 'pointer' }}>{t('admin_rollback')}</button>
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
                        style={{ padding: '0.4rem 1rem', borderRadius: '0.5rem', border: '0.5px solid #D6D2C4', background: landingTab === l ? '#5C6B4E' : 'transparent', color: landingTab === l ? '#FAF8F4' : '#6B645F', fontSize: 12, fontWeight: landingTab === l ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
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
                            style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: `0.5px solid ${hasChanged ? '#5C6B4E' : '#D6D2C4'}`, background: '#FAF8F4', fontSize: 13, color: '#1C1917', resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }} />
                          <button onClick={() => { void saveLandingField(key, landingTab) }} disabled={isSaving || !hasChanged}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: isSaving || !hasChanged ? '#E7E5E4' : '#5C6B4E', color: isSaving || !hasChanged ? '#6F6963' : '#FAF8F4', fontSize: 11, cursor: isSaving || !hasChanged ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginTop: 1 }}>
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

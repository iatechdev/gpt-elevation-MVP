import { memo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChatBar, ThreadNotices } from '../space/ChatBar'
import { ChatMenu, ConversationGroup } from '../space/ChatMenu'
import { registerDrawerExtra, requestDrawer } from '../shell/drawerExtra'
import { registerLeaveGuard } from '../shell/leaveGuard'
import { useNarrowHeader } from '../shell/narrowHeader'
import { signOut } from '../access/signOut'
import { Button, Dialog, ScaleField } from '../cartografia'
import { readEnterSends, writeEnterSends } from '../space/chatKeys'
import { CompassBanner } from '../space/CompassBanner'
import { usePersonalChat } from '../space/usePersonalChat'
import { ChatContext, ChatInput, ChatStatus, TruncatedNotice } from '../space/ChatControls'
import { ChatLimitsNotice } from '../space/ChatLimitsNotice'
import '../space/space.css' // ES-153: antes lo traía el menú de Mi espacio
import { useLanguage } from '../i18n/useLanguage'
import { copy } from '../space/copy'
import { useThreadScroll } from '../space/useThreadScroll'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

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
  // ES-394: el hilo sigue la respuesta si la persona está al final; si subió, aparece «Ir al último mensaje»
  const scrollRef = useRef<HTMLDivElement>(null); const transcriptRef = useRef<HTMLDivElement>(null)
  const thread = useThreadScroll(scrollRef, transcriptRef, messages.length, sending, chat.loaded)

  // HU-021 — Check-out de ánimo
  const [menuOpen, setMenuOpen] = useState(false)
  // ES-359 (PR4): a ≤ 900 px el botón «☰» de la barra abre el cajón del marco (con «Conversación» arriba; el encabezado del marco está oculto en el chat); la hoja propia solo existe en escritorio.
  const narrow = useNarrowHeader()
  if (narrow && menuOpen) setMenuOpen(false)
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

  // ES-373 (O427-2): la pregunta «Si sales, perderás…» (canLeave) se hace ANTES de abrir la despedida, a cualquier ancho; aquí ya no se repite.
  const handleLogout = async () => {
    await signOut(BACKEND) // ES-136: revoca la sesión en el servidor y borra la local (incluido el mensaje pendiente del chat)
    navigate('/', { replace: true })
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
    await handleLogout()
  }


  // ES-359 (PR4): lo que el chat añade al marco. Lo cambiante (canLeave) se lee por referencia para no volver a registrar en cada pintado.
  const live = useRef({ canLeave: chat.canLeave }); useEffect(() => { live.current = { canLeave: chat.canLeave } })
  const isAdmin = ['admin', 'superadmin'].includes(role)
  useEffect(() => registerDrawerExtra({
    omit: ['/app/progress'], // «Mi progreso» ya va en «Conversación»
    render: close => <div className="chat-menu"><ConversationGroup onClose={close} enterSends={enterSends}
      onProgress={() => { if (live.current.canLeave()) navigate('/app/progress') }} onRecs={() => setShowRecs(true)}
      onAdmin={isAdmin ? () => { if (live.current.canLeave()) navigate('/admin/dashboard') } : undefined}
      onEnterSends={value => { setEnterSends(value); writeEnterSends(value) }} /></div>,
  }), [enterSends, isAdmin, navigate])
  // «Cerrar sesión» de los menús del marco (cajón y menú de cuenta) abre la despedida (check-out) como el menú propio del chat; antes pregunta si hay un mensaje sin enviar.
  useEffect(() => registerLeaveGuard(() => { if (!live.current.canLeave()) return true; setShowCheckout(true); return true }, { ownLinks: true }), [])

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

  return (
    <div className="chat-shell">

      {/* Mensajes */}
      {/* ES-123: la conversación ocupa el alto restante (scroll propio) entre la cabecera y la caja de mensaje, que va en el flujo y no fija con relleno de 300 px */}
      <div className="chat-main">
        <div className="chat-top">
          <ChatBar sent={messages.length} menu={<button type="button" className="chat-menu-btn" aria-label={copy[lang].menu} aria-haspopup="dialog" aria-expanded={narrow ? undefined : menuOpen} onClick={event => { if (narrow) requestDrawer(event.currentTarget); else setMenuOpen(true) }}><span aria-hidden="true">☰</span><span className="chat-menu-btn__w" aria-hidden="true">{copy[lang].menu}</span></button>} />
          {compass && <CompassBanner lang={lang} started={compassStarted} canLeave={chat.canLeave} />}
        </div>
        <div ref={scrollRef} onScroll={thread.onScroll} onWheel={thread.onWheel} onTouchMove={thread.onTouchMove} onKeyDown={thread.onKeyDown} onPointerDown={thread.onPointerDown} className="chat-scroll" role="region" aria-label={copy[lang].conversation} tabIndex={0}>
        <div ref={transcriptRef} className="chat-transcript">
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

        </div>
        {/* ES-394: ranura de alto 0 pegada al borde inferior del hilo (no ocupa espacio ni mueve nada); es una región viva, así que el control se anuncia al aparecer */}
        <div className="chat-jump-slot" aria-live="polite">{thread.away && messages.length > 0 && <button type="button" className="chat-jump" onClick={thread.jump}><span aria-hidden="true">↓</span> {copy[lang].jumpLatest}</button>}</div>
        </div>
        <div className="chat-input-bar">
          <ChatInput chat={chat} enterSends={enterSends} />
          <ChatLimitsNotice />
        </div>
      </div>

      {!narrow && <ChatMenu open={menuOpen} onClose={() => setMenuOpen(false)} onProgress={() => { if (chat.canLeave()) navigate('/app/progress') }} onRecs={() => setShowRecs(true)}
        onAdmin={['admin', 'superadmin'].includes(role) ? () => { if (chat.canLeave()) navigate('/admin/dashboard') } : undefined} onCheckout={() => { if (chat.canLeave()) setShowCheckout(true) }} enterSends={enterSends} onEnterSends={value => { setEnterSends(value); writeEnterSends(value) }} />}

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
    </div>
  )
}

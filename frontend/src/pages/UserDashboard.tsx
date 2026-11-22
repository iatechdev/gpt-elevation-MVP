// frontend/src/pages/UserDashboard.tsx
// HU-061 — User Dashboard unificado con check-in integrado
// HU-077 — Widget Mi Plan
// HU-067 — Botón videollamada activo
// ES-329 (Inicio): pantalla en «Cartografía» dentro del marco de persona (ES-153). Sin cabecera propia, sin emojis ni estrellas (escala «N de 5» con palabra),
// tendencia en tabla, «Mi plan» con el mismo contenido de antes y textos en el catálogo (dashboardCopy.ts). Los datos, endpoints y flujos NO cambian.

import '../compass/register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import '../evidence/register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import '../context/register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import './progressCopy.ts' // ES-254: «N de 5», palabras del ánimo y categorías de las recomendaciones (mismos textos que /app/progress)
import './dashboardCopy.ts' // ES-329: textos de esta pantalla
import { CARD_HEADING, INITIAL_READS, cardStateOf, failedReads, type Card, type Read, type ReadState } from './dashboardReads.ts' // ES-332: estado de cada lectura (lógica pura, con pruebas)
import { entriesThisWeek, lastSevenDays, todayKey } from './dashboardWeek.ts' // fechas de la semana y de la tendencia (todas con el mismo día, el de los registros)
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { copy } from '../space/copy'
import { PersonScreen } from '../space/PersonScreen'
import { Button, Chip, LinkButton, ScaleField } from '../cartografia/controls'
import { Dialog } from '../cartografia/interactive'
import { Banner, ItemList } from '../cartografia/pieces'
import { signOut } from '../access/signOut'
import { useLanguage } from '../i18n/useLanguage'
import { registerLeaveGuard } from '../shell/leaveGuard'
import { canEnter, type Role } from '../shell/access'
import { FeedbackPreviewLink } from '../pilot/PreviewShell'
import { ProgressMatching } from '../progress/ProgressMatching'
import { CareerEntry } from '../career/CareerShell'
import { MapAccessCard } from '../skill-map/MapAccess'
import { ExerciseTools } from '../exercises/ExerciseTools'
import { checkinDone, markCheckin, rememberZone } from '../checkin/checkinMark'

const API      = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const storedRole = (): Role => { try { const value = localStorage.getItem('elevation_role'); return value === 'admin' || value === 'superadmin' || value === 'therapist' || value === 'board' ? value : 'user' } catch { return 'user' } }
const getToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } } // ES-369 (QA-424-2): el almacenamiento bloqueado no rompe la pantalla

// ── Types ─────────────────────────────────────────────────────────────────────
type MoodLog        = { id: number; date: string; checkin_mood: number | null; checkout_mood: number | null }
type Recommendation = { id: number; category: string; content: string; generatedAt: string }
type UpcomingSession = {
  id: number; scheduledAt: string; duration: number
  meetingUrl: string | null; status: string
  therapistName: string; therapistEmail: string
}
type UserPlan = {
  id: number; slug: string; name_es: string; name_en: string
  price: number; currency: string; period: string
  features_es: string[]; features_en: string[]
  isHighlighted: boolean
} | null
type PlanLimits = {
  chatMessagesDay: number
  sessionsMonth: number
  canAccessProgress: boolean
  canMatchTherapist: boolean
}

const MOODS = [1, 2, 3, 4, 5]
const REC_CATEGORIES = ['mindfulness', 'habit', 'reflection', 'resource']

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
  const { t, lang } = useLanguage()
  const navigate    = useNavigate()
  const locale      = lang === 'es' ? 'es-CO' : 'en-US'

  // ── Check-in state ───────────────────────────────────────────────────────
  // E393-1: el registro de hoy se lee desde el primer pintado (antes se ponía en un efecto: la tarjeta «Estado emocional» salía con el formulario de 161 px y se encogía, y «Tu progreso» subía → CLS).
  const [checkedIn,      setCheckedIn]      = useState(() => checkinDone(getToken()))
  const [todayMood,      setTodayMood]      = useState<number | null>(null)
  const [checkingIn,     setCheckingIn]     = useState(false)
  const [pendingMood,    setPendingMood]    = useState<number | null>(null) // E322-1: opción elegida, aún sin registrar

  // ── Estado de cada lectura (ES-332) ──────────────────────────────────────
  const [readState, setReadState] = useState<Record<Read, ReadState>>(INITIAL_READS)
  const [retrying, setRetrying] = useState<Card | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const focusCard = useRef<Card | null>(null) // tras un «Reintentar» que tiene éxito, el foco vuelve al título de la tarjeta (el botón desaparece)
  const setRead = useCallback((read: Read, state: ReadState) => setReadState(prev => (prev[read] === state ? prev : { ...prev, [read]: state })), [])

  // ── Progress state ───────────────────────────────────────────────────────
  const [moodLogs,      setMoodLogs]      = useState<MoodLog[]>([])
  const [sessionsWeek,  setSessionsWeek]  = useState(0)
  const [timeZone,      setTimeZone]      = useState<string | null>(null) // E393-3: la zona de la persona (la devuelve /api/user/progress) para saber qué día es hoy

  // ── Upcoming session ─────────────────────────────────────────────────────
  const [upcomingSession, setUpcomingSession] = useState<UpcomingSession | null>(null)
  const [therapistId,     setTherapistId]     = useState<number | null>(null)

  // ── Recommendations ──────────────────────────────────────────────────────
  const [recommendations,  setRecommendations]  = useState<Recommendation[]>([])
  const [expandedRec,      setExpandedRec]      = useState<Recommendation | null>(null)
  const [loadingRecs,      setLoadingRecs]       = useState(false)

  // ── Matching dialog (mismo flujo y mismo contrato con el servidor que /app/progress) ──
  const [showMatching, setShowMatching] = useState(false)
  const handleMatchingClose = () => {
    setShowMatching(false)
    const { signal } = new AbortController() // lectura iniciada por la persona (no se cancela al salir: la respuesta solo actualiza esta pantalla)
    void loadUpcomingSession(signal) // antes la segunda lectura (profesional) iba encadenada a esta: se refrescan las dos
    void loadTherapist(signal)
  }

  // ── Checkout dialog ──────────────────────────────────────────────────────
  const [showCheckout,   setShowCheckout]   = useState(false)
  const [checkoutMood,   setCheckoutMood]   = useState<number | null>(null)
  const [starRating,     setStarRating]     = useState<number | null>(null)
  const [checkoutSaving, setCheckoutSaving] = useState(false)

  // ── Plan state ───────────────────────────────────────────────────────────
  const [userPlan,   setUserPlan]   = useState<UserPlan>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)

  // ── Init ─────────────────────────────────────────────────────────────────

  // ES-329: «Salir» ahora lo pone el marco de persona; antes de cerrar la sesión el marco consulta esta guardia, que abre la despedida (check-out) y bloquea el cierre directo.
  // `ownLinks`: los enlaces del marco navegan sin preguntar; solo «Salir» (una acción) pasa por la despedida.
  useEffect(() => registerLeaveGuard(() => { setShowCheckout(true); return true }, { ownLinks: true }), [])

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadProgress = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/user/progress', { signal })
      if (signal.aborted) return
      if (!res.ok) { setRead('progress', 'error'); return }
      const data = await res.json()
      if (signal.aborted) return
      setMoodLogs(data.moodLogs ?? [])

      const zone = typeof data.timeZone === 'string' ? data.timeZone : null
      setTimeZone(zone)
      rememberZone(getToken(), zone) // ES-369: el día de la marca del check-in es el de esta zona
      setCheckedIn(checkinDone(getToken()))
      setSessionsWeek(entriesThisWeek(data.moodLogs ?? [], todayKey(new Date(), zone)))
      setRead('progress', 'ok')
    } catch { if (!signal.aborted) setRead('progress', 'error') }
  }, [setRead])

  const loadUpcomingSession = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/sessions/user/upcoming', { signal })
      if (signal.aborted) return
      if (!res.ok) { setRead('upcoming', 'error'); return }
      const data = await res.json()
      if (signal.aborted) return
      setUpcomingSession(data.session ?? null)
      setRead('upcoming', 'ok')
    } catch { if (!signal.aborted) setRead('upcoming', 'error') }
  }, [setRead])

  // ES-200: antes esta lectura esperaba a que terminara la de la próxima sesión (cascada evitable: no depende de ella).
  const loadTherapist = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/sessions/user/my-therapist', { signal })
      if (signal.aborted) return
      if (!res.ok) { setRead('therapist', 'error'); return }
      const data = await res.json()
      if (signal.aborted) return
      setTherapistId(data.therapist?.id ?? null)
      setRead('therapist', 'ok')
    } catch { if (!signal.aborted) setRead('therapist', 'error') }
  }, [setRead])

  const loadRecommendations = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/recommendations', { signal })
      if (signal.aborted) return
      if (!res.ok) { setRead('recommendations', 'error'); return }
      const data = await res.json()
      if (signal.aborted) return
      setRecommendations(data.slice(0, 4))
      setRead('recommendations', 'ok')
    } catch { if (!signal.aborted) setRead('recommendations', 'error') }
  }, [setRead])

  const loadUserPlan = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/user/plan/me', { signal })
      if (signal.aborted) return
      if (!res.ok) { setRead('plan', 'error'); return }
      const data = await res.json()
      if (signal.aborted) return
      setUserPlan(data.plan ?? null)
      setPlanLimits(data.limits ?? null)
      setRead('plan', 'ok')
    } catch { if (!signal.aborted) setRead('plan', 'error') }
  }, [setRead])

  // ES-332: estado de cada tarjeta y reintento solo de lo fallido (lógica pura en dashboardReads.ts).
  const cardState = (card: Card) => cardStateOf(readState, upcomingSession !== null, card)
  const retryCard = (card: Card) => {
    const signal = controllerRef.current?.signal
    const failed = failedReads(readState, card)
    if (retrying !== null || !signal || failed.length === 0) return
    setRetrying(card)
    focusCard.current = card
    failed.forEach(r => setRead(r, 'loading'))
    const loaders: Record<Read, typeof loadProgress> = { progress: loadProgress, upcoming: loadUpcomingSession, therapist: loadTherapist, recommendations: loadRecommendations, plan: loadUserPlan }
    for (const r of failed) void loaders[r](signal)
  }
  // Aviso de error de una tarjeta (role=alert): el texto de la tarjeta y «Reintentar» (aria-busy mientras repite, sin perder el foco).
  const cardError = (card: Card, message: string) => (
    <Banner kind="error" title={message}>
      <div className="pg-actions"><Button aria-busy={retrying === card} onClick={() => retryCard(card)}>{t('pr_retry')}</Button></div>
    </Banner>
  )

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }

    setCheckedIn(checkinDone(token)) // ES-369: de esta persona y de hoy en su zona

    // ES-200: las cinco lecturas son independientes y salen a la vez; al salir de la pantalla se cancelan y no actualizan estado.
    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller
    void loadProgress(signal)
    void loadUpcomingSession(signal)
    void loadTherapist(signal)
    void loadRecommendations(signal)
    void loadUserPlan(signal)
    return () => controller.abort()
  }, [navigate, loadProgress, loadUpcomingSession, loadTherapist, loadRecommendations, loadUserPlan])

  // ES-332: tras «Reintentar», cuando la tarjeta deja de estar cargando se libera el reintento y, si se recuperó, el foco pasa a su título (el botón ya no existe).
  useEffect(() => {
    const card = focusCard.current
    const state = card ? cardStateOf(readState, upcomingSession !== null, card) : 'loading'
    if (!card || state === 'loading') return
    focusCard.current = null
    setRetrying(null)
    if (state === 'ok') document.getElementById(CARD_HEADING[card])?.focus()
  }, [readState, upcomingSession])

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
      markCheckin(getToken())
    } catch { /* silent */ }
    finally { setCheckingIn(false) }
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
    await signOut(API) // ES-136: revoca la sesión en el servidor y borra la local
    navigate('/', { replace: true })
  }

  // ── Generate recommendations ──────────────────────────────────────────────
  const handleGenerateRecs = async () => {
    setLoadingRecs(true)
    try {
      const res = await apiFetch('/api/recommendations/generate', { method: 'POST', body: JSON.stringify({ lang }) })
      if (!res.ok) return
      const data = await res.json()
      setRecommendations(data.slice(0, 4))
    } catch { /* silent */ }
    finally { setLoadingRecs(false) }
  }

  // ── Mood trend for last 7 days ────────────────────────────────────────────
  const getMoodTrend = () => {
    return lastSevenDays(todayKey(new Date(), timeZone)).map(({ dateStr, date }) => {
      const log = moodLogs.find(m => String(m.date).slice(0, 10) === dateStr)
      const moods = [log?.checkin_mood, log?.checkout_mood].filter(Boolean) as number[]
      const avg   = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null
      return { dateStr, day: date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }), avg }
    })
  }
  const formatAvg = (avg: number) => t('pr_of5', { n: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(avg) })
  const moodOption = (n: number) => ({ value: String(n), label: `${n} · ${t(`pr_mood_${n}`)}` })

  const formatSession = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })

  // ── Plan helpers ─────────────────────────────────────────────────────────
  const planSlug   = userPlan?.slug ?? 'basic'
  const planName   = userPlan
    ? (lang === 'es' ? userPlan.name_es : userPlan.name_en)
    : t('dash_plan_basic')
  const planFeatures = userPlan
    ? (lang === 'es' ? userPlan.features_es : userPlan.features_en)
    : []
  const formatLimit = (n: number) => n === -1 ? '∞' : String(n)

  // HU-067 — helper: sesión activa ahora o próxima en los próximos 15 min
  const sessionIsLive = upcomingSession?.status === 'in_progress'
  const sessionIsImminent = (() => {
    if (!upcomingSession || upcomingSession.status !== 'scheduled') return false
    const diff = new Date(upcomingSession.scheduledAt).getTime() - Date.now()
    return diff <= 15 * 60 * 1000 && diff >= 0
  })()

  const progressState = cardState('progress')
  const sessionState = cardState('session')
  const planState = cardState('plan')
  const recsState = cardState('recs')

  const recCategory = (category: string) => t(`pr_rec_cat_${REC_CATEGORIES.includes(category) ? category : 'other'}`)

  return (
    <PersonScreen title={t('dash_title')} wide>
      <div className="pc-stack">
        <div className="pc-grid">
          <MapAccessCard />
          <CareerEntry />
        </div>

        <div className="pc-grid">
          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="pc-stack">
            {/* Estado emocional */}
            <section className="cg-card pg-card" aria-labelledby="dash-mood">
              <h2 id="dash-mood">{t('dash_mood_title')}</h2>
              {checkedIn ? (
                <>
                  <p>{t('dash_checked')}</p>
                  {todayMood !== null && <p className="cg-hint">{t('pr_of5', { n: todayMood })} · {t(`pr_mood_${todayMood}`)}</p>}
                </>
              ) : (
                <>
                  {/* E322-1: elegir con las flechas NO registra; se registra con el botón (teclado: Tab hasta él y Enter). */}
                  <ScaleField legend={t('dash_arrive')} name="dash-mood" disabled={checkingIn} options={MOODS.map(moodOption)}
                    value={pendingMood === null ? '' : String(pendingMood)} onChange={value => setPendingMood(Number(value))} />
                  <div className="pg-actions">
                    <Button disabled={checkingIn || pendingMood === null} onClick={() => { if (pendingMood !== null && !checkingIn) void handleCheckin(pendingMood) }}>{t('dash_register')}</Button>
                  </div>
                </>
              )}
            </section>

            {/* Tu progreso */}
            <section className={`cg-card pg-card${progressState === 'ok' ? '' : ' pc-hold-progress'}`} aria-labelledby="dash-progress">
              <h2 id="dash-progress" tabIndex={-1}>{t('dash_progress')}</h2>
              {progressState === 'loading' ? <p className="cg-hint" role="status">{t('loading')}</p>
                : progressState === 'error' ? cardError('progress', t('pr_error'))
                : <>
                  <dl className="pc-dl">
                    <dt>{t('dash_sessions_week')}</dt>
                    <dd className="pc-big">{sessionsWeek}</dd>
                  </dl>
                  <div className="pc-region" role="region" tabIndex={0} aria-label={t('dash_trend')}>
                    <table className="pc-trend">
                      <caption className="cg-hint">{t('dash_trend')}</caption>
                      <thead><tr>{getMoodTrend().map(({ dateStr, day }) => <th key={dateStr} scope="col">{day}</th>)}</tr></thead>
                      <tbody><tr>{getMoodTrend().map(({ dateStr, avg }) => <td key={dateStr}>{avg === null ? '—' : formatAvg(avg)}</td>)}</tr></tbody>
                    </table>
                  </div>
                </>}
            </section>
          </div>

          {/* ── COLUMNA DERECHA ── */}
          <div className="pc-stack">
            {/* Próxima sesión — HU-067 */}
            <section className={`cg-card pg-card${sessionState === 'ok' ? '' : ' pc-hold-session'}`} aria-labelledby="dash-session">
              <h2 id="dash-session" tabIndex={-1}>{sessionIsLive ? t('dash_live') : t('dash_upcoming')}</h2>
              {sessionState === 'loading' ? <p className="cg-hint" role="status">{t('loading')}</p>
                : sessionState === 'error' ? cardError('session', t('dash_err_session'))
                : upcomingSession ? (
                <>
                  <p><strong>{t('dash_with')} {upcomingSession.therapistName}</strong></p>
                  <p className="cg-hint">{formatSession(upcomingSession.scheduledAt)} — {upcomingSession.duration} min</p>
                  {/* HU-067 — el botón de videollamada solo se pinta cuando la sesión está en curso o por comenzar, como antes */}
                  {sessionIsLive ? (
                    <div className="pg-actions"><Button onClick={() => navigate(`/app/session/${upcomingSession.id}`)}>{t('dash_join')}</Button></div>
                  ) : sessionIsImminent ? (
                    <div className="pg-actions"><Button onClick={() => navigate(`/app/session/${upcomingSession.id}`)}>{t('dash_soon')}</Button></div>
                  ) : (
                    <p className="cg-hint">{t('dash_link_later')}</p>
                  )}
                </>
              ) : therapistId ? (
                <p>{t('dash_no_session')}</p>
              ) : (
                <div className="pg-actions"><Button onClick={() => setShowMatching(true)}>{t('dash_find_pro')}</Button></div>
              )}
            </section>

            {/* Acceso a la conversación (ES-123: la conversación vive en /app/chat, a pantalla completa) */}
            <section className="cg-card pg-card" aria-labelledby="dash-chat">
              <h2 id="dash-chat">{copy[lang].chatLink}</h2>
              <ExerciseTools />
              {!checkedIn ? (
                <p>{t('dash_chat_select')}</p>
              ) : (
                <>
                  <p>{copy[lang].chatLinkHint}</p>
                  <div className="pg-actions"><Link className="cg-btn" to="/app/chat">{copy[lang].chatLink}</Link></div>
                </>
              )}
            </section>

            {/* Mi plan (HU-077): el mismo contenido de antes, sin color fijo ni emoji (adenda 12328). El plan completo sigue en /app/plan. */}
            <section className={`cg-card pg-card${planState === 'ok' ? '' : ' pc-hold-plan'}`} aria-labelledby="dash-plan">
              <div className="pc-line">
                <h2 id="dash-plan" className="pc-flush" tabIndex={-1}>{t('dash_plan')}</h2>
                {planState === 'ok' && <Chip>{planName}</Chip>}
              </div>
              {planState === 'loading' ? <p className="cg-hint" role="status">{t('loading')}</p>
                : planState === 'error' ? cardError('plan', t('dash_err_plan'))
                : <>
              {userPlan && userPlan.price > 0 ? (
                <p className="pc-price">${userPlan.price} {userPlan.currency} / {t('dash_month')}</p>
              ) : (
                <p className="pc-price">{t('dash_free')}</p>
              )}
              {planLimits && (
                <dl className="pc-dl">
                  <div className="pc-line"><dt>{t('dash_ai_day')}</dt><dd>{formatLimit(planLimits.chatMessagesDay)}</dd></div>
                  <div className="pc-line"><dt>{t('dash_sessions_month')}</dt><dd>{formatLimit(planLimits.sessionsMonth)}</dd></div>
                </dl>
              )}
              {planFeatures.length > 0 && (
                <ul className="pc-feats">
                  {planFeatures.slice(0, 3).map((f, i) => <li key={i}>✓ {f}</li>)}
                </ul>
              )}
              {(planSlug === 'basic' || planSlug === 'essential') && (
                <div className="pg-actions"><Link className="pc-link" to="/app/plan">{t('dash_see_plans')}</Link></div>
              )}
                </>}
            </section>
          </div>
        </div>

        {/* ── RECOMENDACIONES ── */}
        <section className={`cg-card pg-card${recsState === 'ok' ? '' : ' pc-hold-recs'}`} aria-labelledby="dash-recs">
          <div className="pc-line">
            <h2 id="dash-recs" className="pc-flush" tabIndex={-1}>{t('dash_recs')}</h2>
            <Button variant="ghost" onClick={() => void handleGenerateRecs()} disabled={loadingRecs} aria-busy={loadingRecs}>{t('dash_recs_generate')}</Button>
          </div>
          {recsState === 'loading' ? <p className="cg-hint" role="status">{t('loading')}</p>
            : recsState === 'error' ? cardError('recs', t('dash_err_recs'))
            : recommendations.length === 0 ? (
            <p className="cg-muted">{t('dash_recs_empty')}</p>
          ) : (
            <ItemList items={recommendations.map(rec => ({
              id: String(rec.id),
              top: <span className="cg-tag">{recCategory(rec.category)}</span>,
              body: <>
                <p>{rec.content.length > 100 ? rec.content.slice(0, 100) + '...' : rec.content}</p>
                <div className="pg-actions"><LinkButton onClick={() => setExpandedRec(rec)}>{t('dash_explore')}</LinkButton></div>
              </>,
            }))} />
          )}
        </section>

        {/* ── ENLACES ── */}
        <nav className="pc-links" aria-label={t('dash_title')}>
          {/* ES-372 (O428-1): «/app/onboarding» es de la zona participante (solo rol user); los demás roles no ven un enlace que termina en «sin acceso». */}
          {canEnter(storedRole(), 'participant') && <Link className="pc-link context-dashboard-link" to="/app/onboarding">{t('context_link')}</Link>}
          <Link className="pc-link evidence-dashboard-link" to="/app/evidence">{t('evidence.title')}</Link>
          <Link className="pc-link" to="/app/compass">{t('compass.title')}</Link>
          <Link className="pc-link" to="/app/route-catalog">{t('catalog.title')}</Link>
          <FeedbackPreviewLink />
        </nav>
      </div>

      {/* ── DIÁLOGO RECOMENDACIÓN ── */}
      <Dialog open={expandedRec !== null} onClose={() => setExpandedRec(null)} title={expandedRec ? recCategory(expandedRec.category) : ''}
        actions={<Button variant="ghost" onClick={() => setExpandedRec(null)}>{t('dash_close')}</Button>}>
        <p>{expandedRec?.content}</p>
      </Dialog>

      {/* ── DESPEDIDA (check-out): ánimo y calificación en palabras, sin emojis ni estrellas ── */}
      <Dialog open={showCheckout} onClose={() => { if (!checkoutSaving) setShowCheckout(false) }} title={t('checkout_title')}
        actions={<>
          <Button variant="ghost" disabled={checkoutSaving} onClick={() => { void signOut(API).then(() => navigate('/', { replace: true })) }}>{t('checkout_skip')}</Button>
          <Button disabled={checkoutMood === null || checkoutSaving} aria-busy={checkoutSaving} onClick={() => { if (checkoutMood !== null) void handleCheckout(checkoutMood) }}>{t('checkout_signout')}</Button>
        </>}>
        <p className="cg-hint">{t('checkout_label')}</p>
        <ScaleField legend={t('checkout_hint')} name="checkout-mood" options={MOODS.map(moodOption)}
          value={checkoutMood === null ? '' : String(checkoutMood)} onChange={value => setCheckoutMood(Number(value))} />
        {checkoutMood !== null && (
          <ScaleField legend={t('checkout_rating')} name="checkout-rating" options={MOODS.map(n => ({ value: String(n), label: t('pr_of5', { n }) }))}
            value={starRating === null ? '' : String(starRating)} onChange={value => setStarRating(Number(value))} />
        )}
      </Dialog>

      {/* ── EMPAREJAMIENTO ── */}
      <ProgressMatching open={showMatching} onClose={handleMatchingClose} />
    </PersonScreen>
  )
}

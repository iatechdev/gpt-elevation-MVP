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
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { copy } from '../space/copy'
import { PersonScreen } from '../space/PersonScreen'
import { Button, Chip, LinkButton, ScaleField } from '../cartografia/controls'
import { Dialog } from '../cartografia/interactive'
import { ItemList } from '../cartografia/pieces'
import { signOut } from '../access/signOut'
import { useLanguage } from '../i18n/useLanguage'
import { registerLeaveGuard } from '../shell/leaveGuard'
import { FeedbackPreviewLink } from '../pilot/PreviewShell'
import { ProgressMatching } from '../progress/ProgressMatching'
import { CareerEntry } from '../career/CareerShell'
import { MapAccessCard } from '../skill-map/MapAccess'
import { ExerciseTools } from '../exercises/ExerciseTools'

const API      = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') ?? ''

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
  const [checkedIn,      setCheckedIn]      = useState(false)
  const [todayMood,      setTodayMood]      = useState<number | null>(null)
  const [checkingIn,     setCheckingIn]     = useState(false)

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

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }

    const alreadyCheckedIn = localStorage.getItem('elevation_checkin_date') === new Date().toDateString()
    setCheckedIn(alreadyCheckedIn)

    // ES-200: las cinco lecturas son independientes y salen a la vez; al salir de la pantalla se cancelan y no actualizan estado.
    const controller = new AbortController()
    const { signal } = controller
    void loadProgress(signal)
    void loadUpcomingSession(signal)
    void loadTherapist(signal)
    void loadRecommendations(signal)
    void loadUserPlan(signal)
    return () => controller.abort()
  }, [navigate])

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadProgress = async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/user/progress', { signal })
      if (!res.ok || signal.aborted) return
      const data = await res.json()
      if (signal.aborted) return
      setMoodLogs(data.moodLogs ?? [])

      const monday = new Date()
      monday.setDate(monday.getDate() - monday.getDay() + 1)
      monday.setHours(0, 0, 0, 0)
      const thisWeek = (data.moodLogs ?? []).filter((m: MoodLog) =>
        new Date(m.date) >= monday
      ).length
      setSessionsWeek(thisWeek)
    } catch { /* silent */ }
  }

  const loadUpcomingSession = async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/sessions/user/upcoming', { signal })
      if (!res.ok || signal.aborted) return
      const data = await res.json()
      if (!signal.aborted) setUpcomingSession(data.session ?? null)
    } catch { /* silent */ }
  }

  // ES-200: antes esta lectura esperaba a que terminara la de la próxima sesión (cascada evitable: no depende de ella).
  const loadTherapist = async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/sessions/user/my-therapist', { signal })
      if (!res.ok || signal.aborted) return
      const data = await res.json()
      if (!signal.aborted) setTherapistId(data.therapist?.id ?? null)
    } catch { /* silent */ }
  }

  const loadRecommendations = async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/recommendations', { signal })
      if (!res.ok || signal.aborted) return
      const data = await res.json()
      if (!signal.aborted) setRecommendations(data.slice(0, 4))
    } catch { /* silent */ }
  }

  const loadUserPlan = async (signal: AbortSignal) => {
    try {
      const res = await apiFetch('/api/user/plan/me', { signal })
      if (!res.ok || signal.aborted) return
      const data = await res.json()
      if (signal.aborted) return
      setUserPlan(data.plan ?? null)
      setPlanLimits(data.limits ?? null)
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
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toISOString().split('T')[0]
      const log = moodLogs.find(m => m.date === dateStr)
      const moods = [log?.checkin_mood, log?.checkout_mood].filter(Boolean) as number[]
      const avg   = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null
      return { dateStr, day: d.toLocaleDateString(locale, { weekday: 'short' }), avg }
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
                <ScaleField legend={t('dash_arrive')} name="dash-mood" disabled={checkingIn} options={MOODS.map(moodOption)}
                  value="" onChange={value => { if (!checkingIn) void handleCheckin(Number(value)) }} />
              )}
            </section>

            {/* Tu progreso */}
            <section className="cg-card pg-card" aria-labelledby="dash-progress">
              <h2 id="dash-progress">{t('dash_progress')}</h2>
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
            </section>
          </div>

          {/* ── COLUMNA DERECHA ── */}
          <div className="pc-stack">
            {/* Próxima sesión — HU-067 */}
            <section className="cg-card pg-card" aria-labelledby="dash-session">
              <h2 id="dash-session">{sessionIsLive ? t('dash_live') : t('dash_upcoming')}</h2>
              {upcomingSession ? (
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
            <section className="cg-card pg-card" aria-labelledby="dash-plan">
              <div className="pc-line">
                <h2 id="dash-plan" className="pc-flush">{t('dash_plan')}</h2>
                <Chip>{planName}</Chip>
              </div>
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
            </section>
          </div>
        </div>

        {/* ── RECOMENDACIONES ── */}
        <section className="cg-card pg-card" aria-labelledby="dash-recs">
          <div className="pc-line">
            <h2 id="dash-recs" className="pc-flush">{t('dash_recs')}</h2>
            <Button variant="ghost" onClick={() => void handleGenerateRecs()} disabled={loadingRecs} aria-busy={loadingRecs}>{t('dash_recs_generate')}</Button>
          </div>
          {recommendations.length === 0 ? (
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
          <Link className="pc-link context-dashboard-link" to="/app/onboarding">{t('context_link')}</Link>
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

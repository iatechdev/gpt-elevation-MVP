// ES-177 (B1): bloques del panel profesional. Cada uno tiene su estado (cargando / error con «Reintentar» propio / vacío / datos),
// muestra todo en palabras (sin emojis ni estrellas) y a quien no comparte lo nombra «Persona n» sin cifras ni correo.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { personInitial, personLabel } from './panelText'
import { activeThisWeek, averageMood, averageRating, daysSince, sessionIsNow, type PanelPerson } from './panelFormat'
import { cardStyle } from './panelStyles'
import type { SectionState } from './useSection'

type T = (key: string, params?: Record<string, string | number>) => string

export interface UpcomingSession { id: number; patientId: number; scheduledAt: string; duration: number; status: string; patientName: string | null; patientOrdinal?: number | null; phase?: 'upcoming' | 'due' | 'in_progress' }
export interface AlertsData {
  inactivePatients: { userId: number; name: string; daysSinceLastSession: number | null }[]
  notableProgress: { userId: number; name: string; improved: true }[]
}

const labelStyle: CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: '#57534E', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }
const mutedStyle: CSSProperties = { fontSize: '0.82rem', color: '#57534E', margin: 0 }
const primaryBtn: CSSProperties = { minHeight: 44, minWidth: 44, padding: '0.5rem 1.1rem', background: '#4A6741', border: 'none', borderRadius: '0.85rem', color: '#fff', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }
const ghostBtn: CSSProperties = { ...primaryBtn, background: 'transparent', border: '0.5px solid #4A6741', color: '#4A6741' }

/** Cuadro de un bloque: título, y según el estado «Cargando», error con «Reintentar» (foco al botón tras reintentar) o el contenido. */
export function PanelBlock<S>({ id, title, label, state, t, style, children }: { id: string; title: ReactNode; label?: string; state: SectionState<S>; t: T; style?: CSSProperties; children: ReactNode }) {
  const sectionName = typeof title === 'string' ? title : label ?? ''
  const retry = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const retried = useRef(false) // la persona pulsó «Reintentar»: solo entonces se mueve el foco
  const failed = useRef(false)
  useEffect(() => {
    if (state.status === 'error') { failed.current = true; if (retried.current) retry.current?.focus() }
    if (state.status === 'ready') { if (retried.current && failed.current) heading.current?.focus(); retried.current = false; failed.current = false }
  }, [state.status])
  return (
    <section style={{ ...cardStyle, ...style }} aria-labelledby={`${id}-title`} aria-busy={state.status === 'loading'}>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1} style={labelStyle}>{title}</h2>
      {state.status === 'loading' && <p role="status" style={{ ...mutedStyle, marginTop: '0.75rem' }}>{t('therapist_loading')}</p>}
      {state.status === 'error' && (
        <div role="alert" style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#B91C1C' }}>{t(state.denied ? 'panel_section_forbidden' : 'panel_section_error')}</span>
          {!state.denied && <button ref={retry} type="button" style={ghostBtn} aria-label={`${t('panel_retry')}: ${sectionName}`} onClick={() => { retried.current = true; state.reload() }}>{t('panel_retry')}</button>}
        </div>
      )}
      {state.status === 'ready' && <div style={{ marginTop: '0.75rem' }}>{children}</div>}
    </section>
  )
}

const oneDecimal = (n: number, locale: string) => n.toLocaleString(locale, { maximumFractionDigits: 1 })
const ofFive = (n: number | null, locale: string, t: T) => (n === null ? t('panel_no_data') : t('panel_of_five', { n: oneDecimal(n, locale) }))

export function SummaryBlock({ state, t, locale }: { state: SectionState<PanelPerson[]>; t: T; locale: string }) {
  const people = state.data ?? []
  const cards = [
    { label: t('panel_people'), value: String(people.length) },
    { label: t('panel_active_week'), value: String(activeThisWeek(people)) },
    { label: t('panel_avg_mood'), value: ofFive(averageMood(people), locale, t) },
    { label: t('panel_avg_rating'), value: ofFive(averageRating(people), locale, t) },
  ]
  return (
    <PanelBlock id="panel-summary" title={t('panel_summary')} state={state} t={t}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', margin: 0 }}>
        {cards.map(card => (
          <div key={card.label}>
            <dd style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</dd>
            <dt style={{ fontSize: '0.78rem', color: '#57534E', marginTop: '0.25rem' }}>{card.label}</dt>
          </div>
        ))}
      </dl>
    </PanelBlock>
  )
}

export function UpcomingBlock({ state, t, locale }: { state: SectionState<UpcomingSession[]>; t: T; locale: string }) {
  const navigate = useNavigate()
  const sessions = state.data ?? []
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <PanelBlock id="panel-upcoming" title={t('therapist_upcoming_sessions')} state={state} t={t}>
      {sessions.length === 0 ? <p style={mutedStyle}>{t('panel_no_upcoming')}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {sessions.map(session => {
            const isNow = session.phase === 'in_progress' || sessionIsNow(session.scheduledAt, session.duration)
            // ES-241: quien no autorizó compartir llega sin nombre y con un ordinal estable: se muestra «Persona n» (como en la lista de personas).
            const who = personLabel({ name: session.patientName, ordinal: session.patientOrdinal ?? 0 }, t('therapist_person'))
            return (
              <li key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: isNow ? '#EAF0E6' : '#F5F3EF', borderRadius: '0.65rem', border: isNow ? '1px solid #A8B5A2' : '1px solid transparent' }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#1C1917', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{who}</div>
                  <div style={{ fontSize: '0.78rem', color: '#57534E', marginTop: '0.15rem' }}>
                    {when(session.scheduledAt)} · {session.duration} min
                    {isNow && <strong style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#2F4A29' }}>{t('panel_now')}</strong>}
                  </div>
                </div>
                <button type="button" style={isNow ? primaryBtn : ghostBtn} onClick={() => navigate(`/therapist/session/${session.id}`)}>
                  {isNow ? t('panel_start') : t('panel_open')}
                  <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> · {who}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </PanelBlock>
  )
}

const TREND_KEY = { improving: 'panel_trend_improving', stable: 'panel_trend_stable', declining: 'panel_trend_declining' } as const

export function PeopleBlock({ state, upcoming, t, locale }: { state: SectionState<PanelPerson[]>; upcoming: UpcomingSession[]; t: T; locale: string }) {
  const navigate = useNavigate()
  const people = state.data ?? []
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <PanelBlock id="panel-people" title={t('panel_people')} state={state} t={t}>
      {people.length === 0 ? <p style={mutedStyle}>{t('panel_no_people')}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {people.map(p => {
            const noAccess = p.sharing === false
            const days = daysSince(p.lastMood?.date)
            const lastMood = p.lastMood?.checkout_mood ?? p.lastMood?.checkin_mood ?? null
            const next = upcoming.find(s => s.patientId === p.id) ?? null
            const label = personLabel(p, t('therapist_person'))
            const facts = noAccess ? [] : [
              days === null ? t('panel_no_entries') : `${t('panel_last_entry')}: ${days === 0 ? t('panel_today') : t('panel_days_ago', { n: days })}`,
              lastMood === null ? null : t('panel_last_mood', { n: lastMood }),
              p.trend ? `${t('panel_trend')}: ${t(TREND_KEY[p.trend])}` : null,
              p.avgRating === null ? null : `${t('panel_rating')}: ${ofFive(p.avgRating, locale, t)}`,
              t('panel_entries', { n: p.totalSessions }),
              next ? `${t('panel_next_session')}: ${when(next.scheduledAt)}` : null,
            ].filter((f): f is string => f !== null)
            return (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 0', borderTop: '0.5px solid #E7E5E4', opacity: p.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                  <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: '#EAF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#2F4A29', flexShrink: 0 }}>{personInitial(p)}</div>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1C1917', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>
                      {label}{noAccess && <> — <span>{t('panel_no_access')}</span></>}
                    </div>
                    {noAccess
                      ? <p className="th-notice" style={{ margin: '0.4rem 0 0' }}>{t('therapist_not_shared')}</p>
                      : <p style={{ ...mutedStyle, fontSize: '0.78rem', marginTop: '0.2rem', overflowWrap: 'anywhere' }}>{facts.join(' · ')}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {next && <button type="button" style={primaryBtn} onClick={() => navigate(`/therapist/session/${next.id}`)}>{t('panel_start')}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> · {label}</span></button>}
                  <button type="button" style={ghostBtn} onClick={() => navigate(`/therapist/patient/${p.id}`)}>{t('panel_view_profile')}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> · {label}</span></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </PanelBlock>
  )
}

export function AlertsBlock({ state, t }: { state: SectionState<AlertsData>; t: T }) {
  const data = state.data
  const total = (data?.inactivePatients.length ?? 0) + (data?.notableProgress.length ?? 0)
  return (
    <PanelBlock id="panel-alerts" title={<>{t('panel_alerts')}{state.status === 'ready' && total > 0 ? ` (${total})` : ''}</>} label={t('panel_alerts')} state={state} t={t} style={{}}>
      {total === 0 ? <p style={mutedStyle}>{t('panel_no_alerts')}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data?.inactivePatients.map(p => (
            <li key={`i${p.userId}`} style={{ padding: '0.75rem', borderRadius: '0.65rem', background: '#FEF3C7', border: '0.5px solid #FCD34D', color: '#78350F', fontSize: '0.82rem' }}>
              <strong style={{ overflowWrap: 'anywhere' }}>{p.name}</strong> — {p.daysSinceLastSession === null ? t('panel_inactive_never') : t('panel_inactive_days', { n: p.daysSinceLastSession })}
            </li>
          ))}
          {data?.notableProgress.map(p => (
            <li key={`n${p.userId}`} style={{ padding: '0.75rem', borderRadius: '0.65rem', background: '#EAF0E6', border: '0.5px solid #A8B5A2', color: '#2F4A29', fontSize: '0.82rem' }}>
              <strong style={{ overflowWrap: 'anywhere' }}>{p.name}</strong> — {t('therapist_progress_improved')}
            </li>
          ))}
        </ul>
      )}
    </PanelBlock>
  )
}

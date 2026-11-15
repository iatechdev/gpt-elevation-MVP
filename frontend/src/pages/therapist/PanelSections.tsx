// ES-177 (B1): bloques del panel profesional. Cada uno tiene su estado (cargando / error con «Reintentar» propio / vacío / datos),
// muestra todo en palabras (sin emojis ni estrellas) y a quien no comparte lo nombra «Persona n» sin cifras ni correo.
// ES-309 (PR 1): en Cartografía (cg-card, Figures, Banner, Button, tokens --cg-*); sin estilos en línea. Ni la lógica ni los textos cambian.
import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Button, Figures } from '../../cartografia'
import { personInitial, personLabel } from './panelText'
import { activeThisWeek, averageMood, averageRating, daysSince, sessionIsNow, type PanelPerson } from './panelFormat'
import type { SectionState } from './useSection'
import './panel.css'

type T = (key: string, params?: Record<string, string | number>) => string

export interface UpcomingSession { id: number; patientId: number; scheduledAt: string; duration: number; status: string; patientName: string | null; patientOrdinal?: number | null; phase?: 'upcoming' | 'due' | 'in_progress' }
export interface AlertsData {
  inactivePatients: { userId: number; name: string; daysSinceLastSession: number | null }[]
  notableProgress: { userId: number; name: string; improved: true }[]
}

/** Cuadro de un bloque: título, y según el estado «Cargando», error con «Reintentar» (foco al botón tras reintentar) o el contenido. */
export function PanelBlock<S>({ id, title, label, state, t, children }: { id: string; title: ReactNode; label?: string; state: SectionState<S>; t: T; children: ReactNode }) {
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
    <section className="cg-card tp-block" aria-labelledby={`${id}-title`} aria-busy={state.status === 'loading'}>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{title}</h2>
      {state.status === 'loading' && <p role="status" className="tp-muted">{t('therapist_loading')}</p>}
      {state.status === 'error' && (
        <div role="alert" className="tp-state">
          <span className="cg-error">{t(state.denied ? 'panel_section_forbidden' : 'panel_section_error')}</span>
          {!state.denied && <button ref={retry} type="button" className="cg-btn cg-btn--ghost" aria-label={`${t('panel_retry')}: ${sectionName}`} onClick={() => { retried.current = true; state.reload() }}>{t('panel_retry')}</button>}
        </div>
      )}
      {state.status === 'ready' && <div className="tp-body">{children}</div>}
    </section>
  )
}

const oneDecimal = (n: number, locale: string) => n.toLocaleString(locale, { maximumFractionDigits: 1 })
const ofFive = (n: number | null, locale: string, t: T) => (n === null ? t('panel_no_data') : t('panel_of_five', { n: oneDecimal(n, locale) }))

export function SummaryBlock({ state, t, locale }: { state: SectionState<PanelPerson[]>; t: T; locale: string }) {
  const people = state.data ?? []
  const cards = [
    { id: 'people', label: t('panel_people'), value: String(people.length) },
    { id: 'active', label: t('panel_active_week'), value: String(activeThisWeek(people)) },
    { id: 'mood', label: t('panel_avg_mood'), value: ofFive(averageMood(people), locale, t) },
    { id: 'rating', label: t('panel_avg_rating'), value: ofFive(averageRating(people), locale, t) },
  ]
  return (
    <PanelBlock id="panel-summary" title={t('panel_summary')} state={state} t={t}>
      <Figures items={cards} />
    </PanelBlock>
  )
}

export function UpcomingBlock({ state, t, locale }: { state: SectionState<UpcomingSession[]>; t: T; locale: string }) {
  const navigate = useNavigate()
  const sessions = state.data ?? []
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <PanelBlock id="panel-upcoming" title={t('therapist_upcoming_sessions')} state={state} t={t}>
      {sessions.length === 0 ? <p className="tp-muted">{t('panel_no_upcoming')}</p> : (
        <ul className="cg-items">
          {sessions.map(session => {
            const isNow = session.phase === 'in_progress' || sessionIsNow(session.scheduledAt, session.duration)
            // ES-241: quien no autorizó compartir llega sin nombre y con un ordinal estable: se muestra «Persona n» (como en la lista de personas).
            const who = personLabel({ name: session.patientName, ordinal: session.patientOrdinal ?? 0 }, t('therapist_person'))
            return (
              <li key={session.id} className={`cg-item${isNow ? ' tp-item--now' : ''}`}>
                <div className="tp-row">
                  <div>
                    <p className="tp-name">{who}</p>
                    <p className="tp-facts">
                      {when(session.scheduledAt)} · {session.duration} min
                      {isNow && <strong> · {t('panel_now')}</strong>}
                    </p>
                  </div>
                  <Button variant={isNow ? 'primary' : 'ghost'} onClick={() => navigate(`/therapist/session/${session.id}`)}>
                    {isNow ? t('panel_start') : t('panel_open')}
                    <span className="cg-sr"> · {who}</span>
                  </Button>
                </div>
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
      {people.length === 0 ? <p className="tp-muted">{t('panel_no_people')}</p> : (
        <ul className="cg-items">
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
              <li key={p.id} className={`cg-item${p.active ? '' : ' tp-off'}`}>
                <div className="tp-row">
                  <div className="tp-who">
                    <div aria-hidden="true" className="tp-avatar">{personInitial(p)}</div>
                    <div>
                      <p className="tp-name">{label}{noAccess && <> — <span>{t('panel_no_access')}</span></>}</p>
                      {!noAccess && <p className="tp-facts">{facts.join(' · ')}</p>}
                    </div>
                  </div>
                  <div className="tp-acts">
                    {next && <Button onClick={() => navigate(`/therapist/session/${next.id}`)}>{t('panel_start')}<span className="cg-sr"> · {label}</span></Button>}
                    <Button variant="ghost" onClick={() => navigate(`/therapist/patient/${p.id}`)}>{t('panel_view_profile')}<span className="cg-sr"> · {label}</span></Button>
                  </div>
                </div>
                {noAccess && <Banner title={t('therapist_not_shared')} />}
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
    <PanelBlock id="panel-alerts" title={<>{t('panel_alerts')}{state.status === 'ready' && total > 0 ? ` (${total})` : ''}</>} label={t('panel_alerts')} state={state} t={t}>
      {total === 0 ? <p className="tp-muted">{t('panel_no_alerts')}</p> : (
        <ul className="cg-items">
          {data?.inactivePatients.map(p => (
            <li key={`i${p.userId}`} className="cg-item">
              <p className="tp-alert tp-wrap"><strong>{p.name}</strong> — {p.daysSinceLastSession === null ? t('panel_inactive_never') : t('panel_inactive_days', { n: p.daysSinceLastSession })}</p>
            </li>
          ))}
          {data?.notableProgress.map(p => (
            <li key={`n${p.userId}`} className="cg-item">
              <p className="tp-alert tp-wrap"><strong>{p.name}</strong> — {t('therapist_progress_improved')}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelBlock>
  )
}

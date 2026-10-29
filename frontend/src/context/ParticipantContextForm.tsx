import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { ContextError, contextRequest, emptyContext, type ContextSnapshot, type ParticipantContext } from './participantContext'
import countries from '../../../shared/participantCountries.json'
import './participantContext.css'
import { registerContextNavigationGuard } from './contextNavigationGuard'
import './resume/resume.css'
import { ResumeStarter } from './resume/ResumeStarter'
import { ContextExtras, ScalarMeta } from './resume/ContextExtras'
import { applySuggestions, cleanExtras, countSuggested, emptyFlags, removeAllSuggested, summarize, type ExtrasKey, type Flags, type Pending, type ScalarKey } from './resume/resumeLogic'
import { fill } from './resume/resumeCopy'
import { minutesToHours, parseHours } from './availability'

const HISTORY_PATH = '/app/context/resumes'
const EXTRAS_KEYS: ExtrasKey[] = ['experience', 'education', 'declaredSkills', 'languages', 'sector', 'totalYearsExperience']

type Entry = '' | 'personal' | 'professional' | 'soon'
type Phase = 'loading' | 'ready' | 'saving' | 'confirmed' | 'loadError' | 'expired'
export function Onboarding() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [draft, setDraft] = useState<ParticipantContext>({ ...emptyContext })
  const [entry, setEntry] = useState<Entry>('')
  // ES-122: la persona escribe HORAS por semana; el borrador y el servidor siguen en minutos. El texto se conserva tal cual mientras se escribe.
  const [hoursText, setHoursText] = useState('')
  // Si los minutos del borrador cambian por otra vía (carga, propuesta de la hoja de vida), el texto se actualiza; lo que la persona escribe y es coherente no se toca.
  useEffect(() => { setHoursText(current => { const parsed = parseHours(current); return parsed.valid && parsed.minutes === draft.availabilityMinutesPerWeek ? current : minutesToHours(draft.availabilityMinutesPerWeek) }) }, [draft.availabilityMinutesPerWeek])
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [conflict, setConflict] = useState(false)
  const [lostDraft, setLostDraft] = useState(false)
  // ES-109: marcas de «sugerido desde tu hoja de vida», sugerencias aparte (no sobrescriben) y resumen del último análisis. Nada de esto se guarda.
  const [flags, setFlags] = useState<Flags>(() => emptyFlags(emptyContext))
  const [pending, setPending] = useState<Pending>({})
  const [analysis, setAnalysis] = useState<{ found: number; empty: number; total: number } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [live, setLive] = useState('')
  const resultRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const busy = phase === 'saving'
  const dirty = snapshot !== null && JSON.stringify(draft) !== JSON.stringify(snapshot.context ?? emptyContext)
  useEffect(() => {
    const controller = new AbortController()
    void contextRequest(undefined, undefined, controller.signal).then(data => {
      setSnapshot(data); setDraft(data.context ?? { ...emptyContext }); setPhase('ready')
      setFlags(emptyFlags(data.context ?? emptyContext)); setPending({}); setAnalysis(null)
      setMessage(''); setConflict(false); setErrors([])
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setPhase(error instanceof ContextError && [401, 403].includes(error.status) ? 'expired' : 'loadError')
    })
    return () => controller.abort()
  }, [loadAttempt])
  useEffect(() => {
    if (!dirty && phase !== 'saving') return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, phase])
  useEffect(() => {
    if (!dirty && phase !== 'saving') return
    return registerContextNavigationGuard(() => phase === 'saving' || !window.confirm(t('context_leave')))
  }, [dirty, phase, t])
  useEffect(() => { if (message) errorRef.current?.focus() }, [message, errors])
  useEffect(() => { if (phase === 'confirmed') statusRef.current?.focus() }, [phase])
  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames([lang], { type: 'region' })
    return countries.map(code => ({ code, label: names.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label, lang))
  }, [lang])
  const timeZones = useMemo(() => [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone'), ...(draft.timeZone ? [draft.timeZone] : [])])].sort(), [draft.timeZone])
  function change<K extends keyof ParticipantContext>(key: K, value: ParticipantContext[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => previous.filter(field => field !== key)); setMessage('')
    if (key === 'profession' || key === 'interests') setFlags(previous => ({ ...previous, [key]: false })) // editar un valor sugerido le quita la marca
  }
  // ES-109: la hoja de vida propone; lo escrito por la persona no se pisa (la sugerencia queda aparte).
  const receive = (result: { suggestions: Parameters<typeof applySuggestions>[2] }) => {
    const merged = applySuggestions(draft, flags, result.suggestions)
    const summary = summarize(result.suggestions)
    setDraft(merged.draft); setFlags(merged.flags); setPending(merged.pending); setAnalysis(summary); setDetailsOpen(true); setMessage(''); setErrors([])
    setLive(fill(t('resume_done_live'), { found: summary.found, total: summary.total }))
    window.setTimeout(() => resultRef.current?.focus(), 0)
  }
  const resolvePending = (key: ScalarKey, use: boolean) => {
    const value = pending[key]
    setPending(previous => { const next = { ...previous }; delete next[key]; return next })
    if (use && value !== undefined) { setDraft(previous => ({ ...previous, [key]: value })); setFlags(previous => ({ ...previous, [key]: true })) }
  }
  const removeScalar = (key: 'profession' | 'interests') => { setDraft(previous => ({ ...previous, [key]: null })); setFlags(previous => ({ ...previous, [key]: false })) }
  const removeEverything = () => { const next = removeAllSuggested(draft, flags); setDraft(next.draft); setFlags(next.flags); setPending({}); setLive(t('resume_removed_all_live')) }
  const goManual = () => { setDetailsOpen(false); document.getElementById('preferredLanguage')?.focus() }
  const leave = (path: string) => {
    if (phase !== 'saving' && (!dirty || window.confirm(t('context_leave')))) navigate(path)
  }
  const reload = () => {
    if (dirty && !window.confirm(t('context_leave'))) return
    setPhase('loading'); setLoadAttempt(value => value + 1)
  }
  const save = async (action: 'save_draft' | 'continue') => {
    if (!snapshot || phase !== 'ready' || conflict) return
    const invalid = action === 'continue' ? [...(!draft.preferredLanguage ? ['preferredLanguage'] : []), ...(!entry ? ['entry'] : [])] : []
    const minutes = draft.availabilityMinutesPerWeek
    if (!parseHours(hoursText).valid || (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080))) invalid.push('availabilityMinutesPerWeek')
    if (invalid.length) { setErrors(invalid); setMessage('context_invalid'); return }
    const cleaned = cleanExtras(draft)
    if (cleaned.errors.length) { setErrors(cleaned.errors); setMessage('context_invalid'); setDetailsOpen(true); return }
    setPhase('saving'); setMessage(''); setErrors([])
    try {
      const data = await contextRequest({ schemaVersion: 2, expectedVersion: snapshot.version, action, context: cleaned.draft })
      setSnapshot(data); setDraft(data.context ?? { ...emptyContext })
      setFlags(emptyFlags(data.context ?? emptyContext)); setPending({}); setAnalysis(null) // lo guardado ya es de la persona: deja de verse como sugerido
      if (action === 'continue' && entry === 'personal') { navigate('/app/dashboard'); return }
      setPhase(action === 'continue' ? 'confirmed' : 'ready')
      if (action === 'save_draft') setMessage('context_draft_saved')
    } catch (error) {
      if (error instanceof ContextError && [401, 403].includes(error.status)) { setLostDraft(true); setPhase('expired'); return }
      setPhase('ready')
      if (error instanceof ContextError && error.status === 400 && error.code === 'schema_outdated') { setConflict(true); setMessage('resume_schema_outdated') }
      else if (error instanceof ContextError && error.status === 409) { setConflict(true); setMessage('context_conflict') }
      else if (error instanceof ContextError && error.status === 400) { setErrors(error.fields); setMessage('context_invalid') }
      else setMessage('context_save_error')
    }
  }
  const fieldError = (key: string) => errors.includes(key) ? <span id={`${key}-error`} className="context-error">{t(key === 'preferredLanguage' ? 'context_language_required' : 'context_invalid_field')}</span> : null
  const select = (key: 'preferredLanguage' | 'residenceCountry' | 'targetMarket' | 'timeZone') => (
    <div className="context-field" key={key}>
      <label htmlFor={key}>{t(`context_${key}`)}</label>
      <select id={key} className="elv-select" disabled={busy} value={draft[key] ?? ''} aria-invalid={errors.includes(key)}
        aria-describedby={errors.includes(key) ? `${key}-error` : undefined} onChange={event => {
          const value = event.target.value
          if (key === 'preferredLanguage') {
            const language = value === 'es' || value === 'en' ? value : null
            change(key, language); if (language) setLang(language)
          } else change(key, value || null)
        }}>
        <option value="">{t('context_unknown')}</option>
        {key === 'preferredLanguage' ? ['es', 'en'].map(value => <option key={value} value={value}>{t(`context_${value}`)}</option>)
          : key === 'timeZone' ? timeZones.map(value => <option key={value}>{value}</option>)
            : countryOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
      </select>
      {key === 'timeZone' && <button type="button" className="elv-btn elv-btn-ghost" disabled={busy} onClick={() => change('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone)}>{t('context_suggest')}</button>}
      {fieldError(key)}
    </div>
  )
  return <div className="participant-context-scope">
    <a className="context-skip elv-link" href="#context-main">{t('context_skip')}</a>
    <header className="context-header"><span>{t('logo')}</span><div className="elv-join" aria-label={t('context_preferredLanguage')}>
      {(['es', 'en'] as const).map(language => <button type="button" key={language} className={`elv-btn elv-join-item ${lang === language ? 'elv-btn-primary' : 'elv-btn-ghost'}`} aria-pressed={lang === language} onClick={() => setLang(language)}>{language.toUpperCase()}</button>)}
    </div></header>
    <main id="context-main" tabIndex={-1}>
      <h1>{t('context_title')}</h1><p>{t('context_intro')}</p>
      {phase === 'loading' ? <p role="status">{t('context_loading')}</p>
        : phase === 'loadError' ? <div role="alert"><p>{t('context_load_error')}</p><button className="elv-btn" onClick={reload}>{t('context_retry')}</button></div>
          : phase === 'expired' ? <div role="alert"><p>{t('context_expired')}{lostDraft ? ` ${t('context_expired_lost')}` : ''}</p><button className="elv-btn" onClick={() => leave('/login')}>{t('context_signin')}</button></div>
            : phase === 'confirmed' ? <div ref={statusRef} tabIndex={-1} role="status" className="elv-card context-confirmed">
              <h2>{t('context_saved')}</h2><div className="context-actions"><button className="elv-btn elv-btn-primary" onClick={() => setPhase('ready')}>{t('context_edit')}</button><Link className="elv-btn" to={HISTORY_PATH}>{t('resume_manage')}</Link><Link className="elv-btn" to="/app/evidence/resume-skills">{t('evidence.rs_banner_cta')}</Link></div>
            </div> : <>
              <ResumeStarter t={t} disabled={busy || conflict} historyPath={HISTORY_PATH} onResult={receive} onManual={goManual} />
              {analysis && <div ref={resultRef} tabIndex={-1} className="rs-card rs-tint" aria-labelledby="rs-found">
                <h2 id="rs-found">{t('resume_found_title')}</h2>
                <p><strong>{fill(t('resume_found_summary'), analysis)}</strong></p><p className="rs-help">{t('resume_found_help')}</p>
                <div className="rs-warn" role="note"><div><p><strong>{t('resume_unsaved_title')}</strong> {t('resume_unsaved_body')}</p></div></div>
                {countSuggested(flags) > 0 && <div className="rs-actions"><button type="button" className="elv-btn" disabled={busy} onClick={removeEverything}>{t('resume_remove_all')}</button></div>}
              </div>}
              <div className="rs-live" role="status" aria-live="polite">{live}</div>
              <form noValidate onSubmit={event => { event.preventDefault(); void save('continue') }}>
              <div className="elv-fieldset context-form" aria-busy={busy}>
                <fieldset className="elv-fieldset context-entries" aria-describedby={errors.includes('entry') ? 'entry-error' : undefined}>
                  <legend>{t('context_entry')}</legend>
                  {(['personal', 'professional', 'soon'] as const).map(value => <label key={value} className="context-entry">
                    <input className="elv-radio elv-radio-primary" type="radio" disabled={busy} name="entry" value={value} checked={entry === value} aria-invalid={errors.includes('entry')}
                      onChange={() => { setEntry(value); setErrors(previous => previous.filter(field => field !== 'entry')); setMessage('') }} />
                    <span>{t(`context_${value}`)}{value === 'soon' && <small>{t('context_soon_help')}</small>}</span>
                  </label>)}
                  {errors.includes('entry') && <span id="entry-error" className="context-error">{t('context_entry_required')}</span>}
                </fieldset>
                {select('preferredLanguage')}{select('residenceCountry')}{select('targetMarket')}{select('timeZone')}
                <details open={detailsOpen || errors.some(key => ['profession', 'interests', 'careerGoal', 'careerConstraints', 'availabilityMinutesPerWeek', ...EXTRAS_KEYS].includes(key))} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
                  <summary>{t('context_professional_details')}</summary>
                  {(['profession', 'interests', 'careerGoal', 'careerConstraints'] as const).map(key => <div className="context-field" key={key}>
                    <label htmlFor={key}>{t(`context_${key}`)}</label>
                    <textarea id={key} rows={key === 'profession' ? 2 : 3} className="elv-textarea" disabled={busy} maxLength={key === 'profession' ? 120 : 500} value={draft[key] ?? ''}
                      aria-invalid={errors.includes(key)} aria-describedby={`${key}-help${errors.includes(key) ? ` ${key}-error` : ''}`} onChange={event => change(key, event.target.value || null)} />
                    <small id={`${key}-help`}>{t(key === 'profession' ? 'context_limit120' : 'context_limit500')}</small>{fieldError(key)}
                    {(key === 'profession' || key === 'interests') && <ScalarMeta t={t} name={key} label={t(`context_${key}`)} flagged={flags[key] && draft[key] !== null} pending={pending[key]}
                      onRemove={() => removeScalar(key)} onUse={() => resolvePending(key, true)} onIgnore={() => resolvePending(key, false)} />}
                  </div>)}
                  <div className="context-field"><label htmlFor="availabilityMinutesPerWeek">{t('context_availabilityMinutesPerWeek')}</label>
                    <input id="availabilityMinutesPerWeek" type="text" inputMode="decimal" autoComplete="off" className="elv-input" disabled={busy} value={hoursText}
                      aria-invalid={errors.includes('availabilityMinutesPerWeek')} aria-describedby={`minutes-help${errors.includes('availabilityMinutesPerWeek') ? ' availabilityMinutesPerWeek-error' : ''}`}
                      onChange={event => { const text = event.target.value; setHoursText(text); const parsed = parseHours(text); if (parsed.valid) change('availabilityMinutesPerWeek', parsed.minutes) }} />
                    <small id="minutes-help">{t('context_minutes_help')}</small>{fieldError('availabilityMinutesPerWeek')}
                  </div>
                  <h3 className="rs-extras-title">{t('resume_extras_title')}</h3>
                  <ContextExtras t={t} lang={lang} draft={draft} flags={flags} pending={pending} busy={busy} errors={errors.filter((key): key is ExtrasKey => (EXTRAS_KEYS as string[]).includes(key))}
                    onChange={(nextDraft, nextFlags) => { setDraft(nextDraft); setFlags(nextFlags); setMessage('') }} onPending={resolvePending} />
                </details>
                {message && <div ref={errorRef} tabIndex={-1} role={message === 'context_draft_saved' ? 'status' : 'alert'} className={message === 'context_draft_saved' ? '' : 'context-error'}>{t(message)}</div>}
                <p role="status" aria-live="polite">{t(phase === 'saving' ? 'context_saving' : dirty ? 'context_unsaved' : snapshot?.completedAt ? 'context_saved' : snapshot?.version ? 'context_draft_saved' : 'context_empty')}</p>
                <div className="context-actions">
                  <button type="button" className="elv-btn elv-btn-ghost" disabled={busy} onClick={() => leave('/app/dashboard')}>{t('context_back')}</button>
                  {conflict ? <button type="button" className="elv-btn" disabled={busy} onClick={reload}>{t('context_reload')}</button> : <>
                    <button type="button" className="elv-btn" disabled={busy} onClick={() => void save('save_draft')}>{t('context_draft')}</button>
                    <button type="submit" className="elv-btn elv-btn-primary" disabled={busy}>{t(entry === 'personal' ? 'context_continue' : 'context_save')}</button>
                  </>}
                </div>
              </div>
            </form></>}
    </main>
  </div>
}

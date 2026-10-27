import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { ContextError, contextRequest, emptyContext, type ContextSnapshot, type ParticipantContext } from './participantContext'
import countries from '../../../shared/participantCountries.json'
import './participantContext.css'
import { registerContextNavigationGuard } from './contextNavigationGuard'

type Entry = '' | 'personal' | 'professional' | 'soon'
type Phase = 'loading' | 'ready' | 'saving' | 'confirmed' | 'loadError' | 'expired'
export function Onboarding() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [draft, setDraft] = useState<ParticipantContext>({ ...emptyContext })
  const [entry, setEntry] = useState<Entry>('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [conflict, setConflict] = useState(false)
  const [lostDraft, setLostDraft] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const busy = phase === 'saving'
  const dirty = snapshot !== null && JSON.stringify(draft) !== JSON.stringify(snapshot.context ?? emptyContext)
  useEffect(() => {
    const controller = new AbortController()
    void contextRequest(undefined, undefined, controller.signal).then(data => {
      setSnapshot(data); setDraft(data.context ?? { ...emptyContext }); setPhase('ready')
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
  }
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
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080)) invalid.push('availabilityMinutesPerWeek')
    if (invalid.length) { setErrors(invalid); setMessage('context_invalid'); return }
    setPhase('saving'); setMessage(''); setErrors([])
    try {
      const data = await contextRequest({ schemaVersion: 1, expectedVersion: snapshot.version, action, context: draft })
      setSnapshot(data); setDraft(data.context ?? { ...emptyContext })
      if (action === 'continue' && entry === 'personal') { navigate('/app/dashboard'); return }
      setPhase(action === 'continue' ? 'confirmed' : 'ready')
      if (action === 'save_draft') setMessage('context_draft_saved')
    } catch (error) {
      if (error instanceof ContextError && [401, 403].includes(error.status)) { setLostDraft(true); setPhase('expired'); return }
      setPhase('ready')
      if (error instanceof ContextError && error.status === 409) { setConflict(true); setMessage('context_conflict') }
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
              <h2>{t('context_saved')}</h2><button className="elv-btn elv-btn-primary" onClick={() => setPhase('ready')}>{t('context_edit')}</button>
            </div> : <form noValidate onSubmit={event => { event.preventDefault(); void save('continue') }}>
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
                <details open={errors.some(key => ['profession', 'interests', 'careerGoal', 'careerConstraints', 'availabilityMinutesPerWeek'].includes(key)) || undefined}>
                  <summary>{t('context_professional_details')}</summary>
                  {(['profession', 'interests', 'careerGoal', 'careerConstraints'] as const).map(key => <div className="context-field" key={key}>
                    <label htmlFor={key}>{t(`context_${key}`)}</label>
                    <textarea id={key} rows={key === 'profession' ? 2 : 3} className="elv-textarea" disabled={busy} maxLength={key === 'profession' ? 120 : 500} value={draft[key] ?? ''}
                      aria-invalid={errors.includes(key)} aria-describedby={`${key}-help${errors.includes(key) ? ` ${key}-error` : ''}`} onChange={event => change(key, event.target.value || null)} />
                    <small id={`${key}-help`}>{t(key === 'profession' ? 'context_limit120' : 'context_limit500')}</small>{fieldError(key)}
                  </div>)}
                  <div className="context-field"><label htmlFor="availabilityMinutesPerWeek">{t('context_availabilityMinutesPerWeek')}</label>
                    <input id="availabilityMinutesPerWeek" type="number" className="elv-input" disabled={busy} min={0} max={10080} step={1} value={draft.availabilityMinutesPerWeek ?? ''}
                      aria-invalid={errors.includes('availabilityMinutesPerWeek')} aria-describedby={`minutes-help${errors.includes('availabilityMinutesPerWeek') ? ' availabilityMinutesPerWeek-error' : ''}`}
                      onChange={event => change('availabilityMinutesPerWeek', event.target.value === '' ? null : event.target.valueAsNumber)} />
                    <small id="minutes-help">{t('context_minutes_help')}</small>{fieldError('availabilityMinutesPerWeek')}
                  </div>
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
            </form>}
    </main>
  </div>
}

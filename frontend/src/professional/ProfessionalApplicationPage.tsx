// ES-95: formulario público de solicitud para profesionales de psicología. Sin sesión, sin cuenta y sin guardar nada en el navegador.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { buildForm, submitApplication } from './api'
import { EMPTY, LIMITS, fileProblem, validate } from './validation'
import type { FieldKey, Values } from './validation'
import '../space/space.css'
import './professional.css'

type Phase = 'idle' | 'sending' | 'success' | 'network' | 'rate' | 'server'

export function ProfessionalApplicationPage() {
  const { lang, setLang } = useLanguage()
  const c = copy[lang]
  const [values, setValues] = useState<Values>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<FieldKey[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [trap, setTrap] = useState('')
  const lock = useRef(false)
  const title = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { document.title = `${c.title} · Elevation` }, [c.title])
  useEffect(() => { if (phase === 'success') title.current?.focus() }, [phase])

  const set = (key: keyof Values) => (value: string) => setValues(current => ({ ...current, [key]: value }))
  const has = (key: FieldKey) => errors.includes(key)
  const cvProblem = fileProblem(file)
  const cvMessage = cvProblem === 'type' ? c.cvType : cvProblem === 'size' ? c.cvSize : c.cvRequired
  const messageFor = (key: FieldKey) => key === 'cv' ? cvMessage : key === 'email' && values.email.trim() ? c.emailInvalid : key === 'profileUrl' ? c.urlInvalid : key === 'consent' ? c.consentRequired : c.invalid

  const focusFirst = (bad: FieldKey[]) => {
    const id = bad[0] === 'cv' ? 'pro-cv' : bad[0] === 'consent' ? 'pro-consent' : `pro-${bad[0]}`
    setTimeout(() => document.getElementById(id)?.focus(), 0)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (lock.current) return
    const bad = validate(values, file, consent)
    setErrors(bad)
    if (bad.length || !file) { setPhase('idle'); focusFirst(bad); return }
    lock.current = true; setPhase('sending')
    const result = await submitApplication(buildForm(values, file, lang, trap))
    lock.current = false
    if (result.status === 'ok') { setPhase('success'); setValues(EMPTY); setFile(null); setConsent(false); setErrors([]); return }
    if (result.status === 'invalid') { const bad2 = result.fields.length ? result.fields : (['cv'] as FieldKey[]); setErrors(bad2); setPhase('idle'); focusFirst(bad2); return }
    setPhase(result.status === 'rate_limited' ? 'rate' : result.status === 'server' ? 'server' : 'network')
  }

  const text = (key: keyof Values, label: string, opts: { required?: boolean; help?: string; type?: string; multiline?: boolean } = {}) => {
    const id = `pro-${key}`; const bad = has(key)
    const common = {
      id, name: key, value: values[key], maxLength: LIMITS[key], 'aria-invalid': bad || undefined,
      'aria-describedby': [opts.help ? `${id}-help` : '', bad ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
      onChange: (e: { target: { value: string } }) => set(key)(e.target.value), disabled: phase === 'sending',
    }
    return <div className="pro-field">
      <label htmlFor={id}>{label} · {opts.required ? c.required : c.optional}</label>
      {opts.multiline ? <textarea className="elv-textarea" rows={4} {...common} /> : <input className="elv-input" type={opts.type ?? 'text'} autoComplete="off" {...common} />}
      {opts.help && <small id={`${id}-help`}>{opts.help}</small>}
      {bad && <span id={`${id}-error`} className="pro-error">{messageFor(key)}</span>}
    </div>
  }

  const banner = phase === 'network' ? c.networkError : phase === 'rate' ? c.rateLimited : phase === 'server' ? c.serverError : errors.length ? c.invalidSummary : ''

  return <div className="space-scope space-page pro-page">
    <a className="space-skip space-scope" href="#pro-main">{c.skip}</a>
    <header>
      <Link className="elv-link" to="/">{c.home}</Link>
      <div role="group" aria-label={c.language} className="pro-lang">
        {(['es', 'en'] as const).map(l => <button key={l} type="button" className="elv-btn" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
      </div>
    </header>
    <main id="pro-main" tabIndex={-1}>
      {phase === 'success'
        ? <section className="space-card" aria-labelledby="pro-title">
          <h1 id="pro-title" ref={title} tabIndex={-1}>{c.successTitle}</h1>
          <p role="status">{c.successBody}</p>
          <Link className="elv-btn" to="/">{c.home}</Link>
        </section>
        : <section className="space-card" aria-labelledby="pro-title">
          <h1 id="pro-title">{c.title}</h1>
          <p>{c.intro}</p>
          <form onSubmit={onSubmit} noValidate aria-describedby={banner ? 'pro-banner' : undefined}>
            {banner && <p id="pro-banner" role="alert" className="pro-error">{banner}</p>}
            <div className="pro-grid">
              {text('name', c.name, { required: true })}
              {text('email', c.email, { required: true, type: 'email' })}
              {text('country', c.country, { required: true })}
              {text('profession', c.profession, { required: true })}
            </div>
            {text('licenseNumber', c.license, { help: c.licenseHelp })}
            {text('profileUrl', c.profile, { help: c.profileHelp, type: 'url' })}
            {text('message', c.message, { help: c.messageHelp, multiline: true })}
            <div className="pro-field">
              <label htmlFor="pro-cv">{c.cv} · {c.required}</label>
              <input id="pro-cv" ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={phase === 'sending'} aria-invalid={has('cv') || undefined}
                aria-describedby={`pro-cv-help${has('cv') ? ' pro-cv-error' : ''}`}
                onChange={e => { setFile(e.target.files?.[0] ?? null); setErrors(current => current.filter(k => k !== 'cv')) }} />
              <small id="pro-cv-help">{c.cvHelp}</small>
              {file && <p className="pro-file" role="status">{c.cvChosen}: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB){' '}
                <button type="button" className="elv-btn" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}>{c.cvRemove}</button></p>}
              {has('cv') && <span id="pro-cv-error" className="pro-error">{cvMessage}</span>}
            </div>
            <div className="pro-field pro-consent">
              <label><input id="pro-consent" type="checkbox" className="elv-checkbox" checked={consent} disabled={phase === 'sending'} aria-invalid={has('consent') || undefined}
                aria-describedby={has('consent') ? 'pro-consent-error' : undefined} onChange={e => setConsent(e.target.checked)} /> {c.consent}</label>
              {has('consent') && <span id="pro-consent-error" className="pro-error">{c.consentRequired}</span>}
            </div>
            <div className="pro-trap" aria-hidden="true"><label>Leave empty<input tabIndex={-1} autoComplete="off" name="bot_trap" value={trap} onChange={e => setTrap(e.target.value)} /></label></div>
            <div className="space-actions">
              <button type="submit" className="elv-btn elv-btn-primary" disabled={phase === 'sending'}>{phase === 'sending' ? c.sending : c.submit}</button>
            </div>
            <p className="space-note">{c.notice}</p>
          </form>
        </section>}
    </main>
  </div>
}

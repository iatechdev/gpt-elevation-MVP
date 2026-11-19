// ES-95: formulario público de solicitud para profesionales de psicología. Sin sesión, sin cuenta y sin guardar nada en el navegador.
// ES-328 (PR 2): en el marco público de Cartografía (cabecera, idioma, tema y pie los pone el marco) con las piezas del sistema; mismos textos, validación y envío.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { Button, CheckField, TextAreaField, TextField } from '../cartografia'
import { PublicFrame } from '../shell/frames'
import { copy } from './copy'
import { buildForm, submitApplication } from './api'
import { EMPTY, LIMITS, fileProblem, validate } from './validation'
import type { FieldKey, Values } from './validation'
import './applicationCartografia.css'

type Phase = 'idle' | 'sending' | 'success' | 'network' | 'rate' | 'server' | 'closed'

export function ProfessionalApplicationPage() {
  const { lang } = useLanguage()
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

  // ES-157: tras «no recibimos solicitudes» el envío queda inactivo hasta que la persona edite algo (reintentar).
  const reopen = () => setPhase(current => current === 'closed' ? 'idle' : current)
  const set = (key: keyof Values) => (value: string) => { reopen(); setValues(current => ({ ...current, [key]: value })) }
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
    setPhase(result.status === 'rate_limited' ? 'rate' : result.status === 'closed' ? 'closed' : result.status === 'server' ? 'server' : 'network')
  }

  // Campo de texto con etiqueta visible «· obligatorio/opcional», ayuda y error por campo (aria-invalid y aria-describedby los pone TextField/TextAreaField).
  const field = (key: keyof Values, label: string, opts: { required?: boolean; help?: string; type?: string; multiline?: boolean } = {}) => {
    const common = {
      id: `pro-${key}`, name: key, label: `${label} · ${opts.required ? c.required : c.optional}`, value: values[key], maxLength: LIMITS[key],
      hint: opts.help, error: has(key) ? messageFor(key) : undefined, disabled: phase === 'sending',
      onChange: (e: { target: { value: string } }) => set(key)(e.target.value),
    }
    return opts.multiline ? <TextAreaField rows={4} {...common} /> : <TextField type={opts.type ?? 'text'} autoComplete="off" {...common} />
  }

  const banner = phase === 'network' ? c.networkError : phase === 'rate' ? c.rateLimited : phase === 'closed' ? c.closed : phase === 'server' ? c.serverError : errors.length ? c.invalidSummary : ''

  return <PublicFrame migrated>
    <div className="pa">
      {phase === 'success'
        ? <section className="pa-success" aria-labelledby="pro-title">
          <div className="cg-card">
            <h1 id="pro-title" ref={title} tabIndex={-1}>{c.successTitle}</h1>
            <p role="status">{c.successBody}</p>
            <Link className="cg-btn" to="/">{c.home}</Link>
          </div>
        </section>
        : <section aria-labelledby="pro-title">
          <div className="cg-card">
            <h1 id="pro-title">{c.title}</h1>
            <p>{c.intro}</p>
            <form onSubmit={onSubmit} noValidate aria-describedby={banner ? 'pro-banner' : undefined}>
              {banner && <div id="pro-banner" role="alert" className="cg-banner cg-banner--error"><span className="cg-banner__title">{banner}</span></div>}
              <div className="pa-pair">
                {field('name', c.name, { required: true })}
                {field('email', c.email, { required: true, type: 'email' })}
                {field('country', c.country, { required: true })}
                {field('profession', c.profession, { required: true })}
              </div>
              {field('licenseNumber', c.license, { help: c.licenseHelp })}
              {field('profileUrl', c.profile, { help: c.profileHelp, type: 'url' })}
              {field('message', c.message, { help: c.messageHelp, multiline: true })}
              <div className="cg-field">
                <label className="cg-label" htmlFor="pro-cv">{c.cv} · {c.required}</label>
                <input id="pro-cv" ref={fileInput} className="cg-input" type="file" accept="application/pdf,.pdf" disabled={phase === 'sending'} aria-invalid={has('cv') || undefined}
                  aria-describedby={`pro-cv-help${has('cv') ? ' pro-cv-error' : ''}`}
                  onChange={e => { reopen(); setFile(e.target.files?.[0] ?? null); setErrors(current => current.filter(k => k !== 'cv')) }} />
                <p className="cg-hint" id="pro-cv-help">{c.cvHelp}</p>
                {file && <p className="pa-file" role="status">{c.cvChosen}: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB){' '}
                  <Button variant="ghost" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}>{c.cvRemove}</Button></p>}
                {has('cv') && <p id="pro-cv-error" className="cg-error">{cvMessage}</p>}
              </div>
              <div className="cg-field">
                <CheckField id="pro-consent" checked={consent} disabled={phase === 'sending'} aria-invalid={has('consent') || undefined}
                  aria-describedby={has('consent') ? 'pro-consent-error' : undefined} onChange={e => { reopen(); setConsent(e.target.checked) }} label={c.consent} />
                {has('consent') && <p id="pro-consent-error" className="cg-error">{c.consentRequired}</p>}
              </div>
              <div className="pa-trap" aria-hidden="true"><label>Leave empty<input tabIndex={-1} autoComplete="off" name="bot_trap" value={trap} onChange={e => setTrap(e.target.value)} /></label></div>
              <div className="pa-actions">
                <Button type="submit" disabled={phase === 'sending' || phase === 'closed'} aria-busy={phase === 'sending' || undefined}>{phase === 'sending' ? c.sending : c.submit}</Button>
              </div>
              <p className="pa-notice">{c.notice}</p>
            </form>
          </div>
        </section>}
    </div>
  </PublicFrame>
}

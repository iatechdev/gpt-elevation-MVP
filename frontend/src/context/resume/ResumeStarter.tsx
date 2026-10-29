// ES-109: tarjeta «Empieza desde tu hoja de vida» (maqueta aprobada): elegir PDF → autorización → analizando → listo / error.
// Nada sale del dispositivo hasta que la persona marca la autorización y pulsa «Analizar». Lo sugerido NO se guarda aquí: se entrega al formulario.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyzeResume, checkFile, setResumeConsent, type AnalyzeResult, type ErrorCode } from './resumeApi'
import { fill } from './resumeCopy'

type Stage = 'idle' | 'picked' | 'analyzing' | 'error' | 'done'
type Ok = Extract<AnalyzeResult, { status: 'ok' }>
type Props = {
  t: (key: string) => string
  disabled: boolean
  historyPath: string
  onResult: (result: Ok) => void
  onManual: () => void
}
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const FILE_ERRORS: ErrorCode[] = ['empty', 'not_pdf', 'too_large']
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000'.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16)))

export function ResumeStarter({ t, disabled, historyPath, onResult, onManual }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false) // siempre parte desmarcada: la autorización es explícita en cada análisis
  const [error, setError] = useState<ErrorCode | null>(null)
  const [saved, setSaved] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [live, setLive] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const abort = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort() } }, [])
  useEffect(() => {
    if (stage !== 'analyzing') return
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [stage])
  useEffect(() => { if (stage === 'picked' || stage === 'error' || stage === 'analyzing' || stage === 'done') heading.current?.focus() }, [stage])

  function pick(chosen: File | null | undefined) {
    if (!chosen) return
    const problem = checkFile(chosen)
    setFile(chosen); setSaved(false)
    if (problem) { setError(problem); setStage('error'); return }
    setError(null); setStage('picked')
  }
  function reset() { abort.current?.abort(); setFile(null); setError(null); setStage('idle'); if (input.current) input.current.value = '' }

  async function run() {
    if (!file || !consent || disabled) return
    const controller = new AbortController(); abort.current = controller
    setSeconds(0); setStage('analyzing'); setError(null)
    if (!(await setResumeConsent(true))) { if (mounted.current) { setError('consent_required'); setStage('error') } return }
    const result = await analyzeResume(file, newId(), controller.signal)
    if (!mounted.current) return
    if (result.status === 'ok') { setSaved(true); setStage('done'); setFile(null); if (input.current) input.current.value = ''; onResult(result); return }
    if (result.code === 'cancelled') { setLive(t('resume_cancelled_live')); setStage('picked'); return }
    setSaved(Boolean(result.resume)); setError(result.code); setStage('error')
  }

  const fileProblem = error !== null && FILE_ERRORS.includes(error)
  return (
    <section className="rs-card rs-tint" aria-labelledby="rs-heading" aria-busy={stage === 'analyzing'}>
      <div className="rs-live" role="status" aria-live="polite">{live}</div>
      {stage === 'idle' && <>
        <span className="rs-badge rs-badge-sage">{t('resume_badge')}</span>
        <h2 id="rs-heading" ref={heading} tabIndex={-1}>{t('resume_title')}</h2>
        <p>{t('resume_intro')}</p>
        <p className="rs-pdf"><DocIcon /> <span id="rs-pdf-note">{t('resume_pdf_notice')}</span></p>
        <div className={`rs-drop${dragging ? ' rs-drop-active' : ''}`}
          onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) pick(event.dataTransfer.files?.[0]) }}>
          <UploadIcon />
          <p><strong>{t('resume_drop_title')}</strong></p><p className="rs-help">{t('resume_or')}</p>
          <button type="button" className="elv-btn elv-btn-primary" disabled={disabled} aria-describedby="rs-pdf-note" onClick={() => input.current?.click()}>{t('resume_choose')}</button>
        </div>
        <input ref={input} type="file" accept="application/pdf,.pdf" hidden tabIndex={-1} aria-hidden="true" onChange={event => pick(event.target.files?.[0])} />
        <p className="rs-help"><LockIcon /> {t('resume_nothing_sent')}</p>
        <div className="rs-actions"><button type="button" className="elv-btn" onClick={onManual}>{t('resume_manual')}</button></div>
      </>}

      {stage === 'picked' && file && <>
        <h2 id="rs-heading" ref={heading} tabIndex={-1}>{t('resume_before_title')}</h2>
        <div className="rs-file"><DocIcon /><div><strong>{file.name}</strong><br /><small>PDF · {Math.max(1, Math.round(file.size / 1024))} KB</small></div>
          <button type="button" className="elv-btn elv-btn-ghost" onClick={reset}>{t('resume_remove_file')}</button></div>
        <p className="rs-help">{t('resume_file_local')}</p>
        <div className="rs-box">
          <h3>{t('resume_consent_title')}</h3>
          <label className="rs-consent"><input type="checkbox" className="elv-checkbox elv-checkbox-primary" checked={consent} onChange={event => setConsent(event.target.checked)} aria-describedby={consent ? undefined : 'rs-consent-hint'} />
            <span>{t('resume_consent_label')}</span></label>
          <details open><summary>{t('resume_what_happens')}</summary>
            <ul><li>{t('resume_wh_1')}</li><li>{t('resume_wh_2')}</li><li>{t('resume_wh_3')}</li><li>{t('resume_wh_4')}</li></ul>
            <p className="rs-help">{t('resume_best_effort')}</p></details>
          {!consent && <p className="rs-help" id="rs-consent-hint">{t('resume_consent_hint')}</p>}
        </div>
        <div className="rs-actions">
          <button type="button" className="elv-btn" onClick={reset}>{t('resume_back')}</button>
          <button type="button" className="elv-btn elv-btn-primary" disabled={!consent || disabled} onClick={() => void run()}>{t('resume_analyze')}</button>
        </div>
      </>}

      {stage === 'analyzing' && <>
        <h2 id="rs-heading" ref={heading} tabIndex={-1}>{t('resume_analyzing_title')}</h2>
        <div className="rs-bar" aria-hidden="true"><i /></div>
        <p role="status">{t('resume_analyzing_wait')}</p>
        <p className="rs-help">{fill(t('resume_elapsed'), { time: clock(seconds) })}</p>
        <div className="rs-box"><h3>{t('resume_meanwhile_title')}</h3><p className="rs-help">{t('resume_meanwhile_body')}</p></div>
        <div className="rs-actions"><button type="button" className="elv-btn" onClick={() => abort.current?.abort()}>{t('resume_cancel')}</button></div>
      </>}

      {stage === 'error' && error && <>
        <div role="alert" className="rs-error">
          <h2 id="rs-heading" ref={heading} tabIndex={-1}>{t('resume_err_title')}</h2>
          <p>{t(`resume_err_${error}`)}</p>
          {saved && error !== 'resume_limit' && <p className="rs-help">{t('resume_kept_saved')}</p>}
        </div>
        <div className="rs-actions">
          {error === 'resume_limit' ? <Link className="elv-btn elv-btn-primary" to={historyPath}>{t('resume_manage')}</Link>
            : <button type="button" className="elv-btn elv-btn-primary" onClick={() => (error === 'provider_unavailable' || error === 'network' || error === 'request_already_processed' || error === 'internal_error') && file && !fileProblem ? setStage('picked') : reset()}>
              {(error === 'provider_unavailable' || error === 'network' || error === 'request_already_processed' || error === 'internal_error') && file && !fileProblem ? t('resume_err_retry') : t('resume_err_other')}</button>}
          <button type="button" className="elv-btn" onClick={() => { reset(); onManual() }}>{t('resume_err_hand')}</button>
        </div>
      </>}

      {stage === 'done' && <>
        <h2 id="rs-heading" ref={heading} tabIndex={-1}>{t('resume_title')}</h2>
        {saved && <p className="rs-help"><LockIcon /> {t('resume_kept_saved')}</p>}
        <div className="rs-actions">
          <button type="button" className="elv-btn" onClick={reset}>{t('resume_upload_new')}</button>
          <Link className="elv-btn elv-btn-ghost" to={historyPath}>{t('resume_manage')}</Link>
        </div>
      </>}
    </section>
  )
}

const icon = { width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true, className: 'rs-ico' } as const
const DocIcon = () => <svg {...icon}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
const UploadIcon = () => <svg {...icon} width={36} height={36}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
const LockIcon = () => <svg {...icon} width={16} height={16}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>

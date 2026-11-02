// ES-109: «Mis hojas de vida». Solo la persona dueña ve, descarga y borra sus versiones (el servidor lo verifica en cada acceso).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { MAX_VERSIONS, deleteResume, fetchResumeBlob, listResumes, readResumeConsent, setResumeConsent, type ResumeMeta } from './resumeApi'
import { fill } from './resumeCopy'
import './resume.css'

type Phase = 'loading' | 'ready' | 'error'
const CONTEXT_PATH = '/app/onboarding'

export function ResumesPage() {
  const { t, lang, setLang } = useLanguage()
  const [phase, setPhase] = useState<Phase>('loading')
  const [items, setItems] = useState<ResumeMeta[]>([])
  const [max, setMax] = useState(MAX_VERSIONS)
  const [consent, setConsent] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'delete'; item: ResumeMeta } | { kind: 'withdraw' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [alert, setAlert] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const apply = useCallback((data: Awaited<ReturnType<typeof listResumes>>, granted: boolean) => {
    if (!data) { setPhase('error'); return }
    setItems(data.resumes); setMax(data.maxVersions); setConsent(granted); setPhase('ready')
  }, [])
  // Recarga desde un manejador (reintentar, tras borrar): muestra «cargando» y vuelve a pedir.
  const load = useCallback(async () => { setPhase('loading'); apply(await listResumes(), await readResumeConsent()) }, [apply])
  // Carga inicial: el estado ya parte en «cargando»; solo se actualiza cuando llega la respuesta.
  useEffect(() => {
    let alive = true
    void Promise.all([listResumes(), readResumeConsent()]).then(([data, granted]) => { if (alive) apply(data, granted) })
    return () => { alive = false }
  }, [apply])
  useEffect(() => { if (confirm) dialog.current?.focus() }, [confirm])
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', year: 'numeric' })
  const ask = (next: NonNullable<typeof confirm>, event: React.MouseEvent<HTMLElement>) => { opener.current = event.currentTarget; setConfirm(next); setAlert(''); setMessage('') }
  const close = () => { setConfirm(null); window.setTimeout(() => opener.current?.focus(), 0) } // el foco vuelve a quien abrió la confirmación

  async function open(item: ResumeMeta, download: boolean) {
    setAlert('')
    const blob = await fetchResumeBlob(item.id)
    if (!blob) { setAlert(t('resume_open_error')); return }
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    if (download) { const a = document.createElement('a'); a.href = url; a.download = `hoja-de-vida-v${item.version}.pdf`; a.click() } else window.open(url, '_blank', 'noopener')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  async function confirmDelete(item: ResumeMeta) {
    setBusy(true)
    const ok = await deleteResume(item.id)
    setBusy(false)
    if (!ok) { setAlert(t('resume_delete_error')); return }
    setConfirm(null); setMessage(t('resume_deleted_live')); await load()
  }
  async function confirmWithdraw() {
    setBusy(true)
    const ok = await setResumeConsent(false)
    setBusy(false)
    if (!ok) { setAlert(t('resume_withdraw_error')); return }
    setConfirm(null); setMessage(t('resume_withdrawn_live')); await load()
  }

  return (
    <div className="participant-context-scope rs-page">
      <a className="context-skip elv-link" href="#rs-main">{t('context_skip')}</a>
      <header className="context-header"><span>{t('logo')}</span><div className="elv-join" aria-label={t('context_preferredLanguage')}>
        {(['es', 'en'] as const).map(language => <button type="button" key={language} className={`elv-btn elv-join-item ${lang === language ? 'elv-btn-primary' : 'elv-btn-ghost'}`} aria-pressed={lang === language} onClick={() => setLang(language)}>{language.toUpperCase()}</button>)}
      </div></header>
      <main id="rs-main" tabIndex={-1}>
        <h1>{t('resume_hist_title')}</h1>
        <p className="rs-help"><LockIcon /> {t('resume_hist_private')}</p>
        <div className="rs-live" role="status" aria-live="polite">{message}</div>
        {message && <p className="rs-ok">{message}</p>}
        {alert && <p className="rs-err" role="alert">{alert}</p>}

        {phase === 'loading' && <p role="status">{t('resume_hist_loading')}</p>}
        {phase === 'error' && <div role="alert" className="rs-error"><p>{t('resume_hist_error')}</p><button type="button" className="elv-btn" onClick={() => void load()}>{t('resume_hist_retry')}</button></div>}

        {phase === 'ready' && <>
          <section className="rs-card" aria-labelledby="rs-versions">
            <div className="rs-meta"><h2 id="rs-versions">{t('resume_hist_versions')}</h2><span className="rs-badge">{fill(t('resume_hist_count'), { n: items.length, max })}</span></div>
            {items.length === 0 ? <p>{t('resume_hist_empty')}</p> : <ul className="rs-versions">
              {items.map((item, index) => <li className="rs-ver" key={item.id}>
                <div><strong>{fill(t('resume_version'), { n: item.version })}</strong> {index === 0 && <span className="rs-badge rs-badge-sage">{t('resume_current')}</span>}
                  <br /><small>{date(item.createdAt)} · PDF · {Math.max(1, Math.round(item.size / 1024))} KB</small></div>
                <div className="rs-acts">
                  <button type="button" className="elv-btn elv-btn-ghost" disabled={busy} aria-label={`${t('resume_view')}: ${fill(t('resume_version'), { n: item.version })}`} onClick={() => void open(item, false)}>{t('resume_view')}</button>
                  <button type="button" className="elv-btn elv-btn-ghost" disabled={busy} aria-label={`${t('resume_download')}: ${fill(t('resume_version'), { n: item.version })}`} onClick={() => void open(item, true)}>{t('resume_download')}</button>
                  <button type="button" className="elv-btn elv-btn-ghost rs-danger" disabled={busy} aria-label={`${t('resume_delete')}: ${fill(t('resume_version'), { n: item.version })}`} onClick={event => ask({ kind: 'delete', item }, event)}>{t('resume_delete')}</button>
                </div></li>)}
            </ul>}
            <div className="rs-actions"><Link className="elv-btn elv-btn-primary" to={CONTEXT_PATH}>{t('resume_upload_new')}</Link></div>
          </section>

          {confirm?.kind === 'delete' && <div ref={dialog} tabIndex={-1} role="alertdialog" aria-labelledby="rs-del-title" aria-describedby="rs-del-body" className="rs-card rs-danger-card">
            <h3 id="rs-del-title">{fill(t('resume_delete_title'), { n: confirm.item.version, date: date(confirm.item.createdAt) })}</h3><p id="rs-del-body">{t('resume_delete_body')}</p>
            <div className="rs-actions"><button type="button" className="elv-btn rs-danger" disabled={busy} onClick={() => void confirmDelete(confirm.item)}>{t('resume_delete_yes')}</button>
              <button type="button" className="elv-btn" disabled={busy} onClick={close}>{t('resume_cancel_btn')}</button></div></div>}

          {consent && <section className="rs-card" aria-labelledby="rs-withdraw">
            <h3 id="rs-withdraw">{t('resume_withdraw_title')}</h3><p className="rs-help">{t('resume_withdraw_body')}</p>
            <div className="rs-actions"><button type="button" className="elv-btn rs-danger" disabled={busy} onClick={event => ask({ kind: 'withdraw' }, event)}>{t('resume_withdraw')}</button></div></section>}

          {confirm?.kind === 'withdraw' && <div ref={dialog} tabIndex={-1} role="alertdialog" aria-labelledby="rs-wd-title" aria-describedby="rs-wd-body" className="rs-card rs-danger-card">
            <h3 id="rs-wd-title">{t('resume_withdraw_confirm_title')}</h3><p id="rs-wd-body">{t('resume_withdraw_confirm_body')}</p>
            <div className="rs-actions"><button type="button" className="elv-btn rs-danger" disabled={busy} onClick={() => void confirmWithdraw()}>{t('resume_withdraw_yes')}</button>
              <button type="button" className="elv-btn" disabled={busy} onClick={close}>{t('resume_cancel_btn')}</button></div></div>}
        </>}
        <p><Link className="elv-link" to={CONTEXT_PATH}>{t('resume_back_context')}</Link></p>
      </main>
    </div>
  )
}

const LockIcon = () => <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" className="rs-ico"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>

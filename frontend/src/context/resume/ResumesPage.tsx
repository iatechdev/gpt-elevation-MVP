// ES-109: «Mis hojas de vida». Solo la persona dueña ve, descarga y borra sus versiones (el servidor lo verifica en cada acceso).
import '../register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { Banner, Button, Card, Chip, Dialog, ItemList } from '../../cartografia'
import { Notice, PersonScreen } from '../../space/PersonScreen'
import { MAX_VERSIONS, checkResumeConsent, deleteResume, fetchResumeBlob, listResumes, readResumeConsent, setResumeConsent, type ResumeMeta } from './resumeApi'
import { fill } from './resumeCopy'

type Phase = 'loading' | 'ready' | 'error'
const CONTEXT_PATH = '/app/onboarding'

export function ResumesPage() {
  const { t, lang } = useLanguage()
  const [phase, setPhase] = useState<Phase>('loading')
  const [items, setItems] = useState<ResumeMeta[]>([])
  const [max, setMax] = useState(MAX_VERSIONS)
  const [consent, setConsent] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'delete'; item: ResumeMeta } | { kind: 'withdraw' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [alert, setAlert] = useState('')
  const [unsure, setUnsure] = useState(false) // ES-248: el retiro de la autorización quedó incierto: «Comprobar» relee el estado real

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
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', year: 'numeric' })
  const ask = (next: NonNullable<typeof confirm>) => { setConfirm(next); setAlert(''); setMessage('') }
  const close = () => setConfirm(null) // ES-308: el <Dialog> de Cartografía devuelve el foco a quien abrió la confirmación (y atrapa Tab, cierra con Esc)

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
  // ES-248: retirar la autorización BORRA las hojas de vida (ES-109). Si la respuesta se pierde, el servidor pudo haberlo hecho: se relee el estado real antes de decir algo.
  async function verifyWithdraw() {
    setBusy(true); setAlert(''); setMessage('')
    const real = await checkResumeConsent()
    setBusy(false)
    if (real === 'unknown') { setUnsure(true); setAlert(t('resume_withdraw_unsure')); return }
    if (real === 'not_granted') { setUnsure(false); setConfirm(null); setMessage(t('resume_withdrawn_live')); await load(); return }
    setUnsure(true); setConfirm(null); setAlert(t('resume_withdraw_not_seen')); await load()
  }
  async function confirmWithdraw() {
    setBusy(true); setUnsure(false)
    const result = await setResumeConsent(false)
    setBusy(false)
    if (result === 'rejected') { setAlert(t('resume_withdraw_error')); return } // respuesta definitiva: no se retiró
    if (result === 'uncertain') { setConfirm(null); await verifyWithdraw(); return }
    setConfirm(null); setMessage(t('resume_withdrawn_live')); await load()
  }

  const who = (item: ResumeMeta) => fill(t('resume_version'), { n: item.version })
  const dialogOpen = confirm !== null
  const dialogTitle = confirm?.kind === 'delete' ? fill(t('resume_delete_title'), { n: confirm.item.version, date: date(confirm.item.createdAt) }) : t('resume_withdraw_confirm_title')
  const dialogBody = confirm?.kind === 'delete' ? t('resume_delete_body') : t('resume_withdraw_confirm_body')
  const dialogYes = confirm?.kind === 'delete' ? t('resume_delete_yes') : t('resume_withdraw_yes')
  const dialogGo = () => { if (confirm?.kind === 'delete') void confirmDelete(confirm.item); else void confirmWithdraw() }

  return (
    <PersonScreen title={t('resume_hist_title')} lead={t('resume_hist_private')}>
      <Notice text={message} />
      <Notice error text={alert} />
      {unsure && <div className="pg-actions"><Button variant="ghost" disabled={busy} onClick={() => void verifyWithdraw()}>{t('resume_check')}</Button></div>}

      {phase === 'loading' && <p className="cg-hint" role="status">{t('resume_hist_loading')}</p>}
      {phase === 'error' && <Banner kind="error" title={t('resume_hist_error')}><div className="pg-actions"><Button variant="ghost" onClick={() => void load()}>{t('resume_hist_retry')}</Button></div></Banner>}

      {phase === 'ready' && <>
        <Card as="section" className="pg-card"><div className="pg-meta"><h2 id="rs-versions">{t('resume_hist_versions')}</h2><Chip>{fill(t('resume_hist_count'), { n: items.length, max })}</Chip></div>
          {items.length === 0 ? <p>{t('resume_hist_empty')}</p> : <ItemList label={t('resume_hist_versions')} items={items.map((item, index) => ({
            id: String(item.id),
            top: <div className="pg-itemtop"><strong>{who(item)}</strong>{index === 0 && <Chip tone="ok" symbol="✓">{t('resume_current')}</Chip>}</div>,
            body: <>
              <small className="cg-hint">{date(item.createdAt)} · PDF · {Math.max(1, Math.round(item.size / 1024))} KB</small>
              <div className="pg-actions">
                <Button variant="ghost" disabled={busy} aria-label={`${t('resume_view')}: ${who(item)}`} onClick={() => void open(item, false)}>{t('resume_view')}</Button>
                <Button variant="ghost" disabled={busy} aria-label={`${t('resume_download')}: ${who(item)}`} onClick={() => void open(item, true)}>{t('resume_download')}</Button>
                <Button variant="ghost" disabled={busy} aria-label={`${t('resume_delete')}: ${who(item)}`} onClick={() => ask({ kind: 'delete', item })}>{t('resume_delete')}</Button>
              </div></>,
          }))} />}
          <div className="pg-actions"><Link className="cg-btn" to={CONTEXT_PATH}>{t('resume_upload_new')}</Link></div>
        </Card>

        {consent && <Card as="section" className="pg-card"><h2 id="rs-withdraw">{t('resume_withdraw_title')}</h2><p>{t('resume_withdraw_body')}</p>
          <div className="pg-actions"><Button variant="danger" disabled={busy} onClick={() => ask({ kind: 'withdraw' })}>{t('resume_withdraw')}</Button></div></Card>}
      </>}
      {/* Fuera de «ready»: el diálogo sigue montado mientras se recarga la lista tras borrar o retirar. */}
      <Dialog open={dialogOpen} onClose={() => { if (!busy) close() }} title={dialogTitle}
        actions={<>
          <Button variant="ghost" disabled={busy} onClick={close}>{t('resume_cancel_btn')}</Button>
          <Button variant="danger" disabled={busy} onClick={dialogGo}>{dialogYes}</Button>
        </>}>
        <div className="pg-dialog"><p>{dialogBody}</p></div>
      </Dialog>
      <p><Link className="cg-linkbtn" to={CONTEXT_PATH}>{t('resume_back_context')}</Link></p>
    </PersonScreen>
  )
}


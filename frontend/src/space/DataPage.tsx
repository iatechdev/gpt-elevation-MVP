import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { invalidateStoredSession } from '../access/session'
import { dataCopy, sectionLabels } from './dataCopy'
import { confirmMatches, dataErrorKey, downloadExport, prepareExport, requestDeletion } from './dataRights'
import type { DataErrorKey, ExportPreview } from './dataRights'
import { useSpaceToken } from './hooks'
import { SpaceDialog } from './SpaceDialog'
import { SpaceShell } from './SpaceShell'
// ES-135 / ES-174 — «Mis datos»: descargar los datos personales (ES-23) y pedir la eliminación de la cuenta con un diálogo y una palabra de confirmación.
const MAX_TIMER = 2 ** 31 - 1
export function DataPage() {
  const { lang } = useLanguage(); const c = dataCopy[lang]; const token = useSpaceToken()
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [busy, setBusy] = useState<'prepare' | 'download' | 'delete' | null>(null)
  const [status, setStatus] = useState<{ k: DataErrorKey | 'downloaded' } | null>(null)
  const [failed, setFailed] = useState<'prepare' | 'download' | 'delete' | null>(null)
  const [expired, setExpired] = useState(false)
  const [open, setOpen] = useState(false); const [word, setWord] = useState(''); const [done, setDone] = useState(false)
  const [off, setOff] = useState(false)
  const alive = useRef(true); const deletedToken = useRef('')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // La sesión local se cierra al salir de la confirmación, no antes: si se invalidara al instante, la compuerta de acceso llevaría a /login y la persona nunca vería el resultado.
  useEffect(() => () => { if (deletedToken.current) invalidateStoredSession(deletedToken.current) }, [])
  // Estado «caducado»: al vencer la vista previa se retira el botón de descarga y se ofrece prepararla de nuevo.
  useEffect(() => {
    if (!preview) return
    const wait = Date.parse(preview.expiresAt) - Date.now()
    const expire = () => { setPreview(null); setExpired(true) }
    if (wait <= 0) { expire(); return }
    const timer = setTimeout(expire, Math.min(wait, MAX_TIMER))
    return () => clearTimeout(timer)
  }, [preview])
  const fail = (error: unknown, action: 'prepare' | 'download' | 'delete') => {
    if (!alive.current) return
    const k = dataErrorKey(error)
    if (k === 'unavailable') { setOff(true); setOpen(false); setWord('') } // función apagada en el servidor: no se ofrece ninguna acción
    setStatus({ k }); setFailed(action)
  }
  const prepare = async () => {
    if (busy) return
    setBusy('prepare'); setStatus(null); setFailed(null); setExpired(false)
    try { const next = await prepareExport(token, lang); if (alive.current) setPreview(next) }
    catch (error) { fail(error, 'prepare') } finally { if (alive.current) setBusy(null) }
  }
  const download = async () => {
    if (busy || !preview) return
    if (Date.parse(preview.expiresAt) <= Date.now()) { setPreview(null); setExpired(true); return }
    setBusy('download'); setStatus(null); setFailed(null)
    try {
      const blob = await downloadExport(token, preview.id)
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = 'elevation-personal.json'; link.click(); URL.revokeObjectURL(url)
      if (alive.current) setStatus({ k: 'downloaded' })
    } catch (error) { if (error instanceof Error && dataErrorKey(error) === 'expired') { setPreview(null); setExpired(true) } else fail(error, 'download') }
    finally { if (alive.current) setBusy(null) }
  }
  const matches = confirmMatches(word, c.confirmWord)
  const remove = async () => {
    if (busy || !matches) return
    setBusy('delete'); setStatus(null); setFailed(null)
    try {
      await requestDeletion(token) // idempotente en el servidor: una solicitud repetida también responde con recibo
      deletedToken.current = token
      if (alive.current) { setOpen(false); setDone(true); setPreview(null) }
    } catch (error) { fail(error, 'delete') } // el diálogo sigue abierto y lo escrito se conserva
    finally { if (alive.current) setBusy(null) }
  }
  const closeDialog = () => { if (busy === 'delete') return; setOpen(false); setWord(''); setStatus(null); setFailed(null) }
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en' : 'es', { hour: '2-digit', minute: '2-digit' })
  if (done) return <SpaceShell><h1>{c.title}</h1><p role="status">{c.deleteDone}</p><Link className="elv-btn elv-btn-primary" to="/">{c.backHome}</Link></SpaceShell>
  const message = status ? (status.k === 'downloaded' ? c.downloaded : c[status.k]) : ''
  const isError = !!status && status.k !== 'downloaded'
  const labels: Record<string, string> = sectionLabels[lang]
  const list = preview ? preview.sections.map(s => { const name = labels[s.name] ?? s.name; return s.count === null ? name : `${name} (${s.count})` }).join(' · ') : ''
  const statusNode = (id?: string) => <p id={id} role={isError ? 'alert' : 'status'} aria-live="polite" className={isError ? 'space-error' : 'space-note'}>
    {message}{status?.k === 'session' && <> <Link className="elv-link" to="/login">{c.login}</Link></>}
  </p>
  return <SpaceShell>
    <h1>{c.title}</h1><p>{c.intro}</p>
    {!open && statusNode()}
    <section className="elv-card space-card" aria-labelledby="data-export"><h2 id="data-export">{c.exportTitle}</h2><p>{c.exportBody}</p>
      {expired && !preview && <p className="space-note" role="status">{c.expiredNote}</p>}
      {!preview && <button className="elv-btn elv-btn-primary" disabled={!!busy || !token || off} onClick={() => void prepare()}>
        {busy === 'prepare' ? c.preparing : failed === 'prepare' ? c.retry : expired ? c.prepareAgain : c.prepare}</button>}
      {preview && <><p>{list ? c.sections.replace('{list}', list) : c.noSections}</p><p className="space-note">{c.validUntil.replace('{time}', time(preview.expiresAt))}</p>
        <button className="elv-btn elv-btn-primary" disabled={!!busy} onClick={() => void download()}>{busy === 'download' ? c.downloading : failed === 'download' ? c.retry : c.download}</button></>}
    </section>
    <section className="elv-card space-card" aria-labelledby="data-delete"><h2 id="data-delete">{c.deleteTitle}</h2><p>{c.deleteBody}</p>
      <button className="elv-btn space-danger" disabled={!!busy || !token || off} onClick={() => setOpen(true)}>{c.deleteStart}</button>
    </section>
    <SpaceDialog open={open} onClose={closeDialog} title={c.dialogTitle}>
      <ul id="data-consequences">{c.consequences.map(line => <li key={line}>{line}</li>)}</ul>
      <label htmlFor="data-confirm">{c.typeLabel.replace('{word}', c.confirmWord)}</label>
      <input id="data-confirm" className="elv-input" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="data-consequences data-dialog-status"
        value={word} disabled={busy === 'delete'} onChange={event => setWord(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (matches) void remove() } }} />
      {open && statusNode('data-dialog-status')}
      <div className="space-actions">
        <button className="elv-btn" disabled={busy === 'delete'} onClick={closeDialog}>{c.deleteCancel}</button>
        <button className="elv-btn space-danger" disabled={!matches || busy === 'delete'} onClick={() => void remove()}>{busy === 'delete' ? c.deleting : failed === 'delete' ? c.retry : c.deleteConfirm}</button>
      </div>
    </SpaceDialog>
  </SpaceShell>
}

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { invalidateStoredSession } from '../access/session'
import { dataCopy, sectionLabels } from './dataCopy'
import { dataErrorKey, downloadExport, prepareExport, requestDeletion } from './dataRights'
import type { DataErrorKey, ExportPreview } from './dataRights'
import { useSpaceToken } from './hooks'
import { SpaceShell } from './SpaceShell'
// ES-135 — «Mis datos»: exportar los datos personales (ES-23) y pedir la eliminación de la cuenta con confirmación en dos pasos.
export function DataPage() {
  const { lang } = useLanguage(); const c = dataCopy[lang]; const token = useSpaceToken()
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [busy, setBusy] = useState<'prepare' | 'download' | 'delete' | null>(null)
  const [status, setStatus] = useState<{ k: DataErrorKey | 'downloaded' } | null>(null)
  const [confirming, setConfirming] = useState(false); const [ack, setAck] = useState(false); const [done, setDone] = useState(false)
  const [off, setOff] = useState(false); const refocus = useRef(false)
  const alive = useRef(true); const startRef = useRef<HTMLButtonElement>(null); const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (confirming) panelRef.current?.querySelector('input')?.focus()
    else if (refocus.current) { refocus.current = false; startRef.current?.focus() } // QA-135-01: el botón de inicio se vuelve a montar al cerrar el paso 2
  }, [confirming])
  const fail = (error: unknown) => {
    if (!alive.current) return
    const k = dataErrorKey(error)
    if (k === 'unavailable') { setOff(true); setConfirming(false); setAck(false) } // función apagada en el servidor: no se ofrece ninguna acción
    setStatus({ k })
  }
  const prepare = async () => {
    if (busy) return
    setBusy('prepare'); setStatus(null)
    try { const next = await prepareExport(token, lang); if (alive.current) setPreview(next) }
    catch (error) { fail(error) } finally { if (alive.current) setBusy(null) }
  }
  const download = async () => {
    if (busy || !preview) return
    if (Date.parse(preview.expiresAt) <= Date.now()) { setPreview(null); setStatus({ k: 'expired' }); return }
    setBusy('download'); setStatus(null)
    try {
      const blob = await downloadExport(token, preview.id)
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = 'elevation-personal.json'; link.click(); URL.revokeObjectURL(url)
      if (alive.current) setStatus({ k: 'downloaded' })
    } catch (error) { if (error instanceof Error && dataErrorKey(error) === 'expired') setPreview(null); fail(error) }
    finally { if (alive.current) setBusy(null) }
  }
  const remove = async () => {
    if (busy || !ack) return
    setBusy('delete'); setStatus(null)
    try {
      await requestDeletion(token)
      invalidateStoredSession(token)
      if (alive.current) { setDone(true); setPreview(null) }
    } catch (error) { fail(error) } finally { if (alive.current) setBusy(null) }
  }
  const closePanel = () => { refocus.current = true; setConfirming(false); setAck(false) }
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en' : 'es', { hour: '2-digit', minute: '2-digit' })
  if (done) return <SpaceShell><h1>{c.title}</h1><p role="status">{c.deleteDone}</p><Link className="elv-btn elv-btn-primary" to="/">{c.backHome}</Link></SpaceShell>
  const message = status ? (status.k === 'downloaded' ? c.downloaded : c[status.k]) : ''
  const labels: Record<string, string> = sectionLabels[lang]
  const list = preview ? preview.sections.map(s => { const name = labels[s.name] ?? s.name; return s.count === null ? name : `${name} (${s.count})` }).join(' · ') : ''
  return <SpaceShell>
    <h1>{c.title}</h1><p>{c.intro}</p>
    <p role={status && status.k !== 'downloaded' ? 'alert' : 'status'} aria-live="polite" className={status && status.k !== 'downloaded' ? 'space-error' : 'space-note'}>
      {message}{status?.k === 'session' && <> <Link className="elv-link" to="/login">{c.login}</Link></>}
    </p>
    <section className="elv-card space-card" aria-labelledby="data-export"><h2 id="data-export">{c.exportTitle}</h2><p>{c.exportBody}</p>
      {!preview && <button className="elv-btn elv-btn-primary" disabled={!!busy || !token || off} onClick={() => void prepare()}>{busy === 'prepare' ? c.preparing : c.prepare}</button>}
      {preview && <><p>{list ? c.sections.replace('{list}', list) : c.noSections}</p><p className="space-note">{c.validUntil.replace('{time}', time(preview.expiresAt))}</p>
        <button className="elv-btn elv-btn-primary" disabled={!!busy} onClick={() => void download()}>{busy === 'download' ? c.downloading : c.download}</button></>}
    </section>
    <section className="elv-card space-card" aria-labelledby="data-delete"><h2 id="data-delete">{c.deleteTitle}</h2><p>{c.deleteBody}</p>
      {!confirming && <button ref={startRef} className="elv-btn space-danger" disabled={!!busy || !token || off} onClick={() => setConfirming(true)}>{c.deleteStart}</button>}
      {confirming && <div ref={panelRef} role="group" aria-label={c.deleteTitle} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); closePanel() } }}>
        <label><input className="elv-checkbox" type="checkbox" checked={ack} disabled={!!busy} onChange={event => setAck(event.target.checked)} /> {c.deleteAck}</label>
        <div className="space-actions"><button className="elv-btn space-danger" disabled={!ack || !!busy} onClick={() => void remove()}>{busy === 'delete' ? c.deleting : c.deleteConfirm}</button><button className="elv-btn" disabled={!!busy} onClick={closePanel}>{c.deleteCancel}</button></div>
      </div>}
    </section>
  </SpaceShell>
}

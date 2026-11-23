import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { signOut } from '../access/signOut'
import { endFarewell, startFarewell } from '../access/farewell'
import { dataCopy, describeSections } from './dataCopy'
import { confirmMatches, dataErrorKey, downloadExport, prepareExport, requestDeletion } from './dataRights'
import type { DataErrorKey, ExportPreview } from './dataRights'
import { useSpaceToken } from './hooks'
import { Button, Dialog, TextField } from '../cartografia'
import { Notice, PersonScreen } from './PersonScreen'
// ES-135 / ES-174 — «Mis datos»: descargar los datos personales (ES-23) y pedir la eliminación de la cuenta con un diálogo y una palabra de confirmación.
const MAX_TIMER = 2 ** 31 - 1
const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
export function DataPage() {
  const { pathname } = useLocation(); const { lang } = useLanguage(); const c = dataCopy[lang]; const token = useSpaceToken()
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [busy, setBusy] = useState<'prepare' | 'download' | 'delete' | null>(null)
  const [status, setStatus] = useState<{ k: DataErrorKey | 'downloaded' } | null>(null)
  const [failed, setFailed] = useState<'prepare' | 'download' | 'delete' | null>(null)
  const [expired, setExpired] = useState(false)
  const [open, setOpen] = useState(false); const [word, setWord] = useState(''); const [done, setDone] = useState(false)
  const [off, setOff] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; endFarewell() } }, [])
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
      // ES-346: la sesión local se cierra YA (mismo cierre que «Cerrar sesión»: token, nombre, rol, ruta de retorno, mensaje pendiente), antes del aviso. La marca deja a la compuerta
      // mostrar este aviso en vez de mandar a /login; se borra al salir de la pantalla.
      // Si la pantalla se desmontó mientras la solicitud estaba en vuelo, NO se arranca la marca (quedaría colgada): la sesión se cierra igual, sin aviso que mostrar.
      if (alive.current) startFarewell(pathname)
      await signOut(BACKEND)
      if (alive.current) { setOpen(false); setDone(true); setPreview(null) }
    } catch (error) { fail(error, 'delete') } // el diálogo sigue abierto y lo escrito se conserva
    finally { if (alive.current) setBusy(null) }
  }
  const closeDialog = () => { if (busy === 'delete') return; setOpen(false); setWord(''); setStatus(null); setFailed(null) }
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en' : 'es', { hour: '2-digit', minute: '2-digit' })
  if (done) return <PersonScreen title={c.title}><Notice text={c.deleteDone} /><div className="pg-actions"><Link className="cg-btn" to="/">{c.backHome}</Link></div></PersonScreen>
  const message = status ? (status.k === 'downloaded' ? c.downloaded : c[status.k]) : ''
  const isError = !!status && status.k !== 'downloaded'
  const list = preview ? describeSections(preview.sections, lang).join(' · ') : '' // ES-401: etiquetas legibles; las claves desconocidas, como «Otros datos»
  const statusNode = (id?: string) => <Notice id={id} error={isError} text={message}>
    {status?.k === 'session' && <> <Link className="cg-linkbtn" to="/login">{c.login}</Link></>}
  </Notice>
  return <PersonScreen title={c.title} lead={c.intro}>
    {!open && statusNode()}
    <section className="cg-card pg-card" aria-labelledby="data-export"><h2 id="data-export">{c.exportTitle}</h2><p>{c.exportBody}</p>
      {expired && !preview && <p className="cg-hint" role="status">{c.expiredNote}</p>}
      {!preview && <div className="pg-actions"><Button disabled={!!busy || !token || off} onClick={() => void prepare()}>
        {busy === 'prepare' ? c.preparing : failed === 'prepare' ? c.retry : expired ? c.prepareAgain : c.prepare}</Button></div>}
      {preview && <><p>{list ? c.sections.replace('{list}', list) : c.noSections}</p><p className="cg-hint">{c.validUntil.replace('{time}', time(preview.expiresAt))}</p>
        <div className="pg-actions"><Button disabled={!!busy} onClick={() => void download()}>{busy === 'download' ? c.downloading : failed === 'download' ? c.retry : c.download}</Button></div></>}
    </section>
    <section className="cg-card pg-card" aria-labelledby="data-delete"><h2 id="data-delete">{c.deleteTitle}</h2><p>{c.deleteBody}</p>
      <div className="pg-actions"><Button variant="danger" disabled={!!busy || !token || off} onClick={() => setOpen(true)}>{c.deleteStart}</Button></div>
    </section>
    <Dialog open={open} onClose={closeDialog} title={c.dialogTitle}
      actions={<>
        <Button variant="ghost" disabled={busy === 'delete'} onClick={closeDialog}>{c.deleteCancel}</Button>
        <Button variant="danger" disabled={!matches || busy === 'delete'} onClick={() => void remove()}>{busy === 'delete' ? c.deleting : failed === 'delete' ? c.retry : c.deleteConfirm}</Button>
      </>}>
      <div className="pg-dialog">
        <ul id="data-consequences">{c.consequences.map(line => <li key={line}>{line}</li>)}</ul>
        <TextField id="data-confirm" label={c.typeLabel.replace('{word}', c.confirmWord)} type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="data-consequences data-dialog-status"
          value={word} disabled={busy === 'delete'} onChange={event => setWord(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (matches) void remove() } }} />
        {open && statusNode('data-dialog-status')}
      </div>
    </Dialog>
  </PersonScreen>
}

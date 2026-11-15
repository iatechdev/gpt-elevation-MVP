// ES-95: «Solicitudes de profesionales» en el backoffice (admin y superadmin; el servidor lo verifica en cada acceso).
// Aprobar solo cambia el estado: la cuenta la crea el administrador con «Crear cuenta de profesional» (precargado con nombre y correo, por estado de navegación: sin datos en la URL).
// ES-184: pantalla en Cartografía (sin estilos en línea ni diálogos nativos del navegador); eliminar y revisar usan diálogo. Una solicitud minimizada por la purga (ES-293) solo muestra estado y fechas.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Button, Chip, Dialog, ItemList, TextAreaField, type ChipTone } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { capacityNotice, parseCapacity, type Capacity } from './applicationsCapacity'
import './adminContent.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

type Status = 'pending' | 'approved' | 'rejected'
type Application = {
  id: number; name: string; email: string; country: string; profession: string; licenseNumber: string | null; profileUrl: string | null
  message: string | null; locale: 'es' | 'en'; status: Status; reviewedBy: string | null; reviewNote: string | null; reviewedAt: string | null
  userId: number | null; createdAt: string; cv: { size: number } | null; minimized?: boolean
}

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pendientes' }, { key: 'approved', label: 'Aprobadas' }, { key: 'rejected', label: 'Rechazadas' }, { key: 'all', label: 'Todas' },
]
const STATUS_LABEL: Record<Status, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }
const TONE: Record<Status, ChipTone> = { pending: 'wait', approved: 'ok', rejected: 'bad' }
const SYMBOL: Record<Status, string> = { pending: '…', approved: '✓', rejected: '✗' }
const safeLink = (url: string | null) => { try { return url && /^https?:$/.test(new URL(url).protocol) ? url : null } catch { return null } }
const fmtDate = (iso: string | null, locale: string) => iso ? new Date(iso).toLocaleString(locale) : ''

export function ProfessionalApplicationsPanel({ onChanged }: { onChanged?: () => void }) {
  const tr = useAdminText()
  const locale = tr('es')
  const token = localStorage.getItem('elevation_token') ?? ''
  const [filter, setFilter] = useState<Status | 'all'>('pending')
  const [items, setItems] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null)
  const [removing, setRemoving] = useState<Application | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [dialogMsg, setDialogMsg] = useState('')
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const changed = useRef(onChanged); changed.current = onChanged

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications${filter === 'all' ? '' : `?status=${filter}`}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      setItems(await r.json())
    } catch { setError('No se pudieron cargar las solicitudes.'); setItems([]) } finally { setLoading(false) }
    // ES-107: ¿el tope global cerró el formulario público? Corre también tras aprobar, rechazar y eliminar (liberan cupo). Si falla, no hay aviso.
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/capacity`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      setCapacity(r.ok ? parseCapacity(await r.json()) : null)
    } catch { setCapacity(null) }
  }, [filter, token])
  useEffect(() => { void load() }, [load])

  const closeReview = () => { setOpen(null); setNote(''); setNoteError(''); setDialogMsg('') }
  const reviewing = open ? items.find(item => item.id === open.id) ?? null : null

  const review = async (item: Application, action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) { setNoteError('Escribe el motivo del rechazo.'); return }
    setBusy(item.id); setNoteError(''); setDialogMsg('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/${item.id}/${action}`, { method: 'PUT', headers, body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) })
      const data = await r.json().catch(() => ({}))
      if (r.ok) { closeReview(); setMsg(action === 'approve' ? 'Solicitud aprobada.' : 'Solicitud rechazada.') }
      else if (r.status === 409) { closeReview(); setMsg('Otra persona ya revisó esta solicitud.') }
      else setDialogMsg(data.error ?? 'No se pudo registrar la revisión.') // el diálogo sigue abierto y conserva la nota
      await load(); changed.current?.()
    } catch { setDialogMsg('Error de conexión.') } finally { setBusy(null) }
  }

  const remove = async (item: Application) => {
    setBusy(item.id); setDialogMsg('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/${item.id}`, { method: 'DELETE', headers })
      if (r.ok) { setRemoving(null); setMsg('Solicitud eliminada.'); await load(); changed.current?.() }
      else setDialogMsg('No se pudo eliminar la solicitud.')
    } catch { setDialogMsg('Error de conexión.') } finally { setBusy(null) }
  }

  // La descarga lleva la sesión: no hay una URL pública de la hoja de vida.
  const download = async (item: Application) => {
    setBusy(item.id); setMsg('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/${item.id}/cv`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(String(r.status))
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = `solicitud-${item.id}-hoja-de-vida.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setMsg('No se pudo descargar la hoja de vida.') } finally { setBusy(null) }
  }

  const notice = capacityNotice(capacity, tr)

  return (
    <section className="cg-card ac-panel" aria-labelledby="applications-title">
      <h2 id="applications-title">{tr('Solicitudes de profesionales')}</h2>
      <p className="cg-hint">{tr('Llegan desde el formulario público. Aprobar no crea la cuenta: después usa «Crear cuenta de profesional». Abre las hojas de vida solo en un visor aislado; no se analizan contra virus.')}</p>
      {notice && <div role="status" data-testid="capacity-notice"><Banner kind="note" title={`⚠ ${notice.title}`}>{notice.body}</Banner></div>}
      <div className="ac-filters" role="group" aria-label={tr('Filtrar por estado')}>
        {FILTERS.map(f => <Button key={f.key} variant={filter === f.key ? 'primary' : 'ghost'} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{tr(f.label)}</Button>)}
      </div>
      <p className="ac-status cg-hint" role="status">{msg ? tr(msg) : ''}</p>
      {loading && <p className="cg-hint">{tr('Cargando solicitudes...')}</p>}
      {error && <Banner kind="error" title={tr(error)}><Button variant="ghost" onClick={() => void load()}>{tr('Reintentar')}</Button></Banner>}
      {!loading && !error && items.length === 0 && <p className="cg-hint">{tr('No hay solicitudes en este estado.')}</p>}
      <ItemList label={tr('Solicitudes de profesionales')} items={items.map(item => {
        const profile = safeLink(item.profileUrl)
        if (item.minimized) {
          // ES-293: la purga dejó solo estado y fechas; no hay nombre, contacto, hoja de vida ni acciones.
          return {
            id: String(item.id),
            top: <div className="ac-row"><strong>{tr('Datos depurados')}</strong><Chip tone={TONE[item.status]} symbol={SYMBOL[item.status]}>{tr(STATUS_LABEL[item.status])}</Chip></div>,
            body: <p className="cg-hint ac-meta">{tr('Recibida')} {fmtDate(item.createdAt, locale)}</p>,
          }
        }
        return {
          id: String(item.id),
          top: <div className="ac-row"><strong>{item.name}</strong><Chip tone={TONE[item.status]} symbol={SYMBOL[item.status]}>{tr(STATUS_LABEL[item.status])}</Chip></div>,
          body: <>
            <p className="ac-meta"><a href={`mailto:${encodeURIComponent(item.email).replace('%40', '@')}`}>{item.email}</a> · {item.country} · {item.profession}</p>
            <p className="cg-hint ac-meta">
              {tr('Recibida')} {fmtDate(item.createdAt, locale)} · {tr('idioma')} {item.locale.toUpperCase()}
              {item.licenseNumber ? ` · ${tr('Colegiatura/registro:')} ${item.licenseNumber}` : ''}
            </p>
            {profile && <p className="ac-meta"><a href={profile} target="_blank" rel="noopener noreferrer">{tr('Perfil profesional')}</a></p>}
            {item.message && <p className="ac-message">{item.message}</p>}
            {item.reviewedAt && <p className="cg-hint ac-meta">{tr('Revisada por')} {item.reviewedBy ?? '—'} {tr('el')} {fmtDate(item.reviewedAt, locale)}{item.reviewNote ? ` · ${tr('Nota:')} ${item.reviewNote}` : ''}</p>}
            <div className="ac-actions">
              {item.cv && <Button variant="ghost" disabled={busy === item.id} onClick={() => void download(item)}>{tr('Descargar hoja de vida')} ({Math.max(1, Math.round(item.cv.size / 1024))} KB)</Button>}
              {item.status === 'pending' && <>
                <Button disabled={busy === item.id} onClick={() => { setOpen({ id: item.id, action: 'approve' }); setNote(''); setNoteError(''); setDialogMsg(''); setMsg('') }}>{tr('Aprobar')}</Button>
                <Button variant="ghost" disabled={busy === item.id} onClick={() => { setOpen({ id: item.id, action: 'reject' }); setNote(''); setNoteError(''); setDialogMsg(''); setMsg('') }}>{tr('Rechazar')}</Button>
              </>}
              {item.status === 'approved' && <Link className="cg-btn ac-linkbutton" to="/admin/users" state={{ newTherapist: { name: item.name, email: item.email } }}>{tr('Crear cuenta de profesional')}</Link>}
              <Button variant="ghost" disabled={busy === item.id} onClick={() => { setRemoving(item); setDialogMsg(''); setMsg('') }}>{tr('Eliminar')}</Button>
            </div>
          </>,
        }
      })} />

      <Dialog
        open={!!(open && reviewing)} onClose={() => { if (busy === null) closeReview() }}
        title={open?.action === 'reject' ? tr('Rechazar') : tr('Aprobar')}
        actions={<>
          <Button variant="ghost" disabled={busy !== null} onClick={closeReview}>{tr('Cancelar')}</Button>
          <Button variant={open?.action === 'reject' ? 'danger' : 'primary'} disabled={busy !== null} onClick={() => reviewing && open && void review(reviewing, open.action)}>{open?.action === 'reject' ? tr('Confirmar rechazo') : tr('Confirmar aprobación')}</Button>
        </>}
      >
        <p className="cg-hint">{open?.action === 'reject' ? tr('El motivo lo verá la persona.') : tr('Queda activa en la plataforma y puede recibir personas.')}</p>
        <TextAreaField id="application-note" label={open?.action === 'reject' ? tr('Motivo del rechazo (obligatorio)') : tr('Nota (opcional)')} maxLength={1000} value={note}
          error={noteError ? tr(noteError) : undefined} onChange={event => { setNote(event.target.value); setNoteError('') }} />
        {dialogMsg && <Banner kind="error" title={tr(dialogMsg)} />}
      </Dialog>

      <Dialog
        open={!!removing} onClose={() => { if (busy === null) setRemoving(null) }} title={tr('Eliminar solicitud')}
        actions={<>
          <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(null)}>{tr('Cancelar')}</Button>
          <Button variant="danger" disabled={busy !== null} onClick={() => removing && void remove(removing)}>{tr('Eliminar')}</Button>
        </>}
      >
        <p>{tr('Se eliminan la solicitud y su hoja de vida; no se puede deshacer. Libera cupo.')}</p>
        {removing && <p className="cg-hint">{removing.name}</p>}
        {dialogMsg && <Banner kind="error" title={tr(dialogMsg)} />}
      </Dialog>
    </section>
  )
}

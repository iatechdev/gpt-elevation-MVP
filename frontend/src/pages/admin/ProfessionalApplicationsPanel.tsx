// ES-95: «Solicitudes de profesionales» en el backoffice (admin y superadmin; el servidor lo verifica en cada acceso).
// Aprobar solo cambia el estado: la cuenta la crea el administrador con «Crear usuario» (precargado con nombre y correo).
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

type Status = 'pending' | 'approved' | 'rejected'
type Application = {
  id: number; name: string; email: string; country: string; profession: string; licenseNumber: string | null; profileUrl: string | null
  message: string | null; locale: 'es' | 'en'; status: Status; reviewedBy: string | null; reviewNote: string | null; reviewedAt: string | null
  userId: number | null; createdAt: string; cv: { size: number } | null
}
type Styles = { card: React.CSSProperties; label: React.CSSProperties; input: React.CSSProperties; btnPrimary: React.CSSProperties; btnSecondary: React.CSSProperties }

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pendientes' }, { key: 'approved', label: 'Aprobadas' }, { key: 'rejected', label: 'Rechazadas' }, { key: 'all', label: 'Todas' },
]
const STATUS_LABEL: Record<Status, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }
const CHIP: Record<Status, { background: string; color: string }> = {
  pending: { background: '#FEF3C7', color: '#92400E' }, approved: { background: '#DCFCE7', color: '#166534' }, rejected: { background: '#FEE2E2', color: '#991B1B' },
}
const safeLink = (url: string | null) => { try { return url && /^https?:$/.test(new URL(url).protocol) ? url : null } catch { return null } }
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('es') : ''

export function ProfessionalApplicationsPanel({ s }: { s: Styles }) {
  const token = localStorage.getItem('elevation_token') ?? ''
  const [filter, setFilter] = useState<Status | 'all'>('pending')
  const [items, setItems] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications${filter === 'all' ? '' : `?status=${filter}`}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      setItems(await r.json())
    } catch { setError('No se pudieron cargar las solicitudes.'); setItems([]) } finally { setLoading(false) }
  }, [filter, token])
  useEffect(() => { void load() }, [load])

  const review = async (item: Application, action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) { setMsg('Escribe el motivo del rechazo.'); return }
    setBusy(item.id); setMsg('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/${item.id}/${action}`, { method: 'PUT', headers, body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) setMsg(r.status === 409 ? 'Otra persona ya revisó esta solicitud.' : (data.error ?? 'No se pudo registrar la revisión.'))
      else { setOpen(null); setNote(''); setMsg(action === 'approve' ? 'Solicitud aprobada.' : 'Solicitud rechazada.') }
      await load()
    } catch { setMsg('Error de conexión.') } finally { setBusy(null) }
  }

  const remove = async (item: Application) => {
    if (!window.confirm(`¿Eliminar la solicitud de ${item.name} y su hoja de vida? No se puede deshacer.`)) return
    setBusy(item.id); setMsg('')
    try {
      const r = await fetch(`${API}/api/admin/professional-applications/${item.id}`, { method: 'DELETE', headers })
      setMsg(r.ok ? 'Solicitud eliminada.' : 'No se pudo eliminar la solicitud.'); await load()
    } catch { setMsg('Error de conexión.') } finally { setBusy(null) }
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

  return (
    <section aria-labelledby="applications-title">
      <h2 id="applications-title" style={{ fontSize: 16, margin: '0 0 4px' }}>Solicitudes de profesionales</h2>
      <p style={{ fontSize: 12, color: '#78716C', margin: '0 0 12px' }}>
        Llegan desde el formulario público. Aprobar no crea la cuenta: después usa «Crear cuenta de terapeuta». Abre las hojas de vida solo en un visor aislado; no se analizan contra virus.
      </p>
      <div role="group" aria-label="Filtrar por estado" style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {FILTERS.map(f => <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
          style={{ ...s.btnSecondary, background: filter === f.key ? '#6B7D5C' : 'transparent', color: filter === f.key ? '#fff' : '#6B7D5C' }}>{f.label}</button>)}
      </div>
      {msg && <p role="status" style={{ fontSize: 12, color: '#44403C' }}>{msg}</p>}
      {loading && <p style={{ color: '#78716C', fontSize: 13 }}>Cargando solicitudes...</p>}
      {error && <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>{error} <button style={s.btnSecondary} onClick={() => void load()}>Reintentar</button></p>}
      {!loading && !error && items.length === 0 && <p style={{ color: '#78716C', fontSize: 13 }}>No hay solicitudes en este estado.</p>}
      {items.map(item => {
        const profile = safeLink(item.profileUrl); const reviewing = open?.id === item.id
        return (
          <article key={item.id} style={s.card} aria-label={`Solicitud de ${item.name}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{item.name}</strong>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, ...CHIP[item.status] }}>{STATUS_LABEL[item.status]}</span>
            </div>
            <p style={{ fontSize: 13, margin: '4px 0' }}>
              <a href={`mailto:${encodeURIComponent(item.email).replace('%40', '@')}`}>{item.email}</a> · {item.country} · {item.profession}
            </p>
            <p style={{ fontSize: 12, color: '#78716C', margin: '0 0 4px' }}>
              Recibida {fmtDate(item.createdAt)} · idioma {item.locale.toUpperCase()}
              {item.licenseNumber ? ` · Colegiatura/registro: ${item.licenseNumber}` : ''}
            </p>
            {profile && <p style={{ fontSize: 13, margin: '0 0 4px' }}><a href={profile} target="_blank" rel="noopener noreferrer">Perfil profesional</a></p>}
            {item.message && <p style={{ fontSize: 13, margin: '0 0 4px', whiteSpace: 'pre-wrap' }}>{item.message}</p>}
            {item.reviewedAt && <p style={{ fontSize: 12, color: '#78716C', margin: '0 0 4px' }}>Revisada por {item.reviewedBy ?? '—'} el {fmtDate(item.reviewedAt)}{item.reviewNote ? ` · Nota: ${item.reviewNote}` : ''}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {item.cv && <button style={s.btnSecondary} disabled={busy === item.id} onClick={() => void download(item)}>Descargar hoja de vida ({Math.max(1, Math.round(item.cv.size / 1024))} KB)</button>}
              {item.status === 'pending' && <>
                <button style={s.btnPrimary} disabled={busy === item.id} onClick={() => { setOpen({ id: item.id, action: 'approve' }); setNote(''); setMsg('') }}>Aprobar</button>
                <button style={s.btnSecondary} disabled={busy === item.id} onClick={() => { setOpen({ id: item.id, action: 'reject' }); setNote(''); setMsg('') }}>Rechazar</button>
              </>}
              {item.status === 'approved' && <Link style={{ ...s.btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                to={`/admin/users?newTherapist=1&name=${encodeURIComponent(item.name)}&email=${encodeURIComponent(item.email)}`}>Crear cuenta de terapeuta</Link>}
              <button style={s.btnSecondary} disabled={busy === item.id} onClick={() => void remove(item)}>Eliminar</button>
            </div>
            {reviewing && open && (
              <div style={{ marginTop: 8 }}>
                <label htmlFor={`note-${item.id}`} style={s.label}>{open.action === 'reject' ? 'Motivo del rechazo (obligatorio)' : 'Nota (opcional)'}</label>
                <textarea id={`note-${item.id}`} style={{ ...s.input, width: '100%', minHeight: 64 }} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button style={s.btnPrimary} disabled={busy === item.id} onClick={() => void review(item, open.action)}>{open.action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}</button>
                  <button style={s.btnSecondary} onClick={() => { setOpen(null); setNote('') }}>Cancelar</button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

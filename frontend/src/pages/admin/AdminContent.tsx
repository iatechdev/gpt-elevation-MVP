import { useAdminText } from '../../i18n/useAdminText'
import landingFields from '../../../../shared/landing-content.json'
import { LandingPendingPanel } from './LandingPendingPanel'
import { ProfessionalApplicationsPanel } from './ProfessionalApplicationsPanel'
import { PENDING_KEYS } from './landingPending'
import { modalKeyDown } from '../../a11y/modalKeys'
// frontend/src/pages/admin/AdminContent.tsx
// HU-074 + HU-075 — CMS completo: Landing + Precios + Validaciones terapeutas

import { useEffect, useState, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface PricingPlan {
  id?: number
  slug: string
  name_es: string
  name_en: string
  description_es: string
  description_en: string
  price: number | string
  currency: string
  period: string
  features_es: string[]
  features_en: string[]
  isHighlighted: boolean
  isActive: boolean
  order: number
}

interface ValidationDoc {
  id: number
  therapist: { id: number; name: string; email: string }
  documentType: string
  documentName: string
  documentPath: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
}

const emptyPlan: PricingPlan = {
   slug: '',
  name_es: '', name_en: '',
  description_es: '', description_en: '',
  price: '', currency: 'USD', period: 'month',
  features_es: [], features_en: [],
  isHighlighted: false, isActive: true, order: 0,
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', border: '0.5px solid #E7E5E4',
  borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem',
}
const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#6B645F',
  letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}
const input: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.65rem',
  border: '0.5px solid #D6D2C4', fontSize: 13, color: '#1C1917',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  background: '#5C6B4E', color: '#fff', border: 'none',
  borderRadius: '0.75rem', padding: '0.6rem 1.25rem',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#5C6B4E', border: '0.5px solid #A8B5A2',
  borderRadius: '0.75rem', padding: '0.6rem 1.25rem',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const btnDanger: React.CSSProperties = {
  background: 'transparent', color: '#B91C1C', border: '0.5px solid #DC2626',
  borderRadius: '0.75rem', padding: '0.5rem 1rem',
  fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#5C6B4E',
  letterSpacing: '0.08em', textTransform: 'uppercase',
  margin: '0 0 0.75rem', paddingBottom: '0.4rem',
  borderBottom: '0.5px solid #EAF0E6',
}

// ── Componente principal ──────────────────────────────────────────────────────
export function AdminContent() {
  const tr = useAdminText()

  const [tab, setTab] = useState<'pricing' | 'landing' | 'validations' | 'applications'>('validations')

  const tabs = [
    { key: 'validations', label: '🎓 Validaciones' },
    { key: 'applications', label: '📨 Solicitudes' }, // ES-95
    { key: 'pricing',     label: 'Planes' },
    { key: 'landing',     label: 'Textos públicos' },
  ] as const

  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.8rem', color: '#1C1917', marginBottom: '0.25rem' }}>{tr("Contenido")}{' '}</h1>
      <p style={{ fontSize: '0.875rem', color: '#6B645F', marginBottom: '1.5rem' }}>{tr("Gestión de validaciones, precios y páginas públicas")}{' '}</p>

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.5rem', borderBottom: '0.5px solid #E7E5E4' }}>
        {tabs.map(t => (
          <button key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, padding: '0.5rem 1rem',
              color: tab === t.key ? '#5C6B4E' : '#6B645F',
              borderBottom: tab === t.key ? '2px solid #5C6B4E' : '2px solid transparent',
              fontFamily: 'Inter, sans-serif', marginBottom: -1,
            }}>
            {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'validations' && <ValidationsTab />}
      {tab === 'applications' && <ProfessionalApplicationsPanel s={{ card, label, input, btnPrimary, btnSecondary }} />}
      {tab === 'pricing'     && <PricingTab />}
      {tab === 'landing'     && <LandingTab />}
    </div>
  )
}

// ── Tab Validaciones ──────────────────────────────────────────────────────────
function ValidationsTab() {
  const tr = useAdminText()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [docs, setDocs]           = useState<ValidationDoc[]>([])
  const [loading, setLoading]     = useState(true)
  const [actionDoc, setActionDoc] = useState<ValidationDoc | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [loadingUrl, setLoadingUrl] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/junta/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setDocs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  const getDownloadUrl = async (doc: ValidationDoc) => {
    setLoadingUrl(doc.id)
    try {
      const r = await fetch(`${API}/api/junta/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (r.ok) window.open(data.url, '_blank')
      else setMsg('Error obteniendo el enlace.')
    } catch {
      setMsg('Error de conexión.')
    } finally {
      setLoadingUrl(null)
    }
  }

  const openAction = (doc: ValidationDoc, type: 'approve' | 'reject') => {
    setActionDoc(doc); setActionType(type); setNote(''); setMsg('')
  }

  const submitAction = async () => {
    if (!actionDoc || !actionType) return
    if (actionType === 'reject' && !note.trim()) return setMsg('La nota de rechazo es requerida.')
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/api/junta/${actionDoc.id}/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note }),
      })
      const data = await r.json()
      if (!r.ok) return setMsg(data.error ?? 'Error.')
      setMsg(actionType === 'approve' ? '✓ Terapeuta aprobado y activado.' : '✓ Documento rechazado.')
      setActionDoc(null); setActionType(null)
      load()
    } catch { setMsg('Error de conexión.') }
    finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6B645F', fontSize: 13 }}>{tr("Cargando documentos pendientes...")}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: '#6B645F', margin: 0 }}>
          {docs.length}{' '}{tr("documento(s) pendiente(s) de revisión")}{' '}</p>
        <button style={btnSecondary} onClick={load}>{tr("↻ Actualizar")}</button>
      </div>

      {msg && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', marginBottom: '1rem',
          background: msg.startsWith('✓') ? '#EAF0E6' : '#FEE2E2',
          color: msg.startsWith('✓') ? '#4A6741' : '#B91C1C', fontSize: 13 }}>
          {tr(msg)}
        </div>
      )}

      {docs.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', color: '#6B645F', fontSize: 13 }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>{tr("No hay documentos pendientes de revisión.")}{' '}</div>
      )}

      {docs.map(doc => (
        <div key={doc.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EAF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#5C6B4E', fontWeight: 600, flexShrink: 0 }}>
                  {doc.therapist.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{doc.therapist.name}</div>
                  <div style={{ fontSize: 11, color: '#6B645F' }}>{doc.therapist.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, background: '#F5F5F3', color: '#4A4A4A', padding: '2px 10px', borderRadius: 8 }}>
                  📄 {doc.documentName}
                </span>
                <span style={{ fontSize: 11, background: '#EAF0E6', color: '#5C6B4E', padding: '2px 8px', borderRadius: 8 }}>
                  {doc.documentType}
                </span>
                <span style={{ fontSize: 11, color: '#6F6963' }}>
                  {new Date(doc.submittedAt).toLocaleDateString(tr('es-CO'), { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              <button onClick={() => getDownloadUrl(doc)} disabled={loadingUrl === doc.id}
                style={{ ...btnSecondary, fontSize: 12, padding: '0.45rem 0.85rem' }}>
                {loadingUrl === doc.id ? tr('Cargando...') : tr('👁 Ver documento')}
              </button>
              <button onClick={() => openAction(doc, 'approve')}
                style={{ ...btnPrimary, fontSize: 12, padding: '0.45rem 0.85rem' }}>{tr("✓ Aprobar")}{' '}</button>
              <button onClick={() => openAction(doc, 'reject')}
                style={{ ...btnDanger, fontSize: 12, padding: '0.45rem 0.85rem' }}>{tr("✗ Rechazar")}{' '}</button>
            </div>
          </div>
        </div>
      ))}

      {/* Modal aprobar / rechazar */}
      {actionDoc && actionType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              {actionType === 'approve' ? tr('✓ Aprobar terapeuta') : tr('✗ Rechazar documento')}
            </h3>
            <p style={{ fontSize: 13, color: '#6B645F', margin: '0 0 1.25rem' }}>
              {actionType === 'approve'
                ? tr(`¿Apruebas la validación de ${actionDoc.therapist.name}? Esto lo activará en la plataforma.`)
                : tr(`Explica por qué rechazas el documento de ${actionDoc.therapist.name}.`)}
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={label}>{actionType === 'approve' ? tr('Nota (opcional)') : tr('Motivo de rechazo *')}</label>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder={actionType === 'approve' ? tr('Ej: Documentos verificados.') : tr('Ej: El título no está apostillado...')}
                rows={3}
                style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            {msg && <p style={{ fontSize: 12, color: '#B91C1C', margin: '0 0 1rem' }}>{tr(msg)}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => { setActionDoc(null); setActionType(null); setMsg('') }}>{tr("Cancelar")}{' '}</button>
              <button onClick={submitAction} disabled={saving}
                style={actionType === 'approve' ? btnPrimary : btnDanger}>
                {saving ? tr('Procesando...') : actionType === 'approve' ? tr('✓ Confirmar aprobación') : tr('✗ Confirmar rechazo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Precios ───────────────────────────────────────────────────────────────
function PricingTab() {
  const tr = useAdminText()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [plans, setPlans]         = useState<PricingPlan[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<PricingPlan | null>(null)
  const [form, setForm]           = useState<PricingPlan>(emptyPlan)
  const [featInputEs, setFeatInputEs] = useState('')
  const [featInputEn, setFeatInputEn] = useState('')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [loadError, setLoadError] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    fetch(`${API}/api/admin/pricing/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() })
      .then(data => { if (!Array.isArray(data)) throw new Error('invalid'); setPlans(data) })
      .catch(() => { setPlans([]); setLoadError(true) })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (showForm) dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus() }, [showForm])

  const closeForm = () => {
    setShowForm(false)
    triggerRef.current?.focus()
  }

  const openNew = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setForm(emptyPlan); setFeatInputEs(''); setFeatInputEn('')
    setEditing(null); setShowForm(true); setMsg('')
  }

  const openEdit = (p: PricingPlan) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setForm({ ...p }); setFeatInputEs(''); setFeatInputEn('')
    setEditing(p); setShowForm(true); setMsg('')
  }

  const addFeature = (lang: 'es' | 'en') => {
    if (lang === 'es') {
      if (!featInputEs.trim()) return
      setForm(f => ({ ...f, features_es: [...f.features_es, featInputEs.trim()] }))
      setFeatInputEs('')
    } else {
      if (!featInputEn.trim()) return
      setForm(f => ({ ...f, features_en: [...f.features_en, featInputEn.trim()] }))
      setFeatInputEn('')
    }
  }

  const removeFeature = (lang: 'es' | 'en', i: number) => {
    if (lang === 'es') setForm(f => ({ ...f, features_es: f.features_es.filter((_, idx) => idx !== i) }))
    else setForm(f => ({ ...f, features_en: f.features_en.filter((_, idx) => idx !== i) }))
  }

  const save = async () => {
    if (!form.slug.trim() || !form.name_es.trim() || !form.name_en.trim())
      return setMsg('El slug, nombre en español e inglés son requeridos.')
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0)
      return setMsg('Introduce un precio válido.')
    setSaving(true); setMsg('')
    try {
      const url    = editing?.id ? `${API}/api/admin/pricing/${editing.id}` : `${API}/api/admin/pricing`
      const method = editing?.id ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!r.ok) return setMsg('Error guardando.')
      setMsg(editing ? 'Plan actualizado.' : 'Plan creado.')
      closeForm(); load()
    } catch { setMsg('Error de conexión.') }
    finally { setSaving(false) }
  }

  const deactivate = async (id: number) => {
    if (!confirm(tr('¿Desactivar este plan?'))) return
    setSaving(true); setMsg('')
    try {
      const response = await fetch(`${API}/api/admin/pricing/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('deactivate')
      setMsg('Plan desactivado.')
      load()
    } catch { setMsg('No se pudo desactivar el plan.') }
    finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6B645F', fontSize: 13 }}>{tr("Cargando planes...")}</p>
  if (loadError) return <div role="alert"><p>{tr('No se pudieron cargar los planes.')}</p><button style={btnSecondary} onClick={load}>{tr('Reintentar')}</button></div>

  return (
    <div>
      {!showForm && msg && <p role="status">{tr(msg)}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: '#6B645F', margin: 0 }}>
          {plans.filter(p => p.isActive).length}{' '}{tr("plan(es) activo(s)")}{' '}</p>
        <button style={btnPrimary} onClick={openNew}>{tr("+ Nuevo plan")}</button>
      </div>

      {plans.map(p => (
        <div key={p.id} style={{ ...card, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', opacity: p.isActive ? 1 : 0.5 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{p.name_es}</span>
              <span style={{ fontSize: 11, color: '#6F6963' }}>/ {p.name_en}</span>
              {p.isHighlighted && <span style={{ fontSize: 10, background: '#EAF0E6', color: '#5C6B4E', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>{tr("DESTACADO")}</span>}
              {!p.isActive && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 10 }}>{tr("INACTIVO")}</span>}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#4A4A4A' }}>
              <strong>${p.price}</strong> {p.currency} / {p.period}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(p.features_es ?? []).map((f, i) => (
                <span key={i} style={{ fontSize: 11, background: '#F5F5F3', color: '#4A4A4A', padding: '2px 8px', borderRadius: 8 }}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={btnSecondary} onClick={() => openEdit(p)}>{tr("Editar")}</button>
            {p.isActive && <button style={btnDanger} disabled={saving} onClick={() => deactivate(p.id!)}>{tr("Desactivar")}</button>}
          </div>
        </div>
      ))}

      {plans.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6B645F', fontSize: 13 }}>{tr("No hay planes. Crea el primero.")}</div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="plan-form-title" onKeyDown={e => modalKeyDown(e, dialogRef.current, () => { if (!saving) closeForm() })} style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 id="plan-form-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 1.5rem' }}>
              {editing ? tr('Editar plan') : tr('Nuevo plan')}
            </h3>
            <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={sectionTitle}>{tr("Identificador")}</p>
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="plan-slug" style={label}>{tr("Slug * (sin espacios, ej: basic, essential, plus, pro)")}</label>
                  <input id="plan-slug" style={input} value={form.slug} placeholder={tr("ej: basic")}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))} />
                </div>
                <p style={sectionTitle}>{tr("Nombre del plan")}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label htmlFor="plan-name-es" style={label}>{tr("Español *")}</label>
                    <input id="plan-name-es" style={input} value={form.name_es} placeholder={tr("ej: Gratis")} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="plan-name-en" style={label}>{tr("Inglés *")}</label>
                    <input id="plan-name-en" style={input} value={form.name_en} placeholder={tr("ej: Free")} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div>
                <p style={sectionTitle}>{tr("Descripción")}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label htmlFor="plan-description-es" style={label}>{tr("Español")}</label>
                    <input id="plan-description-es" style={input} value={form.description_es} placeholder={tr("Descripción en español...")} onChange={e => setForm(f => ({ ...f, description_es: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="plan-description-en" style={label}>{tr("Inglés")}</label>
                    <input id="plan-description-en" style={input} value={form.description_en} placeholder="Description in English..." onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div>
                <p style={sectionTitle}>{tr("Precio")}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8 }}>
                  <div>
                    <label htmlFor="plan-price" style={label}>{tr("Precio")}</label>
                    <input id="plan-price" style={input} type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="plan-currency" style={label}>{tr("Moneda")}</label>
                    <select id="plan-currency" style={{ ...input }} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="USD">USD</option>
                      <option value="COP">COP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="plan-period" style={label}>{tr("Período")}</label>
                    <select id="plan-period" style={{ ...input }} value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                      <option value="month">{tr("Mensual")}</option>
                      <option value="year">{tr("Anual")}</option>
                      <option value="forever">{tr("Para siempre")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <p style={sectionTitle}>{tr("Características en Español")}</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input aria-label={tr('Característica en español')} style={{ ...input, flex: 1, minWidth: 0 }} value={featInputEs} onChange={e => setFeatInputEs(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature('es')} placeholder={tr("ej: Conversaciones ilimitadas")} />
                  <button aria-label={tr('Añadir característica en español')} style={btnSecondary} onClick={() => addFeature('es')}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {form.features_es.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F3', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#1C1917' }}>{f}</span>
                      <button aria-label={`${tr('Eliminar característica')}: ${f}`} onClick={() => removeFeature('es', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6963', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={sectionTitle}>{tr("Características en Inglés")}</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input aria-label={tr('Característica en inglés')} style={{ ...input, flex: 1, minWidth: 0 }} value={featInputEn} onChange={e => setFeatInputEn(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature('en')} placeholder={tr("ej: Unlimited conversations")} />
                  <button aria-label={tr('Añadir característica en inglés')} style={btnSecondary} onClick={() => addFeature('en')}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {form.features_en.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F3', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#1C1917' }}>{f}</span>
                      <button aria-label={`${tr('Eliminar característica')}: ${f}`} onClick={() => removeFeature('en', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6963', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={sectionTitle}>{tr("Opciones")}</p>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <label htmlFor="plan-order" style={label}>{tr("Orden")}</label>
                    <input id="plan-order" style={{ ...input, width: 80 }} type="number" min="0" value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', paddingBottom: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isHighlighted} onChange={e => setForm(f => ({ ...f, isHighlighted: e.target.checked }))} />{tr("Destacado")}{' '}</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />{tr("Activo")}{' '}</label>
                  </div>
                </div>
              </div>
              {msg && <p role="alert" style={{ fontSize: 12, color: '#B91C1C', margin: 0 }}>{tr(msg)}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button style={btnSecondary} disabled={saving} onClick={closeForm}>{tr("Cancelar")}{' '}</button>
                <button style={btnPrimary} onClick={save} disabled={saving}>
                  {saving ? tr('Guardando...') : editing ? tr('Actualizar') : tr('Crear plan')}
                </button>
              </div>
            </div>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Landing ───────────────────────────────────────────────────────────────
function LandingTab() {
  const tr = useAdminText()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [lang, setLang]       = useState<'es' | 'en'>('es')
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [msgs, setMsgs]       = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const fields = [
    { key: 'hero_title',         label: 'Título Hero' },
    { key: 'hero_subtitle',      label: 'Subtítulo Hero' },
    { key: 'cta_primary',        label: 'CTA Principal' },
    ...landingFields.filter(({ key }) => !PENDING_KEYS.has(key)).map(({ key }) => ({ key, label: key })), // ES-90: los pendientes se editan en su panel
  ]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(false)
    setMsgs({})
    fetch(`${API}/api/landing-content/admin?lang=${lang}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() })
      .then(data => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid')
        if (!controller.signal.aborted) setContent(data)
      })
      .catch(() => { if (!controller.signal.aborted) { setContent({}); setLoadError(true) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [lang, token, attempt])

  const saveField = async (key: string) => {
    if (saving !== null) return
    setSaving(key); setMsgs(m => ({ ...m, [key]: '' }))
    try {
      const r = await fetch(`${API}/api/landing-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, lang, value: content[key] }),
      })
      setMsgs(m => ({ ...m, [key]: r.ok ? '✓ Guardado' : r.status === 403 ? 'Solo superadmin puede guardar textos.' : 'Error guardando.' }))
    } catch {
      setMsgs(m => ({ ...m, [key]: 'Error de conexión.' }))
    } finally { setSaving(null) }
  }

  if (loading) return <p style={{ color: '#6B645F', fontSize: 13 }}>{tr("Cargando contenido...")}</p>
  if (loadError) return <div role="alert"><p>{tr('No se pudo cargar el contenido.')}</p><button style={btnSecondary} onClick={() => setAttempt(n => n + 1)}>{tr('Reintentar')}</button></div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
        {(['es', 'en'] as const).map(l => (
          <button key={l} disabled={saving !== null} aria-pressed={lang === l} onClick={() => setLang(l)}
            style={{ ...btnSecondary, background: lang === l ? '#5C6B4E' : 'transparent', color: lang === l ? '#fff' : '#5C6B4E' }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <LandingPendingPanel lang={lang} content={content} setValue={(key, value) => { setContent(c => ({ ...c, [key]: value })); setMsgs(m => ({ ...m, [key]: '' })) }} save={saveField} saving={saving} msgs={msgs} s={{ card, label, input, btnPrimary }} />
      {fields.map(f => (
        <div key={f.key} style={card}>
          <label htmlFor={`landing-${f.key}`} style={label}>{tr(f.label)}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input id={`landing-${f.key}`} disabled={saving === f.key} style={{ ...input, flex: 1 }} value={content[f.key] ?? ''} onChange={e => { setContent(c => ({ ...c, [f.key]: e.target.value })); setMsgs(m => ({ ...m, [f.key]: '' })) }} />
            <button style={btnPrimary} onClick={() => saveField(f.key)} disabled={saving !== null}>
              {saving === f.key ? '...' : tr('Guardar')}
            </button>
          </div>
          {msgs[f.key] && (
            <p role="status" style={{ fontSize: 11, color: msgs[f.key].startsWith('✓') ? '#5C6B4E' : '#B91C1C', margin: '4px 0 0' }}>
              {tr(msgs[f.key])}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

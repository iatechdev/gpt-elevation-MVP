import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import landingFields from '../../../../shared/landing-content.json'
import { LandingPendingPanel } from './LandingPendingPanel'
import { ProfessionalApplicationsPanel } from './ProfessionalApplicationsPanel'
import { PENDING_KEYS } from './landingPending'
import { landingFieldLabel } from './landingLabels'
import { modalKeyDown } from '../../a11y/modalKeys'
import { Banner, Button, Dialog, ItemList, Tabs, TextAreaField } from '../../cartografia'
import './adminContent.css'
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
// ES-184: marco y pestañas en Cartografía. «Planes» y «Textos públicos» se montan tal cual (sin rediseño visual) hasta que tengan ticket propio.
// El número entre paréntesis es de pendientes y solo aparece si el servidor respondió (nunca se inventa).
function usePendingCounts() {
  const [counts, setCounts] = useState<{ validations: number | null; applications: number | null }>({ validations: null, applications: null })
  const refresh = useCallback(() => {
    const token = localStorage.getItem('elevation_token') ?? ''
    const count = async (path: string) => {
      try {
        const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const data = r.ok ? await r.json() : null
        return Array.isArray(data) ? data.length : null
      } catch { return null }
    }
    void Promise.all([count('/api/junta/pending'), count('/api/admin/professional-applications?status=pending')])
      .then(([validations, applications]) => setCounts({ validations, applications }))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return { ...counts, refresh }
}

export function AdminContent() {
  const tr = useAdminText()
  const counts = usePendingCounts()
  const named = (label: string, count: number | null) => count === null ? tr(label) : `${tr(label)} (${count})`

  return (
    <div>
      <header className="ac-head">
        <h1 className="ac-title">{tr("Contenido")}</h1>
        <p className="ac-lead">{tr("Gestión de validaciones, precios y páginas públicas")}</p>
      </header>
      <Tabs label={tr('Secciones')} tabs={[
        { id: 'validations', label: named('Validaciones', counts.validations), panel: <ValidationsTab onChanged={counts.refresh} /> },
        { id: 'applications', label: named('Solicitudes', counts.applications), panel: <ProfessionalApplicationsPanel onChanged={counts.refresh} /> }, // ES-95
        { id: 'pricing', label: tr('Planes'), panel: <PricingTab /> },
        { id: 'landing', label: tr('Textos públicos'), panel: <LandingTab /> },
      ]} />
    </div>
  )
}

// ── Tab Validaciones ──────────────────────────────────────────────────────────
function ValidationsTab({ onChanged }: { onChanged?: () => void }) {
  const tr = useAdminText()
  const { lang } = useLanguage()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [docs, setDocs]           = useState<ValidationDoc[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionDoc, setActionDoc] = useState<ValidationDoc | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote]           = useState('')
  const [noteError, setNoteError] = useState('')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [dialogMsg, setDialogMsg] = useState('')
  const [loadingUrl, setLoadingUrl] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setLoadError('')
    fetch(`${API}/api/junta/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) { setDocs([]); setLoadError(r.status === 403 ? 'Solo superadministración puede revisar los documentos de validación.' : 'No se pudieron cargar los documentos.'); return }
        const data = await r.json()
        setDocs(Array.isArray(data) ? data : [])
      })
      .catch(() => { setDocs([]); setLoadError('No se pudieron cargar los documentos.') })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  // El documento se abre con un enlace firmado y temporal que el servidor entrega solo a quien tiene sesión de superadministración: no hay una URL pública.
  const getDownloadUrl = async (doc: ValidationDoc) => {
    setLoadingUrl(doc.id); setMsg('')
    try {
      const r = await fetch(`${API}/api/junta/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (r.ok) window.open(data.url, '_blank', 'noopener,noreferrer')
      else setMsg('Error obteniendo el enlace.')
    } catch {
      setMsg('Error de conexión.')
    } finally {
      setLoadingUrl(null)
    }
  }

  const openAction = (doc: ValidationDoc, type: 'approve' | 'reject') => {
    setActionDoc(doc); setActionType(type); setNote(''); setNoteError(''); setDialogMsg(''); setMsg('')
  }
  const closeAction = () => { setActionDoc(null); setActionType(null); setNote(''); setNoteError(''); setDialogMsg('') }

  const submitAction = async () => {
    if (!actionDoc || !actionType) return
    if (actionType === 'reject' && !note.trim()) { setNoteError('Escribe el motivo del rechazo.'); return }
    setSaving(true); setNoteError(''); setDialogMsg('')
    try {
      const r = await fetch(`${API}/api/junta/${actionDoc.id}/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setDialogMsg(data.error ?? 'Error.'); return } // el diálogo sigue abierto y conserva la nota
      setMsg(actionType === 'approve' ? 'Profesional aprobado y activado.' : 'Documento rechazado.')
      closeAction()
      load(); onChanged?.()
    } catch { setDialogMsg('Error de conexión.') }
    finally { setSaving(false) }
  }

  return (
    <section className="cg-card ac-panel" aria-labelledby="validations-title">
      <h2 id="validations-title">{tr('Validaciones')}</h2>
      <div className="ac-bar">
        <p className="cg-hint" role="status">{loading ? tr("Cargando documentos pendientes...") : loadError ? '' : <>{docs.length}{' '}{tr("documento(s) pendiente(s) de revisión")}</>}</p>
        <Button variant="ghost" disabled={loading} onClick={() => { load(); onChanged?.() }}>{tr("Actualizar")}</Button>
      </div>

      <p className="ac-status cg-hint" role="status">{msg ? tr(msg) : ''}</p>
      {loadError && <Banner kind="error" title={tr(loadError)}><Button variant="ghost" onClick={load}>{tr('Reintentar')}</Button></Banner>}
      {!loading && !loadError && docs.length === 0 && <p className="cg-hint">{tr("No hay documentos pendientes de revisión.")}</p>}

      <ItemList label={tr('Validaciones')} items={docs.map(doc => ({
        id: String(doc.id),
        top: <div className="ac-row"><strong>{doc.therapist.name}</strong><span className="cg-hint">{doc.therapist.email} · {tr('Fecha')}: {new Date(doc.submittedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>,
        body: <>
          <p className="cg-hint ac-meta">{tr('Tipo de documento')}: {doc.documentType} · {tr('Archivo')}: {doc.documentName}</p>
          <div className="ac-actions">
            <Button variant="ghost" disabled={loadingUrl === doc.id} onClick={() => void getDownloadUrl(doc)}>{loadingUrl === doc.id ? tr('Cargando...') : tr('Ver documento')}</Button>
            <Button onClick={() => openAction(doc, 'approve')}>{tr("Aprobar")}</Button>
            <Button variant="ghost" onClick={() => openAction(doc, 'reject')}>{tr("Rechazar")}</Button>
          </div>
        </>,
      }))} />

      <Dialog
        open={!!(actionDoc && actionType)} onClose={() => { if (!saving) closeAction() }}
        title={actionType === 'reject' ? tr('Rechazar') : tr('Aprobar')}
        actions={<>
          <Button variant="ghost" disabled={saving} onClick={closeAction}>{tr("Cancelar")}</Button>
          <Button variant={actionType === 'reject' ? 'danger' : 'primary'} disabled={saving} onClick={() => void submitAction()}>
            {saving ? tr('Procesando...') : actionType === 'approve' ? tr('Confirmar aprobación') : tr('Confirmar rechazo')}
          </Button>
        </>}
      >
        {actionDoc && <p><strong>{actionDoc.therapist.name}</strong></p>}
        <p className="cg-hint">{actionType === 'approve' ? tr('Queda activa en la plataforma y puede recibir personas.') : tr('El motivo lo verá la persona.')}</p>
        <TextAreaField id="validation-note" label={actionType === 'approve' ? tr('Nota (opcional)') : tr('Motivo de rechazo *')} value={note}
          placeholder={actionType === 'approve' ? tr('Ej: Documentos verificados.') : tr('Ej: El título no está apostillado...')}
          error={noteError ? tr(noteError) : undefined} onChange={e => { setNote(e.target.value); setNoteError('') }} />
        {dialogMsg && <Banner kind="error" title={tr(dialogMsg)} />}
      </Dialog>
    </section>
  )
}

// ── Tab Precios ───────────────────────────────────────────────────────────────
function PricingTab() {
  const tr = useAdminText()
  const { lang } = useLanguage()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [plans, setPlans]         = useState<PricingPlan[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<PricingPlan | null>(null)
  const [form, setForm]           = useState<PricingPlan>(emptyPlan)
  const [featInputEs, setFeatInputEs] = useState('')
  const [featInputEn, setFeatInputEn] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deactivating, setDeactivating] = useState<PricingPlan | null>(null)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [loadError, setLoadError] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const restoreFocus = useRef(false)
  const busyRef = useRef(false)

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true)
    setLoadError(false)
    fetch(`${API}/api/admin/pricing/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() })
      .then(data => { if (!Array.isArray(data)) throw new Error('invalid'); setPlans(data) })
      .catch(() => { setPlans([]); setLoadError(true) })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load(true) }, [load])
  useEffect(() => { if (showForm) dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus() }, [showForm])
  useEffect(() => { if (deactivating) confirmRef.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [deactivating])
  useEffect(() => {
    if (!saving && !showForm && !deactivating && restoreFocus.current) {
      triggerRef.current?.focus()
      restoreFocus.current = false
    }
  }, [saving, showForm, deactivating])

  const closeForm = () => {
    restoreFocus.current = true
    setShowForm(false)
  }

  const openNew = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setForm(emptyPlan); setFeatInputEs(''); setFeatInputEn(''); setErrors({})
    setEditing(null); setShowForm(true); setMsg('')
  }

  const openEdit = (p: PricingPlan) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setForm({ ...p }); setFeatInputEs((p.features_es ?? []).join('\n')); setFeatInputEn((p.features_en ?? []).join('\n')); setErrors({})
    setEditing(p); setShowForm(true); setMsg('')
  }

  const save = async () => {
    if (busyRef.current) return
    const nextErrors: Record<string, string> = {}
    if (!editing && (!/^[a-z0-9-]+$/.test(form.slug) || form.slug.length > 20)) nextErrors['plan-slug'] = 'Usa hasta 20 letras minúsculas, números o guiones.'
    else if (!editing && plans.some(plan => plan.slug === form.slug)) nextErrors['plan-slug'] = 'Este identificador ya existe.'
    if (!form.name_es.trim()) nextErrors['plan-name-es'] = 'Este campo es obligatorio.'
    else if (form.name_es.length > 255) nextErrors['plan-name-es'] = 'Usa como máximo 255 caracteres.'
    if (!form.name_en.trim()) nextErrors['plan-name-en'] = 'Este campo es obligatorio.'
    else if (form.name_en.length > 255) nextErrors['plan-name-en'] = 'Usa como máximo 255 caracteres.'
    if (String(form.price).trim() === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0 || Number(form.price) > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(form.price)))
      nextErrors['plan-price'] = 'Introduce un precio válido.'
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      document.getElementById(firstError)?.focus()
      return
    }
    busyRef.current = true
    dialogRef.current?.focus()
    setSaving(true); setMsg('')
    try {
      const url    = editing?.id ? `${API}/api/admin/pricing/${editing.id}` : `${API}/api/admin/pricing`
      const method = editing?.id ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          features_es: featInputEs.split(/\r?\n/).map(line => line.trim()).filter(Boolean),
          features_en: featInputEn.split(/\r?\n/).map(line => line.trim()).filter(Boolean),
        }),
      })
      if (!r.ok) return setMsg('Error guardando.')
      setMsg(editing ? 'Plan actualizado.' : 'Plan creado.')
      closeForm(); load()
    } catch { setMsg('Error de conexión.') }
    finally { busyRef.current = false; setSaving(false) }
  }

  const closeConfirm = () => {
    restoreFocus.current = true
    setDeactivating(null)
  }

  const deactivate = async () => {
    if (!deactivating?.id || busyRef.current) return
    busyRef.current = true
    confirmRef.current?.focus()
    setSaving(true); setMsg('')
    try {
      const response = await fetch(`${API}/api/admin/pricing/${deactivating.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('deactivate')
      setMsg('Plan desactivado.')
      if (triggerRef.current?.previousElementSibling instanceof HTMLElement) {
        triggerRef.current = triggerRef.current.previousElementSibling
      }
      closeConfirm()
      load()
    } catch { setMsg('No se pudo desactivar el plan.') }
    finally { busyRef.current = false; setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6B645F', fontSize: 13 }}>{tr("Cargando planes...")}</p>
  if (loadError) return <div role="alert"><p>{tr('No se pudieron cargar los planes.')}</p><button style={btnSecondary} onClick={() => load(true)}>{tr('Reintentar')}</button></div>

  return (
    <div>
      {!showForm && !deactivating && msg && <p role="status">{tr(msg)}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: '#6B645F', margin: 0 }}>
          {plans.filter(p => p.isActive).length}{' '}{tr("plan(es) activo(s)")}{' '}</p>
        <button style={btnPrimary} onClick={openNew}>{tr("+ Nuevo plan")}</button>
      </div>

      {plans.map(p => (
        <div key={p.id} style={{ ...card, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', ...(p.isActive ? {} : { background: '#F1EFEC', border: '1px dashed #78716C' }) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{lang === 'en' ? p.name_en : p.name_es}</span>
              {p.isHighlighted && <span style={{ fontSize: 10, background: '#EAF0E6', color: '#5C6B4E', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>{tr("DESTACADO")}</span>}
              {!p.isActive && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 10 }}>{tr("INACTIVO")}</span>}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#4A4A4A' }}>
              <strong>{['USD', 'COP', 'EUR'].includes(p.currency) && Number.isFinite(Number(p.price)) ? new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CO', { style: 'currency', currency: p.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(p.price)) : `${p.price} ${p.currency}`}</strong>{' · '}{tr(({ month: 'Mensual', year: 'Anual', forever: 'Para siempre' } as Record<string, string>)[p.period] ?? 'Período desconocido')}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#57534E' }}>{tr('Identificador')}: {p.slug}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {((lang === 'en' ? p.features_en : p.features_es) ?? []).map((f, i) => (
                <span key={i} style={{ fontSize: 11, background: p.isActive ? '#F5F5F3' : '#fff', color: '#4A4A4A', padding: '2px 8px', borderRadius: 8 }}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={btnSecondary} onClick={() => openEdit(p)}>{tr("Editar")}</button>
            {p.isActive && <button style={btnDanger} disabled={saving} onClick={() => { triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setMsg(''); setDeactivating(p) }}>{tr("Desactivar")}</button>}
          </div>
        </div>
      ))}

      {plans.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6B645F', fontSize: 13 }}>{tr("No hay planes. Crea el primero.")}</div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="plan-form-title" onKeyDown={e => { if (saving && e.key === 'Tab') e.preventDefault(); else modalKeyDown(e, dialogRef.current, () => { if (!saving) closeForm() }) }} style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 id="plan-form-title" style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 1.5rem' }}>
              {editing ? tr('Editar plan') : tr('Nuevo plan')}
            </h3>
            <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={sectionTitle}>{tr("Identificador")}</p>
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="plan-slug" style={label}>{tr("Slug * (sin espacios, ej: basic, essential, plus, pro)")}</label>
                  <input id="plan-slug" style={input} value={form.slug} readOnly={!!editing} aria-invalid={!!errors['plan-slug']} aria-describedby={errors['plan-slug'] ? 'plan-slug-error' : undefined} placeholder={tr("ej: basic")} maxLength={20}
                    onChange={e => { setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20) })); setErrors(current => ({ ...current, 'plan-slug': '' })) }} />
                  {errors['plan-slug'] && <p id="plan-slug-error" role="alert">{tr(errors['plan-slug'])}</p>}
                </div>
                <p style={sectionTitle}>{tr("Nombre del plan")}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label htmlFor="plan-name-es" style={label}>{tr("Español *")}</label>
                    <input id="plan-name-es" style={input} value={form.name_es} aria-invalid={!!errors['plan-name-es']} aria-describedby={errors['plan-name-es'] ? 'plan-name-es-error' : undefined} placeholder={tr("ej: Gratis")} onChange={e => { setForm(f => ({ ...f, name_es: e.target.value })); setErrors(current => ({ ...current, 'plan-name-es': '' })) }} />
                    {errors['plan-name-es'] && <p id="plan-name-es-error" role="alert">{tr(errors['plan-name-es'])}</p>}
                  </div>
                  <div>
                    <label htmlFor="plan-name-en" style={label}>{tr("Inglés *")}</label>
                    <input id="plan-name-en" style={input} value={form.name_en} aria-invalid={!!errors['plan-name-en']} aria-describedby={errors['plan-name-en'] ? 'plan-name-en-error' : undefined} placeholder={tr("ej: Free")} onChange={e => { setForm(f => ({ ...f, name_en: e.target.value })); setErrors(current => ({ ...current, 'plan-name-en': '' })) }} />
                    {errors['plan-name-en'] && <p id="plan-name-en-error" role="alert">{tr(errors['plan-name-en'])}</p>}
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
                    <input id="plan-price" style={input} type="number" min="0" max="99999999.99" step="0.01" value={form.price} aria-invalid={!!errors['plan-price']} aria-describedby={errors['plan-price'] ? 'plan-price-error' : undefined} onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setErrors(current => ({ ...current, 'plan-price': '' })) }} />
                    {errors['plan-price'] && <p id="plan-price-error" role="alert">{tr(errors['plan-price'])}</p>}
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
                <label htmlFor="plan-features-es" style={sectionTitle}>{tr('Características en español, una por línea')}</label>
                <textarea id="plan-features-es" style={input} rows={4} value={featInputEs} onChange={e => setFeatInputEs(e.target.value)} />
              </div>
              <div>
                <label htmlFor="plan-features-en" style={sectionTitle}>{tr('Características en inglés, una por línea')}</label>
                <textarea id="plan-features-en" style={input} rows={4} value={featInputEn} onChange={e => setFeatInputEn(e.target.value)} />
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
      {deactivating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div ref={confirmRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="plan-deactivate-title" aria-describedby="plan-deactivate-description" onKeyDown={e => modalKeyDown(e, confirmRef.current, () => { if (!saving) closeConfirm() })} style={{ ...card, width: '100%', maxWidth: 480 }}>
            <h3 id="plan-deactivate-title">{tr('¿Desactivar este plan?')}</h3>
            <p id="plan-deactivate-description">{tr('El plan deja de verse en precios; las solicitudes realizadas se conservan. Puedes reactivarlo editándolo.')}</p>
            {msg && <p role="alert">{tr(msg)}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} disabled={saving} onClick={closeConfirm}>{tr('Cancelar')}</button>
              <button style={btnDanger} disabled={saving} onClick={deactivate}>{saving ? tr('Procesando...') : tr('Desactivar')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Landing ───────────────────────────────────────────────────────────────
function LandingTab() {
  const tr = useAdminText()
  const { lang: interfaceLang } = useLanguage()

  const token = localStorage.getItem('elevation_token') ?? ''
  const [lang, setLang]       = useState<'es' | 'en'>('es')
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [msgs, setMsgs]       = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const savingRef = useRef(false)

  const fields = [
    { key: 'hero_title',         label: 'Título Hero' },
    { key: 'hero_subtitle',      label: 'Subtítulo Hero' },
    { key: 'cta_primary',        label: 'CTA Principal' },
    ...landingFields.filter(({ key }) => !PENDING_KEYS.has(key)).map(({ key }) => ({ key, label: landingFieldLabel(key, interfaceLang) })), // ES-90: los pendientes se editan en su panel
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
    if (savingRef.current) return
    savingRef.current = true
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
    } finally { savingRef.current = false; setSaving(null) }
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
      <h2>{tr('Otros textos')}</h2>
      {fields.map(f => (
        <div key={f.key} style={card}>
          <label htmlFor={`landing-${f.key}`} style={label}>{tr(f.label)}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input id={`landing-${f.key}`} disabled={saving === f.key} style={{ ...input, flex: 1 }} value={content[f.key] ?? ''} onChange={e => { setContent(c => ({ ...c, [f.key]: e.target.value })); setMsgs(m => ({ ...m, [f.key]: '' })) }} />
            <button style={btnPrimary} onClick={() => saveField(f.key)} aria-disabled={saving !== null}>
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

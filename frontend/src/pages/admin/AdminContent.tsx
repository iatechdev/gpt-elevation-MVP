import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import landingFields from '../../../../shared/landing-content.json'
import { LandingPendingPanel } from './LandingPendingPanel'
import { LandingConflict } from './LandingConflict'
import { conflictId, expectedFor, readSaveOutcome, readVersions, type LandingVersion } from './landingVersions.ts'
import { ProfessionalApplicationsPanel } from './ProfessionalApplicationsPanel'
import { PENDING_KEYS } from './landingPending'
import { landingFieldLabel } from './landingLabels'
import { normalizeChoices, serverFieldError } from './planChoices.ts'
import { Banner, Button, CheckField, Chip, Dialog, ItemList, SelectField, Tabs, TextAreaField, TextField } from '../../cartografia'
import './adminContent.css'
// frontend/src/pages/admin/AdminContent.tsx
// HU-074 + HU-075 — CMS completo: Landing + Precios + Validaciones terapeutas

import { memo, useEffect, useMemo, useState, useCallback, useRef } from 'react'

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
  const [forbidden, setForbidden] = useState(false) // ES-423 (B3): un 403 es falta de permiso, no un fallo recuperable: sin «Reintentar»
  const [actionDoc, setActionDoc] = useState<ValidationDoc | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote]           = useState('')
  const [noteError, setNoteError] = useState('')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [dialogMsg, setDialogMsg] = useState('')
  const [loadingUrl, setLoadingUrl] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setLoadError(''); setForbidden(false)
    fetch(`${API}/api/junta/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) { setDocs([]); setForbidden(r.status === 403); setLoadError(r.status === 403 ? 'Solo superadministración puede revisar los documentos de validación.' : 'No se pudieron cargar los documentos.'); return }
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
      {loadError && <Banner kind="error" title={tr(loadError)}>{!forbidden && <Button variant="ghost" onClick={load}>{tr('Reintentar')}</Button>}</Banner>}
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
// ES-315: Cartografía (ItemList/Chip/Banner/Button/TextField/SelectField/CheckField/Dialog), sin estilos en línea. El formulario va en un diálogo ancho nativo.
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
  const formRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const focusAfterSave = useRef<string | null>(null) // E366-2: el campo con error del servidor recibe el foco cuando el formulario vuelve a estar habilitado (mientras guarda, el <fieldset> está deshabilitado)
  useEffect(() => { if (!saving && focusAfterSave.current) { document.getElementById(focusAfterSave.current)?.focus(); focusAfterSave.current = null } }, [saving])

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true)
    setLoadError(false)
    return fetch(`${API}/api/admin/pricing/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() })
      .then(data => { if (!Array.isArray(data)) throw new Error('invalid'); setPlans(data) })
      .catch(() => { setPlans([]); setLoadError(true) })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { void load(true) }, [load])
  useEffect(() => { if (showForm) formRef.current?.querySelector<HTMLInputElement>('input:not([readonly]):not([disabled])')?.focus() }, [showForm])

  // Al abrir, el foco va al primer campo EDITABLE (al editar, el identificador es de solo lectura). El foco vuelve al botón que abrió el diálogo (lo resuelve Dialog). La excepción es «Desactivar»: el botón desaparece al recargar, así que el foco pasa a «Editar» del mismo plan.
  const closeForm = () => setShowForm(false)

  const openNew = () => {
    setForm(emptyPlan); setFeatInputEs(''); setFeatInputEn(''); setErrors({})
    setEditing(null); setShowForm(true); setMsg('')
  }

  const openEdit = (p: PricingPlan) => {
    // E366-2: un plan heredado con moneda o período fuera de lista se abre con lo que el desplegable MUESTRA y el campo marcado (antes se reenviaba el valor heredado y el servidor respondía 400 sin decir el campo).
    const { values, errors: legacy } = normalizeChoices(p)
    setForm({ ...p, ...values }); setFeatInputEs((p.features_es ?? []).join('\n')); setFeatInputEn((p.features_en ?? []).join('\n')); setErrors(legacy)
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
      if (!r.ok) {
        // E366-2: un 400 `invalid_plan` con campo se pinta bajo ESE campo (mensaje bilingüe del servidor) y el foco va a él; cualquier otro fallo, el aviso de siempre.
        const fieldError = serverFieldError(r.status, await r.json().catch(() => null))
        if (fieldError) { setErrors({ [fieldError.id]: fieldError.message }); focusAfterSave.current = fieldError.id; return }
        return setMsg('Error guardando.')
      }
      setMsg(editing ? 'Plan actualizado.' : 'Plan creado.')
      closeForm(); void load()
    } catch { setMsg('Error de conexión.') }
    finally { busyRef.current = false; setSaving(false) }
  }

  const closeConfirm = () => setDeactivating(null)

  const deactivate = async () => {
    if (!deactivating?.id || busyRef.current) return
    const planId = deactivating.id
    busyRef.current = true
    setSaving(true); setMsg('')
    try {
      const response = await fetch(`${API}/api/admin/pricing/${planId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('deactivate')
      setMsg('Plan desactivado.')
      closeConfirm()
      void load().then(() => document.getElementById(`plan-edit-${planId}`)?.focus())
    } catch { setMsg('No se pudo desactivar el plan.') }
    finally { busyRef.current = false; setSaving(false) }
  }

  if (loading) return <p className="cg-hint" role="status">{tr("Cargando planes...")}</p>
  if (loadError) return <Banner kind="error" title={tr('No se pudieron cargar los planes.')}><Button variant="ghost" onClick={() => void load(true)}>{tr('Reintentar')}</Button></Banner>

  return (
    <div className="cg-card ac-panel">
      <p className="ac-status cg-hint" role="status">{!showForm && !deactivating && msg ? tr(msg) : ''}</p>
      <div className="ac-bar">
        <p className="cg-hint">{plans.filter(p => p.isActive).length}{' '}{tr("plan(es) activo(s)")}{' '}</p>
        <Button onClick={openNew}>{tr("+ Nuevo plan")}</Button>
      </div>

      {plans.length === 0 && <p className="cg-hint">{tr("No hay planes. Crea el primero.")}</p>}
      <ul className="cg-items" aria-label={tr('Planes')}>
        {plans.map(p => (
          <li key={p.id} className={`cg-item ac-plan${p.isActive ? '' : ' ac-plan--off'}`}>
            <div className="ac-planhead">
              <strong>{lang === 'en' ? p.name_en : p.name_es}</strong>
              {p.isHighlighted && <Chip tone="ok" symbol="✓">{tr("DESTACADO")}</Chip>}
              {!p.isActive && <Chip tone="bad">{tr("INACTIVO")}</Chip>}
            </div>
            <p className="ac-meta">
              <strong>{['USD', 'COP', 'EUR'].includes(p.currency) && Number.isFinite(Number(p.price)) ? new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CO', { style: 'currency', currency: p.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(p.price)) : `${p.price} ${p.currency}`}</strong>{' · '}{tr(({ month: 'Mensual', year: 'Anual', forever: 'Para siempre' } as Record<string, string>)[p.period] ?? 'Período desconocido')}
            </p>
            <p className="cg-hint ac-meta">{tr('Identificador')}: {p.slug}</p>
            <ul className="ac-feats">
              {((lang === 'en' ? p.features_en : p.features_es) ?? []).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <div className="ac-actions">
              <Button variant="ghost" id={`plan-edit-${p.id}`} onClick={() => openEdit(p)}>{tr("Editar")}</Button>
              {p.isActive && <Button variant="ghost" className="ac-off" disabled={saving} onClick={() => { setMsg(''); setDeactivating(p) }}>{tr("Desactivar")}</Button>}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        wide open={showForm} onClose={() => { if (!saving) closeForm() }}
        title={editing ? tr('Editar plan') : tr('Nuevo plan')}
        actions={<>
          <Button variant="ghost" disabled={saving} onClick={closeForm}>{tr("Cancelar")}{' '}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? tr('Guardando...') : editing ? tr('Actualizar') : tr('Crear plan')}</Button>
        </>}
      >
        <div ref={formRef}>
          <fieldset disabled={saving} className="ac-form">
            <fieldset className="ac-sec">
              <legend>{tr("Identificador")}</legend>
              <TextField id="plan-slug" label={tr("Slug * (sin espacios, ej: basic, essential, plus, pro)")} value={form.slug} readOnly={!!editing} placeholder={tr("ej: basic")} maxLength={20}
                error={errors['plan-slug'] ? tr(errors['plan-slug']) : undefined}
                onChange={e => { setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20) })); setErrors(current => ({ ...current, 'plan-slug': '' })) }} />
            </fieldset>
            <fieldset className="ac-sec">
              <legend>{tr("Nombre del plan")}</legend>
              <div className="ac-grid2">
                <TextField id="plan-name-es" label={tr("Español *")} value={form.name_es} placeholder={tr("ej: Gratis")} error={errors['plan-name-es'] ? tr(errors['plan-name-es']) : undefined}
                  onChange={e => { setForm(f => ({ ...f, name_es: e.target.value })); setErrors(current => ({ ...current, 'plan-name-es': '' })) }} />
                <TextField id="plan-name-en" label={tr("Inglés *")} value={form.name_en} placeholder={tr("ej: Free")} error={errors['plan-name-en'] ? tr(errors['plan-name-en']) : undefined}
                  onChange={e => { setForm(f => ({ ...f, name_en: e.target.value })); setErrors(current => ({ ...current, 'plan-name-en': '' })) }} />
              </div>
            </fieldset>
            <fieldset className="ac-sec">
              <legend>{tr("Descripción")}</legend>
              <TextField id="plan-description-es" label={tr("Español")} value={form.description_es} placeholder={tr("Descripción en español...")} onChange={e => setForm(f => ({ ...f, description_es: e.target.value }))} />
              <TextField id="plan-description-en" label={tr("Inglés")} value={form.description_en} placeholder="Description in English..." onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
            </fieldset>
            <fieldset className="ac-sec">
              <legend>{tr("Precio")}</legend>
              <div className="ac-grid3">
                <TextField id="plan-price" label={tr("Precio")} type="number" min="0" max="99999999.99" step="0.01" value={form.price} error={errors['plan-price'] ? tr(errors['plan-price']) : undefined}
                  onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setErrors(current => ({ ...current, 'plan-price': '' })) }} />
                <SelectField id="plan-currency" label={tr("Moneda")} value={form.currency} error={errors['plan-currency'] || undefined} onChange={e => { setForm(f => ({ ...f, currency: e.target.value })); setErrors(current => ({ ...current, 'plan-currency': '' })) }}>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </SelectField>
                <SelectField id="plan-period" label={tr("Período")} value={form.period} error={errors['plan-period'] || undefined} onChange={e => { setForm(f => ({ ...f, period: e.target.value })); setErrors(current => ({ ...current, 'plan-period': '' })) }}>
                  <option value="month">{tr("Mensual")}</option>
                  <option value="year">{tr("Anual")}</option>
                </SelectField>
              </div>
            </fieldset>
            <div className="ac-grid2">
              <TextAreaField id="plan-features-es" label={tr('Características en español, una por línea')} rows={4} value={featInputEs} onChange={e => setFeatInputEs(e.target.value)} />
              <TextAreaField id="plan-features-en" label={tr('Características en inglés, una por línea')} rows={4} value={featInputEn} onChange={e => setFeatInputEn(e.target.value)} />
            </div>
            <fieldset className="ac-sec">
              <legend>{tr("Opciones")}</legend>
              <div className="ac-opts">
                <TextField id="plan-order" className="ac-order" label={tr("Orden")} type="number" min="0" value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
                <CheckField label={tr("Destacado")} checked={form.isHighlighted} onChange={e => setForm(f => ({ ...f, isHighlighted: e.target.checked }))} />
                <CheckField label={tr("Activo")} checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              </div>
            </fieldset>
            {msg && <Banner kind="error" title={tr(msg)} />}
          </fieldset>
        </div>
      </Dialog>

      <Dialog
        open={!!deactivating} onClose={() => { if (!saving) closeConfirm() }} title={tr('¿Desactivar este plan?')}
        actions={<>
          <Button variant="ghost" disabled={saving} onClick={closeConfirm}>{tr('Cancelar')}</Button>
          <Button variant="danger" disabled={saving} onClick={() => void deactivate()}>{saving ? tr('Procesando...') : tr('Desactivar')}</Button>
        </>}
      >
        <p>{tr('El plan deja de verse en precios; las solicitudes realizadas se conservan. Puedes reactivarlo editándolo.')}</p>
        {msg && <Banner kind="error" title={tr(msg)} />}
      </Dialog>
    </div>
  )
}

// ES-199 (PERF-05): cada fila guarda su propio texto y está memoizada. Antes cada pulsación hacía setContent en LandingTab y repintaba las 340 filas (~70 ms de JS por tecla con CPU ×4, sin contar los estilos).
// Con `memo` y propiedades primitivas o estables, escribir en un campo solo repinta ese campo.
// ES-279: el conflicto de edición simultánea va POR FILA (la fila memoizada recibe `conflict` y `forced` estables: solo se repinta la fila afectada). «Conservar la mía» reenvía con la versión vigente;
// «Usar la suya» solo pone su texto en el campo (`forced`) sin guardar.
type Conflict = { current: LandingVersion | null }
const withoutKey = <T,>(map: Record<string, T>, key: string): Record<string, T> => (key in map ? Object.fromEntries(Object.entries(map).filter(([k]) => k !== key)) : map)
type Forced = { nonce: number; value: string }
const LandingRow = memo(function LandingRow({ fieldKey, label, initial, saving, busy, message, conflict, forced, onSave, onEdited, onKeepMine, onUseTheirs }: {
  fieldKey: string; label: string; initial: string; saving: boolean; busy: boolean; message: string; conflict: Conflict | null; forced: Forced | null
  onSave: (key: string, value: string) => void; onEdited: (key: string) => void; onKeepMine: (key: string, value: string) => void; onUseTheirs: (key: string) => void
}) {
  const tr = useAdminText()
  const [value, setValue] = useState(initial)
  // «Usar la suya» pone el texto ajeno en el campo: se ajusta durante el render al cambiar `forced` (patrón recomendado; no hace falta un efecto).
  const [seenForced, setSeenForced] = useState(forced)
  if (forced !== seenForced) { setSeenForced(forced); if (forced) setValue(forced.value) }
  return (
    <li className="cg-item ac-frow">
      <TextField id={`landing-${fieldKey}`} label={tr(label)} disabled={saving} value={value} onChange={e => { setValue(e.target.value); if (message) onEdited(fieldKey) }}
        aria-invalid={conflict ? true : undefined} aria-describedby={conflict ? conflictId(fieldKey) : undefined} />
      <div className="ac-fact"><Button onClick={() => onSave(fieldKey, value)} aria-disabled={busy}>{saving ? '...' : tr('Guardar')}</Button></div>
      {message && <p role="status" className={message.startsWith('✓') ? 'cg-hint' : 'cg-error'}>{tr(message)}</p>}
      {conflict && <LandingConflict key={conflict.current?.updatedAt ?? 'none'} fieldKey={fieldKey} current={conflict.current} mine={value} busy={busy} onKeepMine={() => onKeepMine(fieldKey, value)} onUseTheirs={() => onUseTheirs(fieldKey)} />}
    </li>
  )
})

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
  // ES-279: versión (updatedAt) de cada texto, leída de /versions al cargar y renovada tras cada guardado; conflictos por fila; «Usar la suya» por fila.
  const versionsRef = useRef<Record<string, string>>({})
  const [conflicts, setConflicts] = useState<Record<string, Conflict>>({})
  const [forced, setForced] = useState<Record<string, Forced>>({})

  const fields = useMemo(() => [
    { key: 'hero_title',         label: 'Título Hero' },
    { key: 'hero_subtitle',      label: 'Subtítulo Hero' },
    { key: 'cta_primary',        label: 'CTA Principal' },
    ...landingFields.filter(({ key }) => !PENDING_KEYS.has(key)).map(({ key }) => ({ key, label: landingFieldLabel(key, interfaceLang) })), // ES-90: los pendientes se editan en su panel
  ], [interfaceLang])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(false)
    setMsgs({}); setConflicts({}); setForced({}); versionsRef.current = {}
    const headers = { Authorization: `Bearer ${token}` }
    // Los textos y sus versiones se leen juntos: sin las versiones el servidor no puede proteger la edición, así que si no llegan es un error de carga. Una persona sin superadministración (403) puede leer, no guardar.
    Promise.all([
      fetch(`${API}/api/landing-content/admin?lang=${lang}`, { headers, signal: controller.signal }),
      fetch(`${API}/api/landing-content/versions?lang=${lang}`, { headers, signal: controller.signal, cache: 'no-store' }),
    ])
      .then(async ([r, v]) => {
        if (!r.ok) throw new Error('load')
        const data = await r.json()
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid')
        let versions: Record<string, string> | null = {}
        if (v.status !== 403) { if (!v.ok) throw new Error('versions'); versions = readVersions(await v.json()); if (!versions) throw new Error('versions') }
        return { data, versions }
      })
      .then(({ data, versions }) => {
        if (!controller.signal.aborted) { versionsRef.current = versions; setContent(data) }
      })
      .catch(() => { if (!controller.signal.aborted) { setContent({}); setLoadError(true) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [lang, token, attempt])

  // Al resolver un conflicto el foco vuelve al campo (el de la fila o el del panel de pendientes).
  const focusField = (key: string) => (document.getElementById(`landing-${key}`) ?? document.getElementById(`pending-${key}`))?.focus()
  // Tras guardar el campo está deshabilitado hasta que termina el guardado: el foco se devuelve cuando `saving` vuelve a null.
  const pendingFocus = useRef<string | null>(null)
  useEffect(() => { if (saving === null && pendingFocus.current) { const key = pendingFocus.current; pendingFocus.current = null; focusField(key) } }, [saving])
  const saveField = useCallback(async (key: string, value: string | undefined, expected?: string | null) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(key); setMsgs(m => ({ ...m, [key]: '' }))
    try {
      const sent = expected !== undefined ? expected : expectedFor(versionsRef.current, key)
      const r = await fetch(`${API}/api/landing-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, lang, value, expectedUpdatedAt: sent }),
      })
      const outcome = readSaveOutcome(r.status, await r.json().catch(() => null))
      if (outcome.kind === 'conflict') {
        // No se escribió nada y lo escrito se conserva: el aviso aparece en la fila y manda el texto vigente (o «ya no existe»).
        setConflicts(c => ({ ...c, [key]: { current: outcome.current } }))
      } else {
        if (outcome.kind === 'saved') {
          if (outcome.updatedAt) versionsRef.current = { ...versionsRef.current, [key]: outcome.updatedAt }
          setConflicts(c => withoutKey(c, key))
          pendingFocus.current = key
        }
        setMsgs(m => ({ ...m, [key]: outcome.kind === 'saved' ? '✓ Guardado' : outcome.kind === 'forbidden' ? 'Solo superadmin puede guardar textos.' : 'Error guardando.' }))
      }
    } catch {
      setMsgs(m => ({ ...m, [key]: 'Error de conexión.' }))
    } finally { savingRef.current = false; setSaving(null) }
  }, [lang, token])
  const clearMessage = useCallback((key: string) => setMsgs(m => ({ ...m, [key]: '' })), [])
  // «Conservar la mía»: reenvía el MISMO texto con la versión vigente (null si el texto ya no existe). Si vuelve a dar 409 se repite el aviso con la versión nueva.
  const keepMine = useCallback((key: string, value: string | undefined) => { void saveField(key, value, conflicts[key]?.current?.updatedAt ?? null) }, [saveField, conflicts])
  // «Usar la suya»: pone su texto en el campo y toma su versión como esperada; NO guarda.
  const useTheirs = useCallback((key: string) => {
    const theirs = conflicts[key]?.current; if (!theirs) return
    versionsRef.current = { ...versionsRef.current, [key]: theirs.updatedAt }
    setConflicts(c => withoutKey(c, key))
    setForced(f => ({ ...f, [key]: { nonce: (f[key]?.nonce ?? 0) + 1, value: theirs.value } }))
    setContent(c => ({ ...c, [key]: theirs.value })); setMsgs(m => ({ ...m, [key]: '' }))
    focusField(key)
  }, [conflicts])
  const keepMineRow = useCallback((key: string, value: string) => keepMine(key, value), [keepMine])

  if (loading) return <p className="cg-hint" role="status">{tr("Cargando contenido...")}</p>
  if (loadError) return <Banner kind="error" title={tr('No se pudo cargar el contenido.')}><Button variant="ghost" onClick={() => setAttempt(n => n + 1)}>{tr('Reintentar')}</Button></Banner>

  return (
    <div className="cg-card ac-panel">
      <div className="cg-lang ac-lang" role="group" aria-label={tr('Idioma')}>
        {(['es', 'en'] as const).map(l => (
          <button key={l} type="button" className="cg-lang__btn" disabled={saving !== null} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <LandingPendingPanel lang={lang} content={content} setValue={(key, value) => { setContent(c => ({ ...c, [key]: value })); setMsgs(m => ({ ...m, [key]: '' })) }} save={key => void saveField(key, content[key])} saving={saving} msgs={msgs} conflicts={conflicts} onKeepMine={key => keepMine(key, content[key])} onUseTheirs={useTheirs} />
      <h2 className="ac-h2">{tr('Otros textos')}</h2>
      <ul className="cg-items" aria-label={tr('Otros textos')}>
        {fields.map(f => <LandingRow key={f.key} fieldKey={f.key} label={f.label} initial={content[f.key] ?? ''} saving={saving === f.key} busy={saving !== null} message={msgs[f.key] ?? ''} conflict={conflicts[f.key] ?? null} forced={forced[f.key] ?? null} onSave={saveField} onEdited={clearMessage} onKeepMine={keepMineRow} onUseTheirs={useTheirs} />)}
      </ul>
    </div>
  )
}

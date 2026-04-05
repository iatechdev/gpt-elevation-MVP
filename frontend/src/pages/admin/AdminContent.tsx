// frontend/src/pages/admin/AdminContent.tsx
// HU-074 — CMS completo: Landing content + Pricing plans (bilingüe)

import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface PricingPlan {
  id?: number
  name_es: string
  name_en: string
  description_es: string
  description_en: string
  price: number
  currency: string
  period: string
  features_es: string[]
  features_en: string[]
  isHighlighted: boolean
  isActive: boolean
  order: number
}

const emptyPlan: PricingPlan = {
  name_es: '', name_en: '',
  description_es: '', description_en: '',
  price: 0, currency: 'USD', period: 'month',
  features_es: [], features_en: [],
  isHighlighted: false, isActive: true, order: 0,
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', border: '0.5px solid #E7E5E4',
  borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem',
}
const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#78716C',
  letterSpacing: '0.05em', display: 'block', marginBottom: 4,
}
const input: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.65rem',
  border: '0.5px solid #D6D2C4', fontSize: 13, color: '#1C1917',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  background: '#6B7D5C', color: '#fff', border: 'none',
  borderRadius: '0.75rem', padding: '0.6rem 1.25rem',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#6B7D5C', border: '0.5px solid #A8B5A2',
  borderRadius: '0.75rem', padding: '0.6rem 1.25rem',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const btnDanger: React.CSSProperties = {
  background: 'transparent', color: '#DC2626', border: '0.5px solid #DC2626',
  borderRadius: '0.75rem', padding: '0.5rem 1rem',
  fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7D5C',
  letterSpacing: '0.08em', textTransform: 'uppercase',
  margin: '0 0 0.75rem', paddingBottom: '0.4rem',
  borderBottom: '0.5px solid #EAF0E6',
}

// ── Componente principal ──────────────────────────────────────────────────────
export function AdminContent() {
  const [tab, setTab] = useState<'pricing' | 'landing'>('pricing')

  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.8rem', color: '#1C1917', marginBottom: '0.25rem' }}>
        Contenido
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#78716C', marginBottom: '1.5rem' }}>
        Gestión de páginas públicas y planes de precios
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', borderBottom: '0.5px solid #E7E5E4' }}>
        {(['pricing', 'landing'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, padding: '0.5rem 1rem',
              color: tab === t ? '#6B7D5C' : '#78716C',
              borderBottom: tab === t ? '2px solid #6B7D5C' : '2px solid transparent',
              fontFamily: 'Inter, sans-serif', marginBottom: -1,
            }}>
            {t === 'pricing' ? '💰 Precios' : '🌐 Landing'}
          </button>
        ))}
      </div>

      {tab === 'pricing' && <PricingTab />}
      {tab === 'landing' && <LandingTab />}
    </div>
  )
}

// ── Tab Precios ───────────────────────────────────────────────────────────────
function PricingTab() {
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

  const load = () => {
    setLoading(true)
    fetch(`${API}/api/admin/pricing/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setPlans(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm(emptyPlan)
    setFeatInputEs(''); setFeatInputEn('')
    setEditing(null); setShowForm(true); setMsg('')
  }

  const openEdit = (p: PricingPlan) => {
    setForm({ ...p })
    setFeatInputEs(''); setFeatInputEn('')
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
    if (!form.name_es.trim() || !form.name_en.trim())
      return setMsg('El nombre en español e inglés son requeridos.')
    setSaving(true); setMsg('')
    try {
      const url    = editing?.id ? `${API}/api/admin/pricing/${editing.id}` : `${API}/api/admin/pricing`
      const method = editing?.id ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) return setMsg(data.error ?? 'Error guardando.')
      setMsg(editing ? 'Plan actualizado.' : 'Plan creado.')
      setShowForm(false)
      load()
    } catch { setMsg('Error de conexión.') }
    finally { setSaving(false) }
  }

  const deactivate = async (id: number) => {
    if (!confirm('¿Desactivar este plan?')) return
    await fetch(`${API}/api/admin/pricing/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  if (loading) return <p style={{ color: '#78716C', fontSize: 13 }}>Cargando planes...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ fontSize: 13, color: '#78716C', margin: 0 }}>
          {plans.filter(p => p.isActive).length} plan(es) activo(s)
        </p>
        <button style={btnPrimary} onClick={openNew}>+ Nuevo plan</button>
      </div>

      {/* Lista */}
      {plans.map(p => (
        <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', opacity: p.isActive ? 1 : 0.5 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{p.name_es}</span>
              <span style={{ fontSize: 11, color: '#A8A29E' }}>/ {p.name_en}</span>
              {p.isHighlighted && (
                <span style={{ fontSize: 10, background: '#EAF0E6', color: '#6B7D5C', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>DESTACADO</span>
              )}
              {!p.isActive && (
                <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: 10 }}>INACTIVO</span>
              )}
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
            <button style={btnSecondary} onClick={() => openEdit(p)}>Editar</button>
            {p.isActive && <button style={btnDanger} onClick={() => deactivate(p.id!)}>Desactivar</button>}
          </div>
        </div>
      ))}

      {plans.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#78716C', fontSize: 13 }}>
          No hay planes. Creá el primero.
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 1.5rem' }}>
              {editing ? 'Editar plan' : 'Nuevo plan'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Nombres */}
              <div>
                <p style={sectionTitle}>Nombre del plan</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={label}>Español *</label>
                    <input style={input} value={form.name_es} placeholder="ej: Gratis"
                      onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Inglés *</label>
                    <input style={input} value={form.name_en} placeholder="ej: Free"
                      onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <p style={sectionTitle}>Descripción</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={label}>Español</label>
                    <input style={input} value={form.description_es} placeholder="Descripción en español..."
                      onChange={e => setForm(f => ({ ...f, description_es: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Inglés</label>
                    <input style={input} value={form.description_en} placeholder="Description in English..."
                      onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Precio */}
              <div>
                <p style={sectionTitle}>Precio</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8 }}>
                  <div>
                    <label style={label}>Precio</label>
                    <input style={input} type="number" min="0" step="0.01" value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={label}>Moneda</label>
                    <select style={{ ...input }} value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="USD">USD</option>
                      <option value="COP">COP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>Período</label>
                    <select style={{ ...input }} value={form.period}
                      onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                      <option value="month">Mensual</option>
                      <option value="year">Anual</option>
                      <option value="forever">Para siempre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Features ES */}
              <div>
                <p style={sectionTitle}>Características en Español</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...input, flex: 1 }} value={featInputEs}
                    onChange={e => setFeatInputEs(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFeature('es')}
                    placeholder="ej: Conversaciones ilimitadas" />
                  <button style={btnSecondary} onClick={() => addFeature('es')}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {form.features_es.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F3', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#1C1917' }}>{f}</span>
                      <button onClick={() => removeFeature('es', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features EN */}
              <div>
                <p style={sectionTitle}>Características en Inglés</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...input, flex: 1 }} value={featInputEn}
                    onChange={e => setFeatInputEn(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFeature('en')}
                    placeholder="ej: Unlimited conversations" />
                  <button style={btnSecondary} onClick={() => addFeature('en')}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {form.features_en.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F3', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#1C1917' }}>{f}</span>
                      <button onClick={() => removeFeature('en', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opciones */}
              <div>
                <p style={sectionTitle}>Opciones</p>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <label style={label}>Orden (posición)</label>
                    <input style={{ ...input, width: 80 }} type="number" min="0" value={form.order}
                      onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', paddingBottom: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isHighlighted}
                        onChange={e => setForm(f => ({ ...f, isHighlighted: e.target.checked }))} />
                      Destacado
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isActive}
                        onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                      Activo
                    </label>
                  </div>
                </div>
              </div>

              {msg && (
                <p style={{ fontSize: 12, color: msg.includes('Error') || msg.includes('requerido') ? '#DC2626' : '#6B7D5C', margin: 0 }}>
                  {msg}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button style={btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
                <button style={btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Landing ───────────────────────────────────────────────────────────────
function LandingTab() {
  const token = localStorage.getItem('elevation_token') ?? ''
  const [lang, setLang]       = useState<'es' | 'en'>('es')
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [msgs, setMsgs]       = useState<Record<string, string>>({})

  const fields = [
    { key: 'hero_title',         label: 'Título Hero' },
    { key: 'hero_subtitle',      label: 'Subtítulo Hero' },
    { key: 'cta_primary',        label: 'CTA Principal' },
    { key: 'cta_final_title',    label: 'Título CTA Final' },
    { key: 'cta_final_subtitle', label: 'Subtítulo CTA Final' },
  ]

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/landing-content?lang=${lang}`)
      .then(r => r.json())
      .then(data => { setContent(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [lang])

  const saveField = async (key: string) => {
    setSaving(key)
    setMsgs(m => ({ ...m, [key]: '' }))
    try {
      const r = await fetch(`${API}/api/landing-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, lang, value: content[key] }),
      })
      const data = await r.json()
      setMsgs(m => ({ ...m, [key]: r.ok ? '✓ Guardado' : (data.error ?? 'Error') }))
    } catch {
      setMsgs(m => ({ ...m, [key]: 'Error de conexión.' }))
    } finally { setSaving(null) }
  }

  if (loading) return <p style={{ color: '#78716C', fontSize: 13 }}>Cargando contenido...</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
        {(['es', 'en'] as const).map(l => (
          <button key={l} onClick={() => setLang(l)}
            style={{ ...btnSecondary, background: lang === l ? '#6B7D5C' : 'transparent', color: lang === l ? '#fff' : '#6B7D5C' }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {fields.map(f => (
        <div key={f.key} style={card}>
          <label style={label}>{f.label}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input style={{ ...input, flex: 1 }}
              value={content[f.key] ?? ''}
              onChange={e => setContent(c => ({ ...c, [f.key]: e.target.value }))} />
            <button style={btnPrimary} onClick={() => saveField(f.key)} disabled={saving === f.key}>
              {saving === f.key ? '...' : 'Guardar'}
            </button>
          </div>
          {msgs[f.key] && (
            <p style={{ fontSize: 11, color: msgs[f.key].startsWith('✓') ? '#6B7D5C' : '#DC2626', margin: '4px 0 0' }}>
              {msgs[f.key]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
// frontend/src/pages/admin/AdminPrompts.tsx
// HU-029 + HU-033 + HU-030 — Editor de prompts + versionado + aprobación
// Rol admin: ver prompts activos + proponer versiones
// Rol superadmin: todo lo anterior + aprobar/rechazar/crear prompt global

import { useState, useEffect } from 'react'

const API      = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'
const getToken = () => localStorage.getItem('elevation_token') ?? ''

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface PromptEntry {
  key:       string
  version:   number
  isActive:  boolean
  status:    string
  updatedBy: string
  updatedAt: string
  approved_by:  string | null
  approved_at:  string | null
  proposed_by:  string | null
  rejected_by:  string | null
  rejection_note: string | null
  content:   string | null
}

interface PromptVersion {
  id:             number
  key:            string
  version:        number
  status:         string
  proposed_by:    string | null
  approved_by:    string | null
  rejected_by:    string | null
  rejection_note: string | null
  approved_at:    string | null
  rejected_at:    string | null
  updatedAt:      string
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff', border: '0.5px solid #E7E5E4',
  borderRadius: '1rem', padding: '1.5rem',
  boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
}

const btnPrimary: React.CSSProperties = {
  background: '#6B7D5C', color: '#fff', border: 'none',
  borderRadius: '0.65rem', padding: '0.5rem 1rem',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#6B7D5C',
  border: '0.5px solid #A8B5A2', borderRadius: '0.65rem',
  padding: '0.5rem 1rem', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}

const btnDanger: React.CSSProperties = {
  background: 'transparent', color: '#DC2626',
  border: '0.5px solid #DC2626', borderRadius: '0.65rem',
  padding: '0.5rem 1rem', fontSize: 13,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active:         { bg: '#EAF0E6', color: '#4A6741', label: '● Activo' },
  approved:       { bg: '#EAF0E6', color: '#4A6741', label: '● Aprobado' },
  pending_review: { bg: '#FEF3C7', color: '#92400E', label: '⏳ Pendiente' },
  rejected:       { bg: '#FEE2E2', color: '#DC2626', label: '✗ Rechazado' },
  archived:       { bg: '#F5F3EF', color: '#A8A29E', label: '● Archivado' },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ── Componente principal ──────────────────────────────────────────────────────
export function AdminPrompts() {
  const role         = localStorage.getItem('elevation_role') ?? 'admin'
  const esSuperAdmin = role === 'superadmin'

  const [prompts,  setPrompts]  = useState<PromptEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<PromptEntry | null>(null)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Proponer nueva versión
  const [showPropose,  setShowPropose]  = useState(false)
  const [proposeKey,   setProposeKey]   = useState('')
  const [proposeContent, setProposeContent] = useState('')
  const [proposing,    setProposing]    = useState(false)
  const [proposeMsg,   setProposeMsg]   = useState('')
  const [proposeError, setProposeError] = useState('')

  // Crear prompt global (solo superadmin)
  const [showCreate,    setShowCreate]    = useState(false)
  const [createKey,     setCreateKey]     = useState('')
  const [createContent, setCreateContent] = useState('')
  const [creating,      setCreating]      = useState(false)
  const [createMsg,     setCreateMsg]     = useState('')
  const [createError,   setCreateError]   = useState('')

  // Aprobar / rechazar (solo superadmin)
  const [actionId,     setActionId]     = useState<number | null>(null)
  const [rejectNote,   setRejectNote]   = useState('')
  const [showReject,   setShowReject]   = useState<PromptVersion | null>(null)
  const [actionMsg,    setActionMsg]    = useState('')

  // Ver contenido activo
  const [showContent, setShowContent] = useState(false)

  const fetchPrompts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/prompts`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPrompts(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPrompts() }, [])

  const selectPrompt = async (prompt: PromptEntry) => {
    setSelected(prompt)
    setShowContent(false)
    setActionMsg('')

    // Cargar contenido activo
    try {
      const res = await fetch(`${API}/api/admin/prompt/${prompt.key}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSelected(prev => prev ? { ...prev, content: data.content } : null)
      }
    } catch { /* silent */ }

    // Cargar versiones (solo superadmin)
    if (esSuperAdmin) {
      setLoadingVersions(true)
      try {
        const res = await fetch(`${API}/api/superadmin/prompt/${prompt.key}/versions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setVersions(await res.json())
      } catch { /* silent */ }
      finally { setLoadingVersions(false) }
    }
  }

  const handlePropose = async () => {
    setProposeError(''); setProposeMsg('')
    if (proposeContent.trim().length < 10) {
      setProposeError('El contenido debe tener al menos 10 caracteres.'); return
    }
    setProposing(true)
    try {
      // Admin propone, superadmin crea directamente
      const url    = esSuperAdmin ? `${API}/api/superadmin/prompt` : `${API}/api/admin/prompt/propose`
      const body   = esSuperAdmin
        ? { key: proposeKey || selected?.key, content: proposeContent }
        : { key: selected?.key, content: proposeContent }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setProposeError(data.error || 'Error al enviar.'); return }
      setProposeMsg(esSuperAdmin ? '✓ Prompt actualizado y activo.' : '✓ Propuesta enviada al superadmin para revisión.')
      setShowPropose(false); setProposeContent('')
      await fetchPrompts()
      if (selected) await selectPrompt(selected)
      setTimeout(() => setProposeMsg(''), 3000)
    } catch { setProposeError('Error de conexión.') }
    finally { setProposing(false) }
  }

  const handleCreate = async () => {
    setCreateError(''); setCreateMsg('')
    if (!createKey.trim()) { setCreateError('El key es requerido.'); return }
    if (createContent.trim().length < 10) { setCreateError('El contenido debe tener al menos 10 caracteres.'); return }
    setCreating(true)
    try {
      const res = await fetch(`${API}/api/admin/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ key: createKey.trim(), content: createContent }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Error al crear.'); return }
      setCreateMsg('✓ Prompt creado y activo.')
      setShowCreate(false); setCreateKey(''); setCreateContent('')
      await fetchPrompts()
      setTimeout(() => setCreateMsg(''), 3000)
    } catch { setCreateError('Error de conexión.') }
    finally { setCreating(false) }
  }

  const handleApprove = async (version: PromptVersion) => {
    setActionId(version.id); setActionMsg('')
    try {
      const res = await fetch(`${API}/api/superadmin/prompt/${version.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) { setActionMsg(data.error || 'Error al aprobar.'); return }
      setActionMsg('✓ Versión aprobada y activa.')
      await fetchPrompts()
      if (selected) await selectPrompt(selected)
    } catch { setActionMsg('Error de conexión.') }
    finally { setActionId(null) }
  }

  const handleReject = async () => {
    if (!showReject) return
    setActionId(showReject.id); setActionMsg('')
    try {
      const res = await fetch(`${API}/api/superadmin/prompt/${showReject.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ note: rejectNote }),
      })
      const data = await res.json()
      if (!res.ok) { setActionMsg(data.error || 'Error al rechazar.'); return }
      setActionMsg('✓ Versión rechazada.')
      setShowReject(null); setRejectNote('')
      await fetchPrompts()
      if (selected) await selectPrompt(selected)
    } catch { setActionMsg('Error de conexión.') }
    finally { setActionId(null) }
  }

  const pendingVersions = versions.filter(v => v.status === 'pending_review')

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>
            Prompts
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
            {esSuperAdmin ? 'Gestión completa de prompts terapéuticos' : 'Visualización y propuesta de prompts'}
          </p>
        </div>
        {esSuperAdmin && (
          <button
            onClick={() => { setShowCreate(true); setCreateKey(''); setCreateContent(''); setCreateError(''); setCreateMsg('') }}
            style={btnPrimary}
          >
            + Nuevo prompt
          </button>
        )}
      </div>

      {/* Mensajes globales */}
      {(proposeMsg || createMsg || actionMsg) && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', marginBottom: '1rem', fontSize: 13, background: '#EAF0E6', color: '#4A6741' }}>
          {proposeMsg || createMsg || actionMsg}
        </div>
      )}

      {/* Alerta de versiones pendientes (superadmin) */}
      {esSuperAdmin && selected && pendingVersions.length > 0 && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', marginBottom: '1rem', fontSize: 13, background: '#FEF3C7', color: '#92400E', border: '0.5px solid #FCD34D' }}>
          ⏳ {pendingVersions.length} versión{pendingVersions.length > 1 ? 'es' : ''} pendiente{pendingVersions.length > 1 ? 's' : ''} de aprobación para <strong>{selected.key}</strong>
        </div>
      )}

      {loading && <p style={{ color: '#78716C', fontSize: 13 }}>Cargando prompts...</p>}

      {!loading && (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

          {/* LISTA DE PROMPTS */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {prompts.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#78716C', fontSize: 13 }}>
                No hay prompts configurados aún.
              </div>
            ) : (
              prompts.map(p => {
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.archived
                const isSelected = selected?.key === p.key
                return (
                  <div
                    key={p.key}
                    onClick={() => selectPrompt(p)}
                    style={{
                      ...cardStyle,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #6B7D5C' : '0.5px solid #E7E5E4',
                      background: isSelected ? '#EAF0E6' : '#fff',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#1C1917' }}>{p.key}</div>
                      <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>
                        v{p.version} · Actualizado por {p.updatedBy} · {formatDate(p.updatedAt)}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                      {badge.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* PANEL LATERAL — detalle del prompt seleccionado */}
          {selected && (
            <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Info del prompt */}
              <div style={cardStyle}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  {selected.key}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 12, color: '#78716C', marginBottom: '1rem' }}>
                  <div>Versión activa: <strong style={{ color: '#1C1917' }}>v{selected.version}</strong></div>
                  {selected.approved_by && <div>Aprobado por: <strong style={{ color: '#1C1917' }}>{selected.approved_by}</strong></div>}
                  {selected.approved_at && <div>Fecha: {formatDate(selected.approved_at)}</div>}
                </div>

                {/* Ver contenido */}
                <button
                  onClick={() => setShowContent(!showContent)}
                  style={{ ...btnSecondary, width: '100%', marginBottom: '0.5rem' }}
                >
                  {showContent ? 'Ocultar contenido' : 'Ver contenido activo'}
                </button>

                {showContent && selected.content && (
                  <div style={{ background: '#F5F3EF', borderRadius: '0.65rem', padding: '0.75rem', fontSize: 12, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', marginBottom: '0.5rem' }}>
                    {selected.content}
                  </div>
                )}

                {/* Proponer nueva versión */}
                <button
                  onClick={() => { setShowPropose(true); setProposeContent(selected.content ?? ''); setProposeKey(selected.key); setProposeError(''); setProposeMsg('') }}
                  style={{ ...btnPrimary, width: '100%' }}
                >
                  {esSuperAdmin ? '✏️ Editar / nueva versión' : '✏️ Proponer nueva versión'}
                </button>
              </div>

              {/* Historial de versiones (solo superadmin) */}
              {esSuperAdmin && (
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Historial de versiones
                  </div>
                  {loadingVersions ? (
                    <p style={{ fontSize: 12, color: '#78716C', margin: 0 }}>Cargando...</p>
                  ) : versions.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#78716C', margin: 0 }}>Sin versiones anteriores.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {versions.map(v => {
                        const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.archived
                        const isPending = v.status === 'pending_review'
                        return (
                          <div key={v.id} style={{ padding: '0.65rem 0.75rem', borderRadius: '0.65rem', background: isPending ? '#FFFBEB' : '#F5F3EF', border: isPending ? '0.5px solid #FCD34D' : '0.5px solid transparent' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1917' }}>v{v.version}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: badge.bg, color: badge.color }}>
                                {badge.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#78716C' }}>
                              {v.proposed_by && <div>Propuesto por: {v.proposed_by}</div>}
                              {v.approved_by && <div>Aprobado por: {v.approved_by}</div>}
                              {v.rejected_by && <div>Rechazado por: {v.rejected_by}</div>}
                              {v.rejection_note && <div style={{ fontStyle: 'italic', marginTop: 2 }}>"{v.rejection_note}"</div>}
                              <div style={{ marginTop: 2 }}>{formatDate(v.updatedAt)}</div>
                            </div>
                            {/* Acciones superadmin sobre versiones pendientes */}
                            {isPending && (
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                <button
                                  onClick={() => handleApprove(v)}
                                  disabled={actionId === v.id}
                                  style={{ ...btnPrimary, fontSize: 11, padding: '0.3rem 0.65rem', flex: 1, background: actionId === v.id ? '#A8B5A2' : '#6B7D5C' }}
                                >
                                  {actionId === v.id ? '...' : '✓ Aprobar'}
                                </button>
                                <button
                                  onClick={() => { setShowReject(v); setRejectNote('') }}
                                  disabled={actionId === v.id}
                                  style={{ ...btnDanger, fontSize: 11, padding: '0.3rem 0.65rem', flex: 1 }}
                                >
                                  ✗ Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Panel para admin — info sobre su rol */}
              {!esSuperAdmin && (
                <div style={{ ...cardStyle, background: '#F5F3EF', fontSize: 12, color: '#78716C', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 600, color: '#1C1917', marginBottom: '0.35rem' }}>ℹ️ Sobre las propuestas</div>
                  Al proponer una nueva versión, el superadmin recibirá una notificación para revisarla. La versión actual permanece activa hasta que sea aprobada la nueva.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL — Proponer / Editar versión */}
      {showPropose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                {esSuperAdmin ? 'Editar prompt' : 'Proponer nueva versión'}
              </h2>
              <button onClick={() => setShowPropose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#78716C' }}>✕</button>
            </div>

            <div style={{ marginBottom: '0.75rem', fontSize: 12, color: '#78716C' }}>
              Prompt: <strong style={{ color: '#1C1917' }}>{selected?.key}</strong>
              {!esSuperAdmin && (
                <span style={{ marginLeft: 8, fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '1px 8px', borderRadius: 999 }}>
                  Requiere aprobación del superadmin
                </span>
              )}
            </div>

            <textarea
              value={proposeContent}
              onChange={e => setProposeContent(e.target.value)}
              rows={10}
              placeholder="Contenido del prompt..."
              style={{ width: '100%', padding: '0.75rem', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#1C1917', boxSizing: 'border-box', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: '#A8A29E', marginTop: '0.25rem', marginBottom: '1rem' }}>
              {proposeContent.length} caracteres
            </div>

            {proposeError && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: 13, marginBottom: '1rem' }}>{proposeError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowPropose(false)} style={{ ...btnSecondary, flex: 1, padding: '0.7rem' }}>Cancelar</button>
              <button
                onClick={handlePropose}
                disabled={proposing}
                style={{ ...btnPrimary, flex: 2, padding: '0.7rem', background: proposing ? '#A8B5A2' : '#6B7D5C', cursor: proposing ? 'not-allowed' : 'pointer' }}
              >
                {proposing ? 'Enviando...' : esSuperAdmin ? 'Guardar y activar' : 'Enviar para aprobación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — Crear prompt global (solo superadmin) */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                Nuevo prompt
              </h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#78716C' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Key del prompt *</label>
              <input
                value={createKey}
                onChange={e => setCreateKey(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                placeholder="ej: elevation_system_prompt"
                style={{ width: '100%', padding: '0.6rem 0.75rem', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#1C1917', boxSizing: 'border-box', outline: 'none' }}
              />
              <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 3 }}>Solo minúsculas y guiones bajos</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Contenido *</label>
              <textarea
                value={createContent}
                onChange={e => setCreateContent(e.target.value)}
                rows={8}
                placeholder="Escribí el contenido del prompt..."
                style={{ width: '100%', padding: '0.75rem', border: '0.5px solid #E7E5E4', borderRadius: '0.65rem', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#1C1917', boxSizing: 'border-box', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {createError && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: 13, marginBottom: '1rem' }}>{createError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowCreate(false)} style={{ ...btnSecondary, flex: 1, padding: '0.7rem' }}>Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ ...btnPrimary, flex: 2, padding: '0.7rem', background: creating ? '#A8B5A2' : '#6B7D5C', cursor: creating ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Creando...' : 'Crear y activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — Rechazar versión */}
      {showReject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              ✗ Rechazar versión v{showReject.version}
            </h3>
            <p style={{ fontSize: 13, color: '#78716C', margin: '0 0 1rem' }}>
              Propuesta por <strong>{showReject.proposed_by}</strong>. Explicá el motivo del rechazo.
            </p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Ej: El tono no es coherente con la guía ética..."
              rows={3}
              style={{ width: '100%', padding: '0.6rem 0.75rem', border: '0.5px solid #D6D2C4', borderRadius: '0.65rem', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => { setShowReject(null); setRejectNote('') }} style={{ ...btnSecondary, flex: 1, padding: '0.65rem' }}>Cancelar</button>
              <button
                onClick={handleReject}
                disabled={!rejectNote.trim() || actionId === showReject.id}
                style={{ ...btnDanger, flex: 1, padding: '0.65rem', background: !rejectNote.trim() ? '#F5F3EF' : 'transparent', color: !rejectNote.trim() ? '#A8A29E' : '#DC2626', cursor: !rejectNote.trim() ? 'not-allowed' : 'pointer' }}
              >
                {actionId === showReject.id ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
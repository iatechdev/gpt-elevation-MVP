// frontend/src/pages/admin/AdminPrompts.tsx
import { useState, useEffect, useCallback } from 'react'
import { colors, radius, cardStyle, labelStyle, btnPrimaryStyle, btnSecondaryStyle, spacing, typography } from '../../styles/tokens'

const API = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'
const token = () => localStorage.getItem('elevation_token') ?? ''
const role  = () => localStorage.getItem('elevation_role')  ?? ''

type PromptRow = { key: string; version: number; isActive: boolean; updatedBy: string; updatedAt: string }
type Version   = {
  id: number; key: string; version: number
  status: 'active' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  proposed_by: string | null; approved_by: string | null; rejected_by: string | null
  rejection_note: string | null; approved_at: string | null; rejected_at: string | null
  updatedAt: string
}
type ActivePrompt = { key: string; version: number; status: string; content: string; updatedAt: string }

const PREDEFINED_KEYS = [
  { value: 'elevation_system_prompt', label: 'Elevation — Prompt General' },
]

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active:         { label: 'Activo',    bg: colors.successLight, color: colors.success },
  pending_review: { label: 'Pendiente', bg: colors.warningLight, color: colors.warning },
  approved:       { label: 'Aprobado',  bg: colors.successLight, color: colors.success },
  rejected:       { label: 'Rechazado', bg: colors.dangerLight,  color: colors.danger  },
  archived:       { label: 'Archivado', bg: colors.bgMuted,      color: colors.textMuted },
}

const fmtKey = (k: string) => {
  const found = PREDEFINED_KEYS.find(p => p.value === k)
  if (found) return found.label
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function AdminPrompts() {
  const [prompts,    setPrompts]    = useState<PromptRow[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [versions,   setVersions]   = useState<Version[]>([])
  const [active,     setActive]     = useState<ActivePrompt | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [loadingV,   setLoadingV]   = useState(false)
  const [rejectId,   setRejectId]   = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)
  const [expanded,   setExpanded]   = useState(false)

  // — Estado del formulario de creación —
  const [showCreate, setShowCreate] = useState(false)
  const [newKey,     setNewKey]     = useState(PREDEFINED_KEYS[0].value)
  const [newContent, setNewContent] = useState('')
  const [creating,   setCreating]   = useState(false)

  const isSuperAdmin = role() === 'superadmin'

  const get = useCallback(async (url: string) => {
    const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token()}` } })
    return r.json()
  }, [])

  const post = useCallback(async (url: string, body?: object) => {
    const r = await fetch(`${API}${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error ?? 'Error')
    return data
  }, [])

  const loadPrompts = useCallback(async () => {
    setLoading(true)
    try { setPrompts(await get('/api/admin/prompts') ?? []) } catch { setPrompts([]) }
    setLoading(false)
  }, [get])

  const loadVersions = useCallback(async (key: string) => {
    setLoadingV(true)
    try { setVersions(await get(`/api/superadmin/prompt/${key}/versions`) ?? []) } catch { setVersions([]) }
    setLoadingV(false)
  }, [get])

  const loadActiveContent = useCallback(async (key: string) => {
    try {
      const data = await get(`/api/admin/prompt/${key}`)
      setActive(data?.content ? data : null)
    } catch {
      setActive(null)
    }
  }, [get])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const selectPrompt = (key: string) => {
    setSelected(key)
    setMsg(null)
    setRejectId(null)
    setRejectNote('')
    setShowCreate(false)
    setExpanded(false)
    setActive(null)
    loadVersions(key)
    loadActiveContent(key)
  }

  const approve = async (id: number) => {
    try {
      await post(`/api/superadmin/prompt/${id}/approve`)
      setMsg({ text: '✓ Versión aprobada y activa en producción.', ok: true })
      loadVersions(selected!); loadPrompts(); loadActiveContent(selected!)
    } catch (e: any) { setMsg({ text: e.message, ok: false }) }
  }

  const reject = async () => {
    try {
      await post(`/api/superadmin/prompt/${rejectId}/reject`, { note: rejectNote })
      setMsg({ text: '✓ Versión rechazada.', ok: true })
      setRejectId(null); setRejectNote(''); loadVersions(selected!)
    } catch (e: any) { setMsg({ text: e.message, ok: false }) }
  }

  const rollback = async (id: number) => {
    try {
      await post(`/api/superadmin/prompt/${id}/rollback`)
      setMsg({ text: '✓ Rollback exitoso.', ok: true })
      loadVersions(selected!); loadPrompts(); loadActiveContent(selected!)
    } catch (e: any) { setMsg({ text: e.message, ok: false }) }
  }

  const handleCreate = async () => {
    if (!newContent.trim()) {
      setMsg({ text: 'El contenido del prompt no puede estar vacío.', ok: false })
      return
    }
    setCreating(true)
    try {
      const endpoint = isSuperAdmin ? '/api/admin/prompt' : '/api/admin/prompt/propose'
      await post(endpoint, { key: newKey, content: newContent.trim() })
      const successText = isSuperAdmin
        ? '✓ Prompt creado y activado en producción.'
        : '✓ Propuesta enviada al superadmin para revisión.'
      setMsg({ text: successText, ok: true })
      setNewContent(''); setShowCreate(false)
      loadPrompts()
      if (selected === newKey) { loadVersions(newKey); loadActiveContent(newKey) }
      else selectPrompt(newKey)
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    }
    setCreating(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.8rem', color: colors.text, marginBottom: '0.25rem' }}>
            Prompts
          </h1>
          <p style={{ fontSize: '0.875rem', color: colors.textMuted }}>
            Revisión y aprobación de prompts terapéuticos
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setMsg(null); setSelected(null) }}
          style={{ ...btnPrimaryStyle, fontSize: 13, marginTop: 4 }}
        >
          {showCreate ? 'Cancelar' : '+ Nuevo prompt'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: '1.25rem', borderLeft: `3px solid ${colors.primary}` }}>
          <p style={{ ...labelStyle, marginBottom: spacing.md }}>
            {isSuperAdmin ? 'Crear prompt (activa directo)' : 'Proponer prompt (requiere aprobación)'}
          </p>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: spacing.xs }}>Prompt</label>
            <select
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              style={{
                width: '100%', padding: `${spacing.sm} ${spacing.md}`,
                border: `0.5px solid ${colors.borderLight}`, borderRadius: radius.sm,
                fontSize: 13, color: colors.text, background: colors.bgCard,
                fontFamily: typography.fontBody,
              }}
            >
              {PREDEFINED_KEYS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: spacing.xs }}>Contenido</label>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={6}
              placeholder="Escribí el contenido del prompt..."
              style={{
                width: '100%', padding: spacing.md,
                border: `0.5px solid ${colors.borderLight}`, borderRadius: radius.sm,
                fontSize: 13, color: colors.text, resize: 'vertical',
                fontFamily: typography.fontBody, lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
          </div>
          {msg && !selected && (
            <div style={{
              background: msg.ok ? colors.successLight : colors.dangerLight,
              color: msg.ok ? colors.success : colors.danger,
              borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`,
              fontSize: 13, marginBottom: spacing.md,
            }}>{msg.text}</div>
          )}
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button onClick={handleCreate} disabled={creating}
              style={{ ...btnPrimaryStyle, fontSize: 13, opacity: creating ? 0.7 : 1 }}>
              {creating ? 'Guardando...' : isSuperAdmin ? 'Crear y activar' : 'Enviar propuesta'}
            </button>
            <button onClick={() => { setShowCreate(false); setNewContent(''); setMsg(null) }}
              style={{ ...btnSecondaryStyle, fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* Lista */}
        <div style={{ ...cardStyle, padding: spacing.md }}>
          <p style={{ ...labelStyle, marginBottom: spacing.md }}>Prompt Vault</p>
          {loading
            ? <p style={{ fontSize: 13, color: colors.textMuted }}>Cargando...</p>
            : prompts.length === 0
              ? <p style={{ fontSize: 13, color: colors.textMuted }}>Sin prompts. Creá el primero.</p>
              : prompts.map(p => (
                <button key={p.key} onClick={() => selectPrompt(p.key)} style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: selected === p.key ? colors.primaryLight : 'transparent',
                  border: `0.5px solid ${selected === p.key ? '#A8B5A2' : 'transparent'}`,
                  borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, marginBottom: spacing.xs,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{fmtKey(p.key)}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>v{p.version} · {fmtDate(p.updatedAt)}</div>
                </button>
              ))
          }
        </div>

        {/* Detalle */}
        {!selected
          ? (
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
              <p style={{ color: colors.textMuted, fontSize: 14 }}>Seleccioná un prompt para ver su contenido</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* ── Panel de contenido activo ── */}
              <div style={{ ...cardStyle, borderLeft: `3px solid ${colors.primary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <p style={{ ...labelStyle, margin: 0 }}>Contenido activo</p>
                    {active && (
                      <span style={{
                        fontSize: 11, padding: '2px 10px', borderRadius: radius.full,
                        background: colors.successLight, color: colors.success, fontWeight: 500,
                      }}>
                        v{active.version}
                      </span>
                    )}
                  </div>
                  {active && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      style={{ ...btnSecondaryStyle, fontSize: 12, padding: '3px 12px' }}
                    >
                      {expanded ? 'Colapsar' : 'Ver completo'}
                    </button>
                  )}
                </div>

                {!active
                  ? (
                    <p style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                      No hay versión activa para este prompt.
                    </p>
                  ) : (
                    <div style={{
                      background: colors.bgMuted,
                      borderRadius: radius.sm,
                      padding: spacing.md,
                      fontSize: 13,
                      color: colors.text,
                      fontFamily: typography.fontBody,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      maxHeight: expanded ? 'none' : '5.5rem',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      {active.content}
                      {!expanded && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '2.5rem',
                          background: `linear-gradient(transparent, ${colors.bgMuted})`,
                          borderRadius: `0 0 ${radius.sm} ${radius.sm}`,
                        }} />
                      )}
                    </div>
                  )
                }
              </div>

              {/* ── Historial de versiones ── */}
              <div style={{ ...cardStyle }}>
                <h2 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.3rem', color: colors.text, marginBottom: '0.25rem' }}>
                  {fmtKey(selected)}
                </h2>
                <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg }}>Historial de versiones</p>

                {/* Alerta */}
                {msg && (
                  <div style={{
                    background: msg.ok ? colors.successLight : colors.dangerLight,
                    color: msg.ok ? colors.success : colors.danger,
                    borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`,
                    fontSize: 13, marginBottom: spacing.lg,
                  }}>{msg.text}</div>
                )}

                {/* Form rechazo */}
                {rejectId !== null && (
                  <div style={{ background: colors.dangerLight, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, marginBottom: spacing.sm }}>Motivo del rechazo (opcional)</p>
                    <textarea
                      value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}
                      placeholder="Explicá por qué se rechaza..."
                      style={{ width: '100%', fontSize: 13, padding: spacing.sm, borderRadius: radius.sm, border: `0.5px solid #FCA5A5`, resize: 'vertical', marginBottom: spacing.sm, fontFamily: typography.fontBody }}
                    />
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      <button onClick={reject} style={{ ...btnPrimaryStyle, background: colors.danger, fontSize: 12 }}>Confirmar rechazo</button>
                      <button onClick={() => { setRejectId(null); setRejectNote('') }} style={{ ...btnSecondaryStyle, fontSize: 12 }}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Versiones */}
                {loadingV
                  ? <p style={{ fontSize: 13, color: colors.textMuted }}>Cargando...</p>
                  : versions.length === 0
                    ? <p style={{ fontSize: 13, color: colors.textMuted }}>Sin versiones registradas.</p>
                    : versions.map(v => {
                      const b = BADGE[v.status] ?? BADGE.archived
                      return (
                        <div key={v.id} style={{
                          border: `0.5px solid ${colors.border}`, borderRadius: radius.md,
                          padding: `${spacing.md} ${spacing.lg}`, marginBottom: spacing.md,
                          background: v.status === 'active' ? colors.successLight : colors.bgCard,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>v{v.version}</span>
                              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: radius.full, background: b.bg, color: b.color, fontWeight: 500 }}>
                                {b.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: spacing.sm }}>
                              {v.status === 'pending_review' && (
                                <>
                                  <button onClick={() => approve(v.id)} style={{ ...btnPrimaryStyle, fontSize: 12, padding: '4px 14px' }}>Aprobar</button>
                                  <button onClick={() => { setRejectId(v.id); setMsg(null) }}
                                    style={{ ...btnSecondaryStyle, fontSize: 12, padding: '4px 14px', color: colors.danger, borderColor: '#FCA5A5' }}>
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {v.status === 'active' && versions.length > 1 && (
                                <button onClick={() => rollback(v.id)} style={{ ...btnSecondaryStyle, fontSize: 12, padding: '4px 14px' }}>Rollback</button>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: colors.textMuted, display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
                            {v.proposed_by && <span>Propuesto por <strong style={{ color: colors.text }}>{v.proposed_by}</strong></span>}
                            {v.approved_by && <span>Aprobado por <strong style={{ color: colors.text }}>{v.approved_by}</strong> · {fmtDate(v.approved_at)}</span>}
                            {v.rejected_by && <span>Rechazado por <strong style={{ color: colors.text }}>{v.rejected_by}</strong> · {fmtDate(v.rejected_at)}</span>}
                            {v.rejection_note && <span style={{ width: '100%', color: colors.danger, fontStyle: 'italic' }}>"{v.rejection_note}"</span>}
                            <span>Actualizado: {fmtDate(v.updatedAt)}</span>
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
// frontend/src/pages/admin/AdminPrompts.tsx
import { useState, useEffect, useCallback } from 'react'
import { colors, radius, cardStyle, labelStyle, btnPrimaryStyle, btnSecondaryStyle, spacing, typography } from '../../styles/tokens'

const API = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'
const token = () => localStorage.getItem('elevation_token') ?? ''

type PromptRow = { key: string; version: number; isActive: boolean; updatedBy: string; updatedAt: string }
type Version   = {
  id: number; key: string; version: number
  status: 'active' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  proposed_by: string | null; approved_by: string | null; rejected_by: string | null
  rejection_note: string | null; approved_at: string | null; rejected_at: string | null
  updatedAt: string
}

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active:         { label: 'Activo',           bg: colors.successLight, color: colors.success },
  pending_review: { label: 'Pendiente',         bg: colors.warningLight, color: colors.warning },
  approved:       { label: 'Aprobado',          bg: colors.successLight, color: colors.success },
  rejected:       { label: 'Rechazado',         bg: colors.dangerLight,  color: colors.danger  },
  archived:       { label: 'Archivado',         bg: colors.bgMuted,      color: colors.textMuted },
}

const fmtKey  = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function AdminPrompts() {
  const [prompts,    setPrompts]    = useState<PromptRow[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [versions,   setVersions]   = useState<Version[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadingV,   setLoadingV]   = useState(false)
  const [rejectId,   setRejectId]   = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)

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

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const selectPrompt = (key: string) => {
    setSelected(key); setMsg(null); setRejectId(null); setRejectNote('')
    loadVersions(key)
  }

  const approve = async (id: number) => {
    try {
      await post(`/api/superadmin/prompt/${id}/approve`)
      setMsg({ text: '✓ Versión aprobada y activa en producción.', ok: true })
      loadVersions(selected!); loadPrompts()
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
      loadVersions(selected!); loadPrompts()
    } catch (e: any) { setMsg({ text: e.message, ok: false }) }
  }

  return (
    <div>
      <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.8rem', color: colors.text, marginBottom: '0.25rem' }}>
        Prompts
      </h1>
      <p style={{ fontSize: '0.875rem', color: colors.textMuted, marginBottom: '1.5rem' }}>
        Revisión y aprobación de prompts terapéuticos
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* Lista */}
        <div style={{ ...cardStyle, padding: spacing.md }}>
          <p style={{ ...labelStyle, marginBottom: spacing.md }}>Prompt Vault</p>
          {loading
            ? <p style={{ fontSize: 13, color: colors.textMuted }}>Cargando...</p>
            : prompts.length === 0
              ? <p style={{ fontSize: 13, color: colors.textMuted }}>Sin prompts.</p>
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
              <p style={{ color: colors.textMuted, fontSize: 14 }}>Seleccioná un prompt</p>
            </div>
          ) : (
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
                  fontSize: 13, marginBottom: spacing.lg
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
                  ? <p style={{ fontSize: 13, color: colors.textMuted }}>Sin versiones.</p>
                  : versions.map(v => {
                    const b = BADGE[v.status] ?? BADGE.archived
                    return (
                      <div key={v.id} style={{
                        border: `0.5px solid ${colors.border}`, borderRadius: radius.md,
                        padding: `${spacing.md} ${spacing.lg}`, marginBottom: spacing.md,
                        background: v.status === 'active' ? colors.successLight : colors.bgCard,
                      }}>
                        {/* Cabecera */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>v{v.version}</span>
                            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: radius.full, background: b.bg, color: b.color, fontWeight: 500 }}>
                              {b.label}
                            </span>
                          </div>
                          {/* Acciones */}
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

                        {/* Meta */}
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
          )}
      </div>
    </div>
  )
}
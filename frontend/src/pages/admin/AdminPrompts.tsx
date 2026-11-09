// frontend/src/pages/admin/AdminPrompts.tsx
// ES-181 (HU-P30) — Guías de la IA: lista por guía, versiones, propuesta, aprobación y publicación.
// admin: ve las guías y sus versiones y PROPONE. superadmin: además publica, crea, aprueba, rechaza y vuelve a una versión.
// Toda validación del contenido vive en el servidor (ES-191); aquí el contador solo informa.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'

const API      = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') ?? ''
const MIN_CHARS = 50
const MAX_CHARS = 20000

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Guide {
  key: string
  activeVersion: number | null
  activeBy: string | null
  activeAt: string | null
  approvedBy: string | null
  pendingCount: number
  versionCount: number
  lastChangeAt: string | null
}

interface Reason { code: string; es?: string; en?: string }

interface GuideVersion {
  id: number
  key: string
  version: number
  status: string
  proposed_by: string | null
  approved_by: string | null
  rejected_by: string | null
  rejection_note: string | null
  approved_at: string | null
  rejected_at: string | null
  createdAt?: string
  updatedAt: string
  content: string | null
  contentError?: boolean
  reviewReasons?: Reason[]
}

type DialogKind = 'propose' | 'publish' | 'create' | 'approve' | 'reject' | 'rollback'
interface DialogState { kind: DialogKind; version?: GuideVersion; trigger: HTMLElement | null }

// ── Estilos compartidos ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff', border: '0.5px solid #E7E5E4', borderRadius: '1rem', padding: '1.25rem',
  boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
}
const btnBase: React.CSSProperties = {
  borderRadius: '0.65rem', padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', minHeight: 44,
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#5C6B4E', color: '#fff', border: 'none', fontWeight: 500 }
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'transparent', color: '#4A5A3F', border: '0.5px solid #A8B5A2' }
const btnDanger: React.CSSProperties = { ...btnBase, background: 'transparent', color: '#B91C1C', border: '0.5px solid #DC2626' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B645F', textTransform: 'uppercase', letterSpacing: '0.05em' }

// Estado en palabra (nunca solo color ni símbolo).
const STATUS_WORD: Record<string, { bg: string; color: string; label: string }> = {
  active:         { bg: '#EAF0E6', color: '#2F4A27', label: 'Activa' },
  approved:       { bg: '#F5F3EF', color: '#57514C', label: 'Archivada' },
  archived:       { bg: '#F5F3EF', color: '#57514C', label: 'Archivada' },
  pending_review: { bg: '#FEF3C7', color: '#78350F', label: 'En revisión' },
  rejected:       { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
}

const formatDate = (iso: string | null | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// Los mensajes del servidor llegan como «Español. / English.»: se muestra el del idioma activo.
const localized = (text: string | undefined, lang: string) => {
  if (!text) return ''
  const parts = text.split(' / ')
  return parts.length === 2 ? (lang === 'en' ? parts[1] : parts[0]) : text
}

const authFetch = (path: string, init: RequestInit = {}) => fetch(`${API}${path}`, {
  ...init,
  headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
})

function useNarrow() {
  const query = '(max-width: 760px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches)
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia(query)
    const onChange = () => setNarrow(media.matches)
    onChange(); media.addEventListener('change', onChange); window.addEventListener('resize', onChange)
    return () => { media.removeEventListener('change', onChange); window.removeEventListener('resize', onChange) }
  }, [])
  return narrow
}

// ── Diálogo accesible compartido ──────────────────────────────────────────────
function GuideDialog({ title, onClose, busy, children, trigger }: {
  title: string; onClose: () => void; busy: boolean; children: React.ReactNode; trigger: HTMLElement | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy })
  useEffect(() => {
    const root = ref.current
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? []).filter(el => !(el as HTMLButtonElement).disabled)
    ;(focusables()[0] ?? root)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab') return
      const items = focusables(); if (items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); trigger?.focus?.() }
  }, [trigger])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: '0 0 1rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function AdminPrompts() {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const dateLocale = tr('es-CO')
  const esSuperAdmin = (localStorage.getItem('elevation_role') ?? 'admin') === 'superadmin'
  const narrow = useNarrow()

  const [guides, setGuides] = useState<Guide[]>([])
  const [listState, setListState] = useState<'loading' | 'error' | 'ok'>('loading')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [versions, setVersions] = useState<GuideVersion[]>([])
  const [versionsState, setVersionsState] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle')
  const [openText, setOpenText] = useState<Set<number>>(new Set())

  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [draft, setDraft] = useState('')
  const [newKey, setNewKey] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [dialogReasons, setDialogReasons] = useState<Reason[]>([])
  const [success, setSuccess] = useState('')
  const successRef = useRef<HTMLDivElement>(null)

  const selected = guides.find(g => g.key === selectedKey) ?? null
  const activeVersion = versions.find(v => v.status === 'active') ?? null

  const loadGuides = useCallback(async () => {
    setListState('loading')
    try {
      const res = await authFetch('/api/admin/prompts')
      if (!res.ok) throw new Error()
      setGuides(await res.json()); setListState('ok')
    } catch { setListState('error') }
  }, [])

  const loadVersions = useCallback(async (key: string) => {
    setVersionsState('loading')
    try {
      const res = await authFetch(`/api/admin/prompt/${encodeURIComponent(key)}/versions`)
      if (!res.ok) throw new Error()
      setVersions(await res.json()); setVersionsState('ok')
    } catch { setVersionsState('error') }
  }, [])

  useEffect(() => { loadGuides() }, [loadGuides])
  useEffect(() => { if (selectedKey) { setOpenText(new Set()); loadVersions(selectedKey) } else { setVersions([]); setVersionsState('idle') } }, [selectedKey, loadVersions])
  useEffect(() => { if (success) successRef.current?.focus() }, [success])

  const toggleText = (id: number) => setOpenText(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const openDialog = (kind: DialogKind, trigger: HTMLElement | null, version?: GuideVersion) => {
    setDialogError(''); setDialogReasons([]); setNote(''); setNewKey(''); setSuccess('')
    // El texto parte de la versión activa (propuesta y publicación); crear parte vacío.
    setDraft(kind === 'propose' || kind === 'publish' ? (activeVersion?.content ?? '') : '')
    setDialog({ kind, version, trigger })
  }
  const closeDialog = () => { if (!busy) setDialog(null) }

  const refreshAfter = async (key: string, message: string) => {
    setDialog(null); setSuccess(message)
    await loadGuides()
    setSelectedKey(key)
    await loadVersions(key)
  }

  const submit = async () => {
    if (!dialog) return
    setDialogError(''); setDialogReasons([])
    const { kind, version } = dialog
    const key = kind === 'create' ? newKey.trim() : (selectedKey ?? '')
    let path = ''; let body: Record<string, string> | undefined
    if (kind === 'propose') { path = '/api/admin/prompt/propose'; body = { key, content: draft } }
    else if (kind === 'publish') { path = '/api/superadmin/prompt/publish'; body = { key, content: draft } }
    else if (kind === 'create') { path = '/api/superadmin/prompt/create'; body = { key, content: draft } }
    else if (kind === 'approve' && version) path = `/api/superadmin/prompt/${version.id}/approve`
    else if (kind === 'rollback' && version) path = `/api/superadmin/prompt/${version.id}/rollback`
    else if (kind === 'reject' && version) { path = `/api/superadmin/prompt/${version.id}/reject`; body = { note: note.trim() } }
    else return
    setBusy(true)
    try {
      const res = await authFetch(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDialogError(localized(data.error, lang) || tr('No se pudo completar la acción. Tu texto sigue aquí.'))
        setDialogReasons(Array.isArray(data.reasons) ? data.reasons : [])
        if (res.status === 409 && selectedKey && kind !== 'create') loadVersions(selectedKey) // otra persona ya resolvió esta versión
        return
      }
      const done: Record<DialogKind, string> = {
        propose: 'Propuesta enviada. Queda en revisión; la guía activa no cambia hasta que se apruebe.',
        publish: 'Versión publicada. Ya es la guía activa.',
        create: 'Guía creada y activa.',
        approve: 'Versión aprobada. Ya es la guía activa.',
        reject: 'Versión rechazada. Quien la propuso verá el motivo.',
        rollback: 'Se volvió a esa versión. Ya es la guía activa.',
      }
      await refreshAfter(key || version?.key || '', tr(done[kind]))
    } catch { setDialogError(tr('Error de conexión. Tu texto sigue aquí.')) }
    finally { setBusy(false) }
  }

  const needsText = dialog && (dialog.kind === 'propose' || dialog.kind === 'publish' || dialog.kind === 'create')
  const tooShort = draft.trim().length < MIN_CHARS
  const keyOk = dialog?.kind !== 'create' || /^[a-z][a-z0-9_]{0,99}$/.test(newKey.trim())
  const noteOk = dialog?.kind !== 'reject' || note.trim().length >= 3
  const canSubmit = !busy && (!needsText || !tooShort) && keyOk && noteOk

  const dialogTitle = (kind: DialogKind) => ({
    propose: tr('Proponer nueva versión'), publish: tr('Publicar versión'), create: tr('Nueva guía'),
    approve: tr('Aprobar versión'), reject: tr('Rechazar versión'), rollback: tr('Volver a esta versión'),
  }[kind])

  const consequence = (kind: DialogKind, version?: GuideVersion) => ({
    propose: tr('Tu propuesta queda en revisión. La guía activa no cambia hasta que la apruebe una persona con permiso.'),
    publish: tr('Se activa de inmediato para todas las personas. La versión anterior queda archivada.'),
    create: tr('La guía se crea y se activa de inmediato si supera la revisión automática.'),
    approve: version ? `${tr('Esta versión pasará a ser la activa; la anterior queda archivada.')} (v${version.version})` : '',
    reject: tr('Indica el motivo. Quien propuso la versión lo verá.'),
    rollback: version ? `${tr('Esta versión volverá a ser la activa; la actual queda archivada.')} (v${version.version})` : '',
  }[kind])

  const submitLabel = (kind: DialogKind) => ({
    propose: tr('Enviar propuesta'), publish: tr('Publicar ahora'), create: tr('Crear guía'),
    approve: tr('Aprobar y activar'), reject: tr('Rechazar'), rollback: tr('Volver a esta versión'),
  }[kind])

  // ── Piezas de la pantalla ───────────────────────────────────────────────────
  const StatusWord = ({ status }: { status: string }) => {
    const s = STATUS_WORD[status] ?? STATUS_WORD.archived
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{tr(s.label)}</span>
  }

  const list = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }} aria-busy={listState === 'loading'}>
      {listState === 'loading' && <p style={{ color: '#57514C', fontSize: 13 }} role="status">{tr('Cargando guías...')}</p>}
      {listState === 'error' && (
        <div style={cardStyle} role="alert">
          <p style={{ margin: '0 0 0.75rem', fontSize: 13, color: '#991B1B' }}>{tr('No pudimos cargar las guías.')}</p>
          <button type="button" style={btnSecondary} onClick={loadGuides}>{tr('Reintentar')}</button>
        </div>
      )}
      {listState === 'ok' && guides.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem', color: '#57514C', fontSize: 13 }}>
          {esSuperAdmin ? tr('Aún no hay guías. Crea la primera.') : tr('Aún no hay guías.')}
        </div>
      )}
      {listState === 'ok' && guides.map(g => {
        const isSelected = selectedKey === g.key
        return (
          <button type="button" key={g.key} onClick={() => setSelectedKey(g.key)} aria-current={isSelected ? 'true' : undefined}
            style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', width: '100%', minHeight: 44, font: 'inherit',
              border: isSelected ? '1px solid #5C6B4E' : '0.5px solid #E7E5E4', background: isSelected ? '#EAF0E6' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 500, fontSize: 14, color: '#1C1917', overflowWrap: 'anywhere' }}>{g.key}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#57514C', marginTop: 2 }}>
                {g.activeVersion !== null ? `${tr('Versión activa')} v${g.activeVersion}` : tr('Sin versión activa')}
                {g.activeBy ? ` · ${tr('Actualizó')} ${g.activeBy}` : ''}{g.activeAt ? ` · ${formatDate(g.activeAt, dateLocale)}` : ''}
              </span>
            </span>
            {g.pendingCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#FEF3C7', color: '#78350F', whiteSpace: 'nowrap' }}>
                {g.pendingCount} {tr('en revisión')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  const detail = selected && (
    <div style={{ width: narrow ? '100%' : 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
      {narrow && <button type="button" style={btnSecondary} onClick={() => setSelectedKey(null)}>{tr('← Volver a la lista')}</button>}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: '0.5rem', overflowWrap: 'anywhere' }}>{selected.key}</div>
        <div style={{ fontSize: 13, color: '#57514C', marginBottom: '1rem', lineHeight: 1.6 }}>
          {selected.activeVersion !== null ? (
            <>
              {tr('Versión activa')} <strong style={{ color: '#1C1917' }}>v{selected.activeVersion}</strong>
              {selected.approvedBy ? <> · {tr('Aprobó')} <strong style={{ color: '#1C1917' }}>{selected.approvedBy}</strong></> : null}
              {selected.activeAt ? <> · {formatDate(selected.activeAt, dateLocale)}</> : null}
            </>
          ) : tr('Sin versión activa')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeVersion && (
            <button type="button" style={btnSecondary} aria-expanded={openText.has(activeVersion.id)} onClick={() => toggleText(activeVersion.id)}>
              {openText.has(activeVersion.id) ? tr('Ocultar texto activo') : tr('Ver texto activo')}
            </button>
          )}
          {activeVersion && openText.has(activeVersion.id) && (
            <div style={{ background: '#F5F3EF', borderRadius: '0.65rem', padding: '0.75rem', fontSize: 12, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', overflowWrap: 'anywhere' }}>
              {activeVersion.contentError ? tr('No se pudo leer el texto de esta versión.') : activeVersion.content}
            </div>
          )}
          <button type="button" style={esSuperAdmin ? btnSecondary : btnPrimary} onClick={e => openDialog('propose', e.currentTarget)} disabled={versionsState !== 'ok'}>
            {tr('Proponer versión')}
          </button>
          {esSuperAdmin && (
            <button type="button" style={btnPrimary} onClick={e => openDialog('publish', e.currentTarget)} disabled={versionsState !== 'ok'}>
              {tr('Publicar versión')}
            </button>
          )}
        </div>
      </div>

      <div style={cardStyle} aria-busy={versionsState === 'loading'}>
        <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>{tr('Historial de versiones')}</div>
        {versionsState === 'loading' && <p style={{ fontSize: 12, color: '#57514C', margin: 0 }} role="status">{tr('Cargando...')}</p>}
        {versionsState === 'error' && (
          <div role="alert">
            <p style={{ fontSize: 13, color: '#991B1B', margin: '0 0 0.75rem' }}>{tr('No pudimos cargar el historial.')}</p>
            <button type="button" style={btnSecondary} onClick={() => selectedKey && loadVersions(selectedKey)}>{tr('Reintentar')}</button>
          </div>
        )}
        {versionsState === 'ok' && versions.length === 0 && <p style={{ fontSize: 12, color: '#57514C', margin: 0 }}>{tr('Sin versiones anteriores.')}</p>}
        {versionsState === 'ok' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {versions.map(v => {
              const isPending = v.status === 'pending_review'
              const canRollback = esSuperAdmin && (v.status === 'approved' || v.status === 'archived')
              return (
                <div key={v.id} style={{ padding: '0.65rem 0.75rem', borderRadius: '0.65rem', background: isPending ? '#FFFBEB' : '#F5F3EF', border: isPending ? '0.5px solid #FCD34D' : '0.5px solid #E7E5E4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917' }}>v{v.version}</span>
                    <StatusWord status={v.status} />
                  </div>
                  <div style={{ fontSize: 12, color: '#57514C' }}>
                    {v.proposed_by && <div>{tr('Propuso')} {v.proposed_by}</div>}
                    {v.approved_by && <div>{tr('Aprobó')} {v.approved_by}</div>}
                    {v.rejected_by && <div>{tr('Rechazó')} {v.rejected_by}</div>}
                    {v.rejection_note && <div style={{ fontStyle: 'italic', marginTop: 2, overflowWrap: 'anywhere' }}>{tr('Motivo:')} {v.rejection_note}</div>}
                    {(v.reviewReasons ?? []).length > 0 && (
                      <ul style={{ margin: '4px 0 0', paddingLeft: '1.1rem' }}>
                        {(v.reviewReasons ?? []).map((r, i) => <li key={i}>{(lang === 'en' ? r.en : r.es) ?? r.code}</li>)}
                      </ul>
                    )}
                    <div style={{ marginTop: 2 }}>{formatDate(v.createdAt ?? v.updatedAt, dateLocale)}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button type="button" style={{ ...btnSecondary, fontSize: 12, padding: '0.3rem 0.65rem' }} aria-expanded={openText.has(v.id)} onClick={() => toggleText(v.id)}>
                      {openText.has(v.id) ? tr('Ocultar texto') : tr('Ver texto')}
                    </button>
                    {esSuperAdmin && isPending && (
                      <>
                        <button type="button" style={{ ...btnPrimary, fontSize: 12, padding: '0.3rem 0.65rem' }} onClick={e => openDialog('approve', e.currentTarget, v)}>{tr('Aprobar')}</button>
                        <button type="button" style={{ ...btnDanger, fontSize: 12, padding: '0.3rem 0.65rem' }} onClick={e => openDialog('reject', e.currentTarget, v)}>{tr('Rechazar')}</button>
                      </>
                    )}
                    {canRollback && (
                      <button type="button" style={{ ...btnSecondary, fontSize: 12, padding: '0.3rem 0.65rem' }} onClick={e => openDialog('rollback', e.currentTarget, v)}>{tr('Volver a esta versión')}</button>
                    )}
                  </div>
                  {openText.has(v.id) && (
                    <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '0.6rem', marginTop: '0.5rem', fontSize: 12, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', overflowWrap: 'anywhere' }}>
                      {v.contentError ? tr('No se pudo leer el texto de esta versión.') : v.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>{tr('Guías de la IA')}</h1>
          <p style={{ fontSize: '0.875rem', color: '#57514C', margin: '0.25rem 0 0' }}>
            {tr('Define cómo conversa la IA. Nada llega a las personas sin aprobación humana.')}
          </p>
        </div>
        {esSuperAdmin && <button type="button" style={btnPrimary} onClick={e => openDialog('create', e.currentTarget)}>{tr('+ Nueva guía')}</button>}
      </div>

      <div ref={successRef} tabIndex={-1} aria-live="polite" role="status" style={{ outline: 'none' }}>
        {success && <div style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem', marginBottom: '1rem', fontSize: 13, background: '#EAF0E6', color: '#2F4A27' }}>{success}</div>}
      </div>

      {listState === 'ok' && !esSuperAdmin && guides.length > 0 && (
        <p style={{ fontSize: 12, color: '#57514C', margin: '0 0 1rem' }}>
          {tr('Al proponer una versión, queda en revisión. La versión actual sigue activa hasta que otra persona con permiso la apruebe.')}
        </p>
      )}

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexDirection: narrow ? 'column' : 'row' }}>
        {(!narrow || !selected) && list}
        {selected && detail}
      </div>

      {dialog && (
        <GuideDialog title={dialogTitle(dialog.kind)} onClose={closeDialog} busy={busy} trigger={dialog.trigger}>
          <p style={{ fontSize: 13, color: '#1C1917', margin: '0 0 1rem', lineHeight: 1.6 }}>{consequence(dialog.kind, dialog.version)}</p>

          {dialog.kind === 'create' && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="guide-key" style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>{tr('Identificador de la guía')}</label>
              <input id="guide-key" value={newKey} onChange={e => setNewKey(e.target.value)} autoComplete="off" spellCheck={false}
                aria-describedby="guide-key-help" aria-invalid={newKey !== '' && !keyOk}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', border: '0.5px solid #A8B5A2', borderRadius: '0.5rem', fontSize: 14, minHeight: 44 }} />
              <div id="guide-key-help" style={{ fontSize: 12, color: '#57514C', marginTop: 4 }}>{tr('Minúsculas, números y guion bajo; empieza por una letra. Ejemplo: guia_acompanamiento')}</div>
            </div>
          )}

          {needsText && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ background: '#FFFBEB', border: '0.5px solid #FCD34D', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: 12, color: '#78350F', marginBottom: '0.75rem' }}>
                {tr('Sin diagnóstico, sin tratamiento y sin promesas de empleo.')}
              </div>
              <label htmlFor="guide-text" style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>{tr('Texto de la guía')}</label>
              <textarea id="guide-text" value={draft} onChange={e => setDraft(e.target.value)} rows={10} maxLength={MAX_CHARS} aria-describedby="guide-count"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', border: '0.5px solid #A8B5A2', borderRadius: '0.5rem', fontSize: 13, lineHeight: 1.5, fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
              <div id="guide-count" style={{ fontSize: 12, color: tooShort ? '#78350F' : '#57514C', marginTop: 4 }}>
                {draft.trim().length.toLocaleString(dateLocale)} / {MIN_CHARS} {tr('mínimo')} · {tr('máx.')} {MAX_CHARS.toLocaleString(dateLocale)}
              </div>
            </div>
          )}

          {dialog.kind === 'reject' && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="guide-note" style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>{tr('Motivo del rechazo')}</label>
              <textarea id="guide-note" value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem', border: '0.5px solid #A8B5A2', borderRadius: '0.5rem', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
            </div>
          )}

          {dialogError && (
            <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: 13, marginBottom: '1rem' }}>
              {dialogError}
              {dialogReasons.length > 0 && (
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                  {dialogReasons.map((r, i) => <li key={i}>{(lang === 'en' ? r.en : r.es) ?? r.code}</li>)}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={btnSecondary} onClick={closeDialog} disabled={busy}>{tr('Cancelar')}</button>
            <button type="button" style={{ ...(dialog.kind === 'reject' ? btnDanger : btnPrimary), opacity: canSubmit ? 1 : 0.6 }} onClick={submit} disabled={!canSubmit}>
              {busy ? tr('Enviando…') : submitLabel(dialog.kind)}
            </button>
          </div>
        </GuideDialog>
      )}
    </div>
  )
}

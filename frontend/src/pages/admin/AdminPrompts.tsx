// frontend/src/pages/admin/AdminPrompts.tsx
// ES-181 (HU-P30) + ES-310 — Guías de la IA: lista por guía, versiones, propuesta, aprobación y publicación. Cartografía (tokens --cg-*), sin estilos en línea.
// admin: ve las guías y sus versiones y PROPONE. superadmin: además publica, crea, aprueba, rechaza y vuelve a una versión.
// Toda validación del contenido vive en el servidor (ES-191); aquí el contador solo informa.

import { useCallback, useEffect, useRef, useState } from 'react'
import '../../cartografia/pages.css'
import { Banner, Button, Card, Chip, Dialog, LinkButton, TextAreaField, TextField } from '../../cartografia'
import type { ChipTone } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import './adminPrompts.css'

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
interface DialogState { kind: DialogKind; version?: GuideVersion }

// Estado en palabra y símbolo (nunca solo color).
const STATUS_WORD: Record<string, { tone: ChipTone; symbol?: string; label: string }> = {
  active:         { tone: 'ok', symbol: '✓', label: 'Activa' },
  approved:       { tone: 'neutral', label: 'Archivada' },
  archived:       { tone: 'neutral', label: 'Archivada' },
  pending_review: { tone: 'wait', label: 'En revisión' },
  rejected:       { tone: 'bad', label: 'Rechazada' },
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
  const query = '(max-width: 900px)' // el mismo corte que `.ap-work` (adminPrompts.css)
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

  // El foco vuelve al botón que abrió el diálogo (lo hace el Dialog de Cartografía al cerrar).
  const openDialog = (kind: DialogKind, version?: GuideVersion) => {
    setDialogError(''); setDialogReasons([]); setNote(''); setNewKey(''); setSuccess('')
    // El texto parte de la versión activa (propuesta y publicación); crear parte vacío.
    setDraft(kind === 'propose' || kind === 'publish' ? (activeVersion?.content ?? '') : '')
    setDialog({ kind, version })
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
    return <Chip tone={s.tone} symbol={s.symbol}>{tr(s.label)}</Chip>
  }

  const list = (
    <Card as="section" className="pg-card ap-list">
      <h2 id="ap-list-title">{tr('Guías de la IA')}</h2>
      <div aria-busy={listState === 'loading'}>
        {listState === 'loading' && <p className="ap-status" role="status">{tr('Cargando guías...')}</p>}
        {listState === 'error' && (
          <Banner kind="error" title={tr('No pudimos cargar las guías.')}>
            <div className="pg-actions"><Button variant="ghost" onClick={loadGuides}>{tr('Reintentar')}</Button></div>
          </Banner>
        )}
        {listState === 'ok' && guides.length === 0 && (
          <p className="ap-status">{esSuperAdmin ? tr('Aún no hay guías. Crea la primera.') : tr('Aún no hay guías.')}</p>
        )}
        {listState === 'ok' && guides.length > 0 && (
          <ul className="cg-items" aria-labelledby="ap-list-title">
            {guides.map(g => {
              const isSelected = selectedKey === g.key
              return (
                <li key={g.key} className="cg-item">
                  <button type="button" className={`ap-pick${isSelected ? ' ap-pick--on' : ''}`} onClick={() => setSelectedKey(g.key)} aria-current={isSelected ? 'true' : undefined}>
                    <span className="ap-pick__info">
                      <strong>{g.key}</strong>
                      <span className="cg-hint">
                        {g.activeVersion !== null ? `${tr('Versión activa')} v${g.activeVersion}` : tr('Sin versión activa')}
                        {g.activeBy ? ` · ${tr('Actualizó')} ${g.activeBy}` : ''}{g.activeAt ? ` · ${formatDate(g.activeAt, dateLocale)}` : ''}
                      </span>
                    </span>
                    {g.pendingCount > 0 && <Chip tone="wait">{g.pendingCount} {tr('en revisión')}</Chip>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )

  const detail = selected && (
    <div className="ap-detail">
      {narrow && <div className="pg-actions"><Button variant="ghost" onClick={() => setSelectedKey(null)}>{tr('← Volver a la lista')}</Button></div>}
      <Card as="section" className="pg-card" >
        <h2>{selected.key}</h2>
        <p>
          {selected.activeVersion !== null ? (
            <>
              {tr('Versión activa')} <strong>v{selected.activeVersion}</strong>
              {selected.approvedBy ? <> · {tr('Aprobó')} <strong>{selected.approvedBy}</strong></> : null}
              {selected.activeAt ? <> · {formatDate(selected.activeAt, dateLocale)}</> : null}
            </>
          ) : tr('Sin versión activa')}
        </p>
        <div className="pg-actions">
          {activeVersion && (
            <LinkButton aria-expanded={openText.has(activeVersion.id)} onClick={() => toggleText(activeVersion.id)}>
              {openText.has(activeVersion.id) ? tr('Ocultar texto activo') : tr('Ver texto activo')}
            </LinkButton>
          )}
          <Button variant={esSuperAdmin ? 'ghost' : 'primary'} onClick={() => openDialog('propose')} disabled={versionsState !== 'ok'}>
            {tr('Proponer versión')}
          </Button>
          {esSuperAdmin && (
            <Button onClick={() => openDialog('publish')} disabled={versionsState !== 'ok'}>
              {tr('Publicar versión')}
            </Button>
          )}
        </div>
        {activeVersion && openText.has(activeVersion.id) && (
          <div className="ap-text">{activeVersion.contentError ? tr('No se pudo leer el texto de esta versión.') : activeVersion.content}</div>
        )}
      </Card>

      <Card as="section" className="pg-card">
        <div aria-busy={versionsState === 'loading'}>
          <h2>{tr('Historial de versiones')}</h2>
          {versionsState === 'loading' && <p className="ap-status" role="status">{tr('Cargando...')}</p>}
          {versionsState === 'error' && (
            <Banner kind="error" title={tr('No pudimos cargar el historial.')}>
              <div className="pg-actions"><Button variant="ghost" onClick={() => selectedKey && loadVersions(selectedKey)}>{tr('Reintentar')}</Button></div>
            </Banner>
          )}
          {versionsState === 'ok' && versions.length === 0 && <p className="ap-status">{tr('Sin versiones anteriores.')}</p>}
          {versionsState === 'ok' && versions.length > 0 && (
            <ul className="cg-items">
              {versions.map(v => {
                const isPending = v.status === 'pending_review'
                const canRollback = esSuperAdmin && (v.status === 'approved' || v.status === 'archived')
                return (
                  <li key={v.id} className="cg-item">
                    <div className="cg-item__top">
                      <strong>v{v.version}</strong>
                      <StatusWord status={v.status} />
                    </div>
                    <div className="ap-meta">
                      {v.proposed_by && <p>{tr('Propuso')} {v.proposed_by}</p>}
                      {v.approved_by && <p>{tr('Aprobó')} {v.approved_by}</p>}
                      {v.rejected_by && <p>{tr('Rechazó')} {v.rejected_by}</p>}
                      {v.rejection_note && <p>{tr('Motivo:')} {v.rejection_note}</p>}
                      {(v.reviewReasons ?? []).length > 0 && (
                        <ul>
                          {(v.reviewReasons ?? []).map((r, i) => <li key={i}>{(lang === 'en' ? r.en : r.es) ?? r.code}</li>)}
                        </ul>
                      )}
                      <p className="cg-hint">{formatDate(v.createdAt ?? v.updatedAt, dateLocale)}</p>
                    </div>
                    <div className="pg-actions">
                      <LinkButton aria-expanded={openText.has(v.id)} onClick={() => toggleText(v.id)}>
                        {openText.has(v.id) ? tr('Ocultar texto') : tr('Ver texto')}
                      </LinkButton>
                      {esSuperAdmin && isPending && (
                        <>
                          <Button variant="ghost" onClick={() => openDialog('approve', v)}>{tr('Aprobar')}</Button>
                          <Button variant="danger" onClick={() => openDialog('reject', v)}>{tr('Rechazar')}</Button>
                        </>
                      )}
                      {canRollback && (
                        <Button variant="ghost" onClick={() => openDialog('rollback', v)}>{tr('Volver a esta versión')}</Button>
                      )}
                    </div>
                    {openText.has(v.id) && (
                      <div className="ap-text">{v.contentError ? tr('No se pudo leer el texto de esta versión.') : v.content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )

  return (
    <div className="pg pg-wide ap">
      <header className="pg-head">
        <h1 className="pg-title">{tr('Guías de la IA')}</h1>
        <p className="pg-lead">{tr('Define cómo conversa la IA. Nada llega a las personas sin aprobación humana.')}</p>
        {esSuperAdmin && <div className="pg-actions"><Button onClick={() => openDialog('create')}>{tr('+ Nueva guía')}</Button></div>}
      </header>

      <div ref={successRef} tabIndex={-1} aria-live="polite" role="status" className="pg-live pg-focus">
        {success && <Banner title={success} />}
      </div>

      {listState === 'ok' && !esSuperAdmin && guides.length > 0 && (
        <p className="cg-hint">{tr('Al proponer una versión, queda en revisión. La versión actual sigue activa hasta que otra persona con permiso la apruebe.')}</p>
      )}

      <div className="ap-work">
        {(!narrow || !selected) && list}
        {selected && detail}
      </div>

      <Dialog
        open={dialog !== null}
        onClose={closeDialog}
        title={dialog ? dialogTitle(dialog.kind) : ''}
        actions={dialog && (
          <>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>{tr('Cancelar')}</Button>
            <Button variant={dialog.kind === 'reject' ? 'danger' : 'primary'} onClick={submit} disabled={!canSubmit}>
              {busy ? tr('Enviando…') : submitLabel(dialog.kind)}
            </Button>
          </>
        )}
      >
        {dialog && (
          <div className="ap-dialog">
            <p>{consequence(dialog.kind, dialog.version)}</p>

            {dialog.kind === 'create' && (
              <TextField id="guide-key" label={tr('Identificador de la guía')} hint={tr('Minúsculas, números y guion bajo; empieza por una letra. Ejemplo: guia_acompanamiento')}
                value={newKey} onChange={e => setNewKey(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={newKey !== '' && !keyOk} />
            )}

            {needsText && (
              <>
                <Banner title={tr('Sin diagnóstico, sin tratamiento y sin promesas de empleo.')} />
                <TextAreaField id="guide-text" label={tr('Texto de la guía')} value={draft} onChange={e => setDraft(e.target.value)} rows={10} maxLength={MAX_CHARS}
                  hint={`${draft.trim().length.toLocaleString(dateLocale)} / ${MIN_CHARS} ${tr('mínimo')} · ${tr('máx.')} ${MAX_CHARS.toLocaleString(dateLocale)}`} />
              </>
            )}

            {dialog.kind === 'reject' && (
              <TextAreaField id="guide-note" label={tr('Motivo del rechazo')} value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} />
            )}

            {dialogError && (
              <Banner kind="error" title={dialogError}>
                {dialogReasons.length > 0 && (
                  <ul>
                    {dialogReasons.map((r, i) => <li key={i}>{(lang === 'en' ? r.en : r.es) ?? r.code}</li>)}
                  </ul>
                )}
              </Banner>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}

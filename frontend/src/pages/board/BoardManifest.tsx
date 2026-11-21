// frontend/src/pages/board/BoardManifest.tsx
// ES-182 / ES-207 — Manifiesto ético en Administración. ES-310 (ES-349): Cartografía dentro del marco de Administración; «Reactivar» pide confirmación con el Dialog compartido.
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { Button, Card, Chip, Dialog, TextAreaField, TextField } from '../../cartografia'
import '../../cartografia/pages.css'
import './boardManifest.css'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

interface ManifestVersion {
  id: number
  version: string
  isActive: boolean
  note: string | null
  content: string
  contentEn?: string | null
  createdAt: string
  uploader: { id: number; name: string; email: string }
}

export function BoardManifest() {
  const { t, lang } = useLanguage()

  const [versions, setVersions]     = useState<ManifestVersion[]>([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  const [newContent, setNewContent] = useState('')
  const [newNote, setNewNote]       = useState('')
  const [newContentEn, setNewContentEn] = useState('')
  const [fieldErrorEn, setFieldErrorEn] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [confirming, setConfirming] = useState<ManifestVersion | null>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  const token = localStorage.getItem('elevation_token')
  // ES-182 (decisión 12079): administración y superadmin LEEN el historial; publicar y reactivar es solo de superadmin. El servidor es la autoridad (403): aquí solo se dejan de pintar los controles.
  const canPublish = (localStorage.getItem('elevation_role') ?? '') === 'superadmin'

  const [initialLoadError] = useState(() => t('board_error_load'))

  const fetchVersions = useCallback(async (loadError: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/board/manifest`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error('load')
      setVersions(data)
      return true
    } catch {
      setError(loadError) // ES-349 seguimiento (E365-2): mensaje propio, nunca el texto crudo del servidor ni «Failed to fetch»
      return false
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void fetchVersions(initialLoadError) }, [fetchVersions, initialLoadError])
  // Tras publicar o reactivar, el foco pasa al aviso de resultado (el botón que abrió el diálogo desaparece al recargar la lista).
  useEffect(() => { if (success) statusRef.current?.focus() }, [success])

  const handleSubmit = async () => {
    if (newContent.trim().length < 50) {
      setFieldError(t('board_error_min'))
      document.getElementById('bm-content')?.focus()
      return
    }
    // E45-1: la versión en inglés es opcional, pero si viene debe tener el mismo mínimo (el servidor también lo exige: 400 invalid_input)
    if (newContentEn.trim() && newContentEn.trim().length < 50) {
      setFieldErrorEn(t('board_error_min'))
      document.getElementById('bm-content-en')?.focus()
      return
    }
    setSubmitting(true)
    setError(null)
    setFieldError(null)
    setFieldErrorEn(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/api/board/manifest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent.trim(), note: newNote.trim() || undefined, contentEn: newContentEn.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error('upload')
      setSuccess(`${t('board_success_upload')} ${data.version}`)
      setNewContent('')
      setNewNote('')
      setNewContentEn('')
      setShowForm(false)
      await fetchVersions(t('board_error_load'))
    } catch {
      setError(t('board_error_upload'))
    } finally {
      setSubmitting(false)
    }
  }

  // Lectura simple del historial (sin tocar el estado de carga ni los avisos); null si falla.
  const readVersions = async (): Promise<ManifestVersion[] | null> => {
    try {
      const res = await fetch(`${API}/api/board/manifest`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      return res.ok && Array.isArray(data) ? data : null
    } catch { return null }
  }

  const handleActivate = async (id: number, version: string) => {
    setConfirming(null)
    setActivating(id)
    setError(null)
    setSuccess(null)
    let res: Response | null = null
    try {
      res = await fetch(`${API}/api/board/manifest/${id}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      res = null // sin respuesta: el servidor pudo haber aplicado el cambio
    }
    try {
      if (res === null) {
        // E365-1: no se afirma nada sin confirmarlo; se vuelve a leer y se compara con el servidor.
        const fresh = await readVersions()
        if (fresh?.some(v => v.id === id && v.isActive)) { setVersions(fresh); setSuccess(`${t('board_success_activate')} ${version}`) }
        else { if (fresh) setVersions(fresh); setError(t('board_error_unconfirmed')) }
      } else if (!res.ok) {
        setError(t('board_error_activate')) // E365-2: sin texto técnico del servidor
      } else {
        setSuccess(`${t('board_success_activate')} ${version}`)
        await fetchVersions(t('board_error_load'))
      }
    } finally {
      setActivating(null)
    }
  }

  const active = versions.find(v => v.isActive)

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="pg bm">
      <header className="pg-head">
        <h1 className="pg-title">{t('board_manifest_title')}</h1>
        <p className="pg-lead">{t('board_manifest_subtitle')}</p>
      </header>

      {error && (
        <div className="cg-banner cg-banner--error" role="alert"><span className="cg-banner__title">{error}</span></div>
      )}
      <div ref={statusRef} tabIndex={-1} role="status" className={success ? 'cg-banner bm-ok' : undefined}>
        {success && <span className="cg-banner__title">{success}</span>}
      </div>

      {/* E409-1: la altura de «Versión vigente» se reserva mientras carga y, si no hay vigente (vacío, error o solo versiones inactivas), la ocupa un bloque con la misma altura mínima: el historial y los botones no saltan en ningún desenlace. */}
      {!active && (loading ? <div className="bm-skel" aria-hidden="true" /> : (
        <Card as="section" className="pg-card bm-active bm-active--none">
          <h2 className="bm-h2">{t('board_active_version')}</h2>
          <p className="cg-hint">—</p>
        </Card>
      ))}
      {active && (
        <Card as="section" className="pg-card bm-active">
          <h2 className="bm-h2">{t('board_active_version')} — {active.version}</h2>
          <p className="bm-row">
            <Chip tone="ok" symbol="●">{t('board_active_badge')}</Chip>{active.contentEn && <Chip symbol="EN">{t('board_has_en')}</Chip>}
            <span className="cg-hint">{fmtDate(active.createdAt)} · {active.uploader?.name}</span>
          </p>
          {active.note && <p className="cg-hint bm-note">{active.note}</p>}
          <div className="bm-body" tabIndex={0} role="region" aria-label={`${t('board_active_version')} ${active.version}`}>{active.content}</div>
        </Card>
      )}

      <div className="pg-actions bm-bar">
        {canPublish && <Button variant="ghost" aria-expanded={showForm} aria-controls="bm-form" onClick={() => setShowForm(f => !f)}>
          {showForm ? t('board_cancel') : t('board_new_version')}
        </Button>}
        {/* ES-207 — enlace a la página pública */}
        <Link to="/manifiesto" className="bm-public">{t('manifest_view_public')}</Link>
      </div>

      {canPublish && showForm && (
        <Card as="section" className="pg-card">
          <div id="bm-form">
            <h2 className="bm-h2">{t('board_form_title')}</h2>
            <TextField id="bm-note" label={t('board_form_note')} value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder={t('board_form_note_placeholder')} disabled={submitting} />
            <TextAreaField id="bm-content" label={`${t('board_form_content')} *`} value={newContent} rows={10}
              onChange={e => { setNewContent(e.target.value); setFieldError(null) }} placeholder={t('board_form_content_placeholder')} disabled={submitting}
              hint={fieldError ? undefined : `${newContent.length} ${t('board_form_chars')}`} error={fieldError ?? undefined} />
            <TextAreaField id="bm-content-en" label={t('board_form_content_en')} value={newContentEn} rows={10} lang="en"
              onChange={e => { setNewContentEn(e.target.value); setFieldErrorEn(null) }} disabled={submitting} hint={fieldErrorEn ? undefined : t('board_form_content_en_hint')} error={fieldErrorEn ?? undefined} />
            <div className="pg-actions">
              <Button onClick={() => void handleSubmit()} disabled={submitting} aria-busy={submitting || undefined}>
                {submitting ? t('board_publishing') : t('board_publish')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <section aria-labelledby="bm-history-title">
        <h2 className="bm-h2" id="bm-history-title">{t('board_history_title')}</h2>

        {loading && <p className="cg-hint" role="status">{t('board_loading')}</p>}
        {!loading && versions.length === 0 && !error && <p>{t('board_empty')}</p>}

        {versions.length > 0 && (
          <Card className="bm-list">
            <ul className="bm-versions">
              {versions.map(v => (
                <li key={v.id} className="bm-ver">
                  <button type="button" className="bm-ver__head" aria-expanded={expandedId === v.id} aria-controls={`bm-v-${v.id}`}
                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    <span className="bm-ver__name">
                      {v.isActive && <Chip tone="ok" symbol="●">{t('board_active_badge')}</Chip>}
                      {v.contentEn && <Chip symbol="EN">{t('board_has_en')}</Chip>}
                      <strong>{v.version}</strong>
                      {v.note && <span className="cg-hint">{v.note}</span>}
                    </span>
                    <span className="bm-ver__tail">
                      <span className="cg-hint">{fmtDate(v.createdAt)} · {v.uploader?.name}</span>
                      <span aria-hidden="true">{expandedId === v.id ? '▴' : '▾'}</span>
                    </span>
                  </button>
                  {canPublish && !v.isActive && (
                    <div className="pg-actions bm-roll">
                      <Button variant="ghost" disabled={activating !== null} onClick={() => setConfirming(v)}>
                        {activating === v.id ? '...' : t('board_rollback')}
                      </Button>
                    </div>
                  )}
                  {expandedId === v.id && <p className="bm-body bm-body--open" id={`bm-v-${v.id}`}>{v.content}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Dialog
        open={confirming !== null} onClose={() => setConfirming(null)} title={confirming ? `${t('board_confirm_activate')} ${confirming.version}?` : ''}
        actions={<>
          <Button variant="ghost" onClick={() => setConfirming(null)}>{t('board_cancel')}</Button>
          <Button onClick={() => { if (confirming) void handleActivate(confirming.id, confirming.version) }}>{t('board_rollback')}</Button>
        </>}
      />
    </div>
  )
}

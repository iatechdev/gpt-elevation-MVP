// frontend/src/pages/board/BoardManifest.tsx
import { useState, useEffect } from 'react'
import { useLanguage } from '../../i18n/useLanguage'

const API = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

interface ManifestVersion {
  id: number
  version: string
  isActive: boolean
  note: string | null
  content: string
  createdAt: string
  uploader: { id: number; name: string; email: string }
}

export function BoardManifest() {
  const { t } = useLanguage()

  const [versions, setVersions]     = useState<ManifestVersion[]>([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  const [newContent, setNewContent] = useState('')
  const [newNote, setNewNote]       = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const token = localStorage.getItem('elevation_token')

  const fetchVersions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/board/manifest`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setVersions(data)
    } catch (err: any) {
      setError(err.message || t('board_error_load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVersions() }, [])

  const handleSubmit = async () => {
    if (newContent.trim().length < 50) {
      setError(t('board_error_min'))
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/api/board/manifest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent.trim(), note: newNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`${t('board_success_upload')} ${data.version}`)
      setNewContent('')
      setNewNote('')
      setShowForm(false)
      await fetchVersions()
    } catch (err: any) {
      setError(err.message || t('board_error_upload'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async (id: number, version: string) => {
    if (!confirm(`${t('board_confirm_activate')} ${version}?`)) return
    setActivating(id)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/api/board/manifest/${id}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`${t('board_success_activate')} ${version}`)
      await fetchVersions()
    } catch (err: any) {
      setError(err.message || t('board_error_activate'))
    } finally {
      setActivating(null)
    }
  }

  const active = versions.find(v => v.isActive)

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* Título */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 400,
          fontSize: '1.6rem', color: '#1C1917', margin: 0,
        }}>
          {t('board_manifest_title')}
        </h1>
        <p style={{ fontSize: 13, color: '#A8A29E', margin: '0.4rem 0 0' }}>
          {t('board_manifest_subtitle')}
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '0.5px solid #FECACA',
          borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
          fontSize: 13, color: '#B91C1C',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          background: '#EAF0E6', border: '0.5px solid #A8B5A2',
          borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
          fontSize: 13, color: '#4B5E3F',
        }}>
          {success}
        </div>
      )}

      {/* Banner versión activa */}
      {active && (
        <div style={{
          background: '#FAFAF8', border: '0.5px solid #A8B5A2',
          borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#6B7D5C', display: 'inline-block',
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5E3F', letterSpacing: '0.05em' }}>
                {t('board_active_version')} — {active.version}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#A8A29E' }}>
              {fmtDate(active.createdAt)} · {active.uploader?.name}
            </span>
          </div>
          {active.note && (
            <p style={{ fontSize: 12, color: '#78716C', fontStyle: 'italic', margin: '0 0 0.75rem' }}>
              {active.note}
            </p>
          )}
          <p style={{
            fontSize: 13, color: '#57534E', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', margin: 0,
            maxHeight: 160, overflowY: 'auto',
          }}>
            {active.content}
          </p>
        </div>
      )}

      {/* Botón nueva versión */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '0.55rem 1.25rem', fontSize: 13, fontWeight: 500,
            borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
            background: showForm ? '#F5F3EF' : '#4B5E3F',
            color: showForm ? '#78716C' : '#fff',
            border: showForm ? '0.5px solid #D6D2C4' : 'none',
          }}
        >
          {showForm ? t('board_cancel') : t('board_new_version')}
        </button>
      </div>

      {/* Formulario nueva versión */}
      {showForm && (
        <div style={{
          background: '#FAFAF8', border: '0.5px solid #E7E5E4',
          borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1C1917', margin: '0 0 1rem' }}>
            {t('board_form_title')}
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 6 }}>
              {t('board_form_note')}
            </label>
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder={t('board_form_note_placeholder')}
              style={{
                width: '100%', padding: '0.55rem 0.75rem', fontSize: 13,
                border: '0.5px solid #D6D2C4', borderRadius: 8,
                background: '#fff', color: '#1C1917', boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 6 }}>
              {t('board_form_content')} <span style={{ color: '#B91C1C' }}>*</span>
            </label>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={t('board_form_content_placeholder')}
              rows={10}
              style={{
                width: '100%', padding: '0.75rem', fontSize: 13, lineHeight: 1.7,
                border: '0.5px solid #D6D2C4', borderRadius: 8,
                background: '#fff', color: '#1C1917', resize: 'vertical',
                boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            />
            <span style={{ fontSize: 11, color: '#A8A29E' }}>
              {newContent.length} {t('board_form_chars')}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '0.55rem 1.5rem', fontSize: 13, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? '#A8B5A2' : '#4B5E3F', color: '#fff',
              transition: 'all 0.15s',
            }}
          >
            {submitting ? t('board_publishing') : t('board_publish')}
          </button>
        </div>
      )}

      {/* Historial de versiones */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#78716C', letterSpacing: '0.08em', margin: '0 0 1rem', textTransform: 'uppercase' }}>
          {t('board_history_title')}
        </h3>

        {loading && (
          <p style={{ fontSize: 13, color: '#A8A29E' }}>{t('board_loading')}</p>
        )}

        {!loading && versions.length === 0 && (
          <p style={{ fontSize: 13, color: '#A8A29E' }}>{t('board_empty')}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {versions.map(v => (
            <div key={v.id} style={{
              background: '#FAFAF8',
              border: `0.5px solid ${v.isActive ? '#A8B5A2' : '#E7E5E4'}`,
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* Fila resumen */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1.25rem', cursor: 'pointer',
              }}
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {v.isActive && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#6B7D5C', display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: v.isActive ? 600 : 400, color: '#1C1917' }}>
                    {v.version}
                  </span>
                  {v.isActive && (
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                      background: '#EAF0E6', color: '#4B5E3F',
                      border: '0.5px solid #A8B5A2', letterSpacing: '0.06em',
                    }}>
                      {t('board_active_badge')}
                    </span>
                  )}
                  {v.note && (
                    <span style={{ fontSize: 12, color: '#A8A29E', fontStyle: 'italic' }}>
                      {v.note}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: 11, color: '#A8A29E' }}>
                    {fmtDate(v.createdAt)} · {v.uploader?.name}
                  </span>
                  {!v.isActive && (
                    <button
                      onClick={e => { e.stopPropagation(); handleActivate(v.id, v.version) }}
                      disabled={activating === v.id}
                      style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 6,
                        border: '0.5px solid #D6D2C4', background: '#fff',
                        color: '#78716C', cursor: activating === v.id ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {activating === v.id ? '...' : t('board_rollback')}
                    </button>
                  )}
                  <span style={{ fontSize: 11, color: '#D6D2C4' }}>
                    {expandedId === v.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Contenido expandido */}
              {expandedId === v.id && (
                <div style={{
                  padding: '0 1.25rem 1rem',
                  borderTop: '0.5px solid #E7E5E4',
                }}>
                  <p style={{
                    fontSize: 13, color: '#57534E', lineHeight: 1.8,
                    whiteSpace: 'pre-wrap', margin: '1rem 0 0',
                  }}>
                    {v.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
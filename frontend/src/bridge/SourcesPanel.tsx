// ES-121: «Análisis con IA de tus fuentes». Un interruptor por fuente (chat, diario, hoja de vida) = un permiso propio; «Analizar» pide propuestas de UNA fuente a la vez.
// Activar un permiso pide confirmación en un diálogo; retirarlo es inmediato (no borra nada). Las propuestas no se guardan: viven en la pantalla hasta que la persona las autoriza.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { bridgeCopy } from './copy'
import { analyze, listResumeVersions, readPermissions, setPermission, SourcesError } from './insightsApi'
import { PermissionSwitch } from './PermissionSwitch'
import { retryable, sourceIds } from './sources'
import type { Failure, ResumeVersion } from './sources'
import type { Insight, SourceId } from './logic'

type Copy = Record<keyof typeof bridgeCopy.es, string>
type Props = { baseUrl: string; token: string; lang: 'es' | 'en'; onResult: (source: SourceId, insights: Insight[]) => void; onExpired: () => void }
type Notice = { kind: 'ok' | 'error' | 'info'; text: string; source?: SourceId; retry?: boolean; upload?: boolean } | null
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value)), text)
const dateOf = (iso: string, lang: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString(lang === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '' }

export function SourcesPanel({ baseUrl, token, lang, onResult, onExpired }: Props) {
  const c: Copy = bridgeCopy[lang]
  const opts = useMemo(() => ({ baseUrl, token }), [baseUrl, token])
  const [perms, setPerms] = useState<Record<SourceId, boolean> | null>(null); const [loadError, setLoadError] = useState(false)
  const [versions, setVersions] = useState<ResumeVersion[]>([]); const [versionId, setVersionId] = useState<number | null>(null)
  const [saving, setSaving] = useState<SourceId | null>(null); const [analyzing, setAnalyzing] = useState<SourceId | null>(null)
  const [asking, setAsking] = useState<SourceId | null>(null); const [notice, setNotice] = useState<Notice>(null)
  const dialog = useRef<HTMLDivElement | null>(null); const cancelButton = useRef<HTMLButtonElement | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(false)
    try {
      const [granted, list] = await Promise.all([readPermissions({ ...opts, signal }), listResumeVersions({ ...opts, signal })])
      if (signal?.aborted) return
      setPerms(granted); setVersions(list)
    } catch (error) {
      if (signal?.aborted) return
      if (error instanceof SourcesError && error.kind === 'expired') onExpired(); else setLoadError(true)
    }
  }, [opts, onExpired])
  useEffect(() => { if (!token) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [token, load])

  // Diálogo: el foco entra en «Cancelar», Tab se queda dentro, Esc cancela y el foco vuelve al interruptor.
  useEffect(() => { if (asking) cancelButton.current?.focus() }, [asking])
  const close = (source: SourceId) => { setAsking(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-source="${source}"]`)?.focus()) }
  const trap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!asking) return
    if (event.key === 'Escape') { event.stopPropagation(); close(asking); return }
    if (event.key !== 'Tab') return
    const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
    if (!items.length) return
    const first = items[0]; const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const fail = (failure: Failure, source: SourceId) => {
    if (failure === 'expired') { onExpired(); return }
    if (failure === 'consent') { setPerms(current => (current ? { ...current, [source]: false } : current)); onResult(source, []); setNotice({ kind: 'error', text: c.src_consent_gone }); return }
    if (failure === 'nothing') { onResult(source, []); setNotice({ kind: 'info', text: c.src_nothing, source, upload: source === 'resume' }); return }
    const text = failure === 'limit' ? c.src_limit : failure === 'invalid' ? c.src_invalid : failure === 'network' ? c.src_network : c.src_unavailable
    setNotice({ kind: 'error', text, source, retry: retryable(failure) })
  }

  const save = async (source: SourceId, granted: boolean) => {
    setSaving(source); setNotice(null)
    try {
      await setPermission(opts, source, granted)
      if (!alive.current) return
      setPerms(current => (current ? { ...current, [source]: granted } : current))
      if (!granted) onResult(source, []) // lo propuesto con ese permiso deja de mostrarse
      setNotice({ kind: 'ok', text: c[`src_${granted ? 'granted' : 'revoked'}_${source}` as keyof Copy] })
    } catch (error) {
      if (!alive.current) return
      if (error instanceof SourcesError && error.kind === 'expired') onExpired(); else setNotice({ kind: 'error', text: c.src_save_error })
    } finally { if (alive.current) { setSaving(null); setAsking(null) } }
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-source="${source}"]`)?.focus())
  }

  const run = async (source: SourceId) => {
    setAnalyzing(source); setNotice(null)
    try {
      const insights = await analyze(opts, source, { locale: lang, today: new Date().toISOString().slice(0, 10), ...(source === 'resume' && versionId ? { resumeId: versionId } : {}) })
      if (!alive.current) return
      onResult(source, insights)
      if (!insights.length) { setNotice({ kind: 'info', text: c.src_nothing, source, upload: false }); return }
      setNotice({ kind: 'ok', text: insights.length === 1 ? c.src_found_one : fill(c.src_found, { n: insights.length }) })
    } catch (error) {
      if (!alive.current) return
      fail(error instanceof SourcesError ? error.kind : 'unavailable', source)
    } finally { if (alive.current) setAnalyzing(null) }
  }

  const toggle = (source: SourceId) => { if (!perms) return; if (perms[source]) void save(source, false); else { setNotice(null); setAsking(source) } }
  const busy = saving !== null || analyzing !== null
  const live = analyzing ? c[`src_reading_${analyzing}` as keyof Copy] : saving ? c.saving : notice?.kind === 'ok' ? notice.text : ''

  return <section className="bridge-sources" aria-labelledby="bridge-src-title">
    <h2 id="bridge-src-title">🔒 {c.src_title}</h2>
    <p className="bridge-small">{c.src_intro}</p>
    <p className="bridge-live" role="status" aria-live="polite">{live}</p>
    {notice && notice.kind !== 'ok' && <p className={`bridge-note${notice.kind === 'error' ? ' bridge-error' : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}
      {notice.retry && notice.source && <> <button type="button" className="bridge-link bridge-inline" disabled={busy} onClick={() => void run(notice.source as SourceId)}>{c.retry}</button></>}
      {notice.upload && <> <Link className="elv-link" to="/app/context">{c.src_upload_resume}</Link></>}</p>}
    {!perms && !loadError && <p role="status" aria-busy="true" className="bridge-small">{c.src_loading}</p>}
    {loadError && <p className="bridge-note bridge-error" role="alert"><button type="button" className="elv-link" onClick={() => void load()}>{c.src_perm_load_error}</button></p>}
    {perms && <ul className="bridge-src-list">{sourceIds.map(source => {
      const on = perms[source]; const rowBusy = saving === source
      return <li key={source} className="bridge-src">
        <div className="bridge-src-text">
          <h3 id={`src-h-${source}`}>{c[`src_name_${source}` as keyof Copy]} <span className={`bridge-pill${on ? ' bridge-pill-ok' : ' bridge-pill-dash'}`}>{on ? c.src_on : c.src_off}</span></h3>
          <p className="bridge-small" id={`src-d-${source}`}>{c[`src_what_${source}` as keyof Copy]}</p>
        </div>
        <PermissionSwitch checked={on} busy={rowBusy || analyzing !== null} label={c[`src_switch_${source}` as keyof Copy]} describedBy={`src-d-${source}`} dataSource={source} onToggle={() => toggle(source)} />
        <div className="bridge-src-actions">
          {source === 'resume' && on && versions.length > 0 && <label className="bridge-small">{c.src_version}{' '}
            <select className="bridge-select" value={versionId ?? ''} disabled={busy} onChange={event => setVersionId(event.target.value ? Number(event.target.value) : null)}>
              {versions.map((row, index) => <option key={row.id} value={index === 0 ? '' : row.id}>{fill(index === 0 ? c.src_version_latest : c.src_version_other, { v: row.version, date: dateOf(row.createdAt, lang) })}</option>)}
            </select></label>}
          <button type="button" className="bridge-cta bridge-src-run" disabled={!on || busy} aria-describedby={on ? undefined : `src-need-${source}`} onClick={() => void run(source)}>
            {analyzing === source ? c.src_analyzing : c[`src_analyze_${source}` as keyof Copy]}</button>
          {!on && <span className="bridge-small" id={`src-need-${source}`}>{c.src_need}</span>}
        </div>
      </li>
    })}</ul>}
    <p className="bridge-small" role="note">{c.src_note}</p>
    {asking && <div className="bridge-modal-bg">
      <div ref={dialog} className="bridge-modal" role="dialog" aria-modal="true" aria-labelledby="bridge-dlg-title" onKeyDown={trap}>
        <h3 id="bridge-dlg-title">{fill(c.dlg_title, { source: c[`src_of_${asking}` as keyof Copy] })}</h3>
        <ul>
          <li>{fill(c.dlg_1, { source: c[`src_of_${asking}` as keyof Copy] })}</li><li>{c.dlg_2}</li><li>{c.dlg_3}</li><li>{c.dlg_4}</li>
          {asking === 'resume' && <li>{c.dlg_resume}</li>}
        </ul>
        <div className="bridge-modal-btns">
          <button type="button" ref={cancelButton} className="bridge-no" disabled={saving !== null} onClick={() => close(asking)}>{c.cancel}</button>
          <button type="button" className="bridge-ok" disabled={saving !== null} onClick={() => void save(asking, true)}>{saving ? c.saving : c.dlg_yes}</button>
        </div>
      </div>
    </div>}
  </section>
}

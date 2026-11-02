import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evidenceApi } from '../evidence/api'
import type { Evidence } from '../evidence/model'
import type { LocalizedText, Skill } from './model'
import { buildSelfBody, MAX_NOTE, MAX_REFS, newRequestId, saveSelfAssessment, SelfAssessError, type SelfFailure } from './selfAssessApi'
import { trackView } from './model'

type T = (key: string) => string
type Lang = 'es' | 'en'
type Mode = 'idle' | 'form'
const fmt = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
const errorKey: Record<SelfFailure, string> = {
  expired: 'skill_map.expired', invalid: 'skill_map.reg_e_invalid', conflict: 'skill_map.reg_e_conflict', uncertain: 'skill_map.reg_e_uncertain', error: 'skill_map.reg_e_generic',
}

/** Autoevaluación manual (ES-30 · «Registrar mi nivel»): un nivel solo existe con evidencia confirmada que la persona cita. */
export function SelfAssessPanel({ skill, catalogVersion, lang, t, backend, token, onChanged }: {
  skill: Skill; catalogVersion: number; lang: Lang; t: T; backend: string; token: string; onChanged: (kind: 'saved' | 'retired') => void
}) {
  const hasSelf = !!skill.self && (trackView(skill.self).level !== null || trackView(skill.self).stale)
  const [mode, setMode] = useState<Mode>('idle')
  const [evidence, setEvidence] = useState<{ status: 'loading' } | { status: 'ready'; rows: Evidence[] } | { status: 'error'; reason: SelfFailure }>({ status: 'loading' })
  const [picked, setPicked] = useState<number[]>([])
  const [level, setLevel] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<SelfFailure | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const requestId = useRef<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // Al cambiar de capacidad se cierra todo: nada de lo escrito se arrastra a otra habilidad.
  useEffect(() => { setMode('idle'); setPicked([]); setLevel(null); setNote(''); setFailure(null); setConfirmRetire(false); requestId.current = null }, [skill.skillKey])
  useEffect(() => {
    if (mode !== 'form') return
    const controller = new AbortController(); setEvidence({ status: 'loading' })
    evidenceApi(backend, token).list(controller.signal)
      .then(rows => { if (!controller.signal.aborted) setEvidence({ status: 'ready', rows: rows.filter(row => row.status === 'confirmed') }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setEvidence({ status: 'error', reason: typeof error === 'object' && error !== null && 'status' in error && error.status === 401 ? 'expired' : 'error' }) })
    return () => controller.abort()
  }, [mode, backend, token])
  useEffect(() => { if (confirmRetire) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close() }, [confirmRetire])

  const rows = useMemo(() => evidence.status === 'ready' ? evidence.rows : [], [evidence])
  const refs = useMemo(() => picked.map(id => ({ evidenceId: id, version: rows.find(row => row.id === id)?.version ?? 0 })).filter(ref => ref.version > 0), [picked, rows])
  const ready = refs.length >= 1 && refs.length <= MAX_REFS && level !== null
  const changed = () => { requestId.current = null; setFailure(null) }
  const toggle = (id: number) => { changed(); setPicked(current => current.includes(id) ? current.filter(x => x !== id) : current.length >= MAX_REFS ? current : [...current, id]) }
  const localized = (value: LocalizedText | undefined) => value?.[lang] ?? t('skill_map.translation_missing')
  const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' }) }

  async function send(body: Parameters<typeof saveSelfAssessment>[0]['body'], kind: 'saved' | 'retired') {
    if (busy) return
    setBusy(true); setFailure(null)
    try { await saveSelfAssessment({ baseUrl: backend, token, body }); requestId.current = null; if (!alive.current) return; setConfirmRetire(false); setMode('idle'); setPicked([]); setLevel(null); setNote(''); onChanged(kind) }
    catch (error) { if (alive.current) setFailure(error instanceof SelfAssessError ? error.reason : 'error'); if (alive.current) setConfirmRetire(false) }
    finally { if (alive.current) setBusy(false) }
  }
  const save = () => {
    if (!ready || level === null) return
    requestId.current ??= newRequestId()
    try { void send(buildSelfBody({ requestId: requestId.current, skillKey: skill.skillKey, level, refs, note }), 'saved') } catch { setFailure('invalid') }
  }
  const retire = () => { requestId.current ??= newRequestId(); void send(buildSelfBody({ requestId: requestId.current, skillKey: skill.skillKey, level: null, refs: [], note: '' }), 'retired') }
  const problem = failure ? <p role="alert" className="skill-map-self-error">{t(errorKey[failure])}{failure === 'expired' && <> <Link className="elv-link" to="/login">{t('skill_map.signin')}</Link></>}</p> : null

  if (mode === 'idle') return <section className="skill-map-self" aria-label={t('skill_map.reg_title')}>
    <div className="skill-map-self-actions">
      <button type="button" className="elv-btn skill-map-primary" onClick={() => { setMode('form'); setFailure(null) }}>{t(hasSelf ? 'skill_map.change_btn' : 'skill_map.reg_btn')}</button>
      {hasSelf && <button type="button" className="elv-btn skill-map-danger" disabled={busy} onClick={() => setConfirmRetire(true)}>{t('skill_map.retire_btn')}</button>}
    </div>
    {problem}
    <dialog ref={dialog} className="skill-map-dialog" aria-labelledby="skill-map-retire-title" onCancel={event => { event.preventDefault(); if (!busy) setConfirmRetire(false) }}>
      <h2 id="skill-map-retire-title">{t('skill_map.retire_title')}</h2><p>{t('skill_map.retire_body')}</p>
      <div className="skill-map-dialog-actions"><button type="button" className="elv-btn" autoFocus disabled={busy} onClick={() => setConfirmRetire(false)}>{t('skill_map.reg_cancel')}</button>
        <button type="button" className="elv-btn skill-map-danger" disabled={busy} onClick={retire}>{busy ? t('skill_map.reg_saving') : t('skill_map.retire_yes')}</button></div>
    </dialog>
  </section>

  const none = evidence.status === 'ready' && rows.length === 0
  return <section className="skill-map-self is-open" aria-labelledby="skill-map-reg-title">
    <h3 id="skill-map-reg-title">{t('skill_map.reg_title')}</h3>
    {evidence.status === 'loading' && <p role="status">{t('skill_map.reg_loading')}</p>}
    {evidence.status === 'error' && <p role="alert" className="skill-map-self-error">{t(evidence.reason === 'expired' ? 'skill_map.expired' : 'skill_map.reg_e_generic')}</p>}
    {none && <div className="skill-map-self-empty" role="status"><strong>{t('skill_map.reg_none_title')}</strong><p>{t('skill_map.reg_none_text')}</p>
      <Link className="elv-btn skill-map-primary" to="/app/evidence">{t('skill_map.guide_cta')}</Link></div>}
    {evidence.status === 'ready' && !none && <form onSubmit={event => { event.preventDefault(); save() }} noValidate>
      <p className="skill-map-note">{t('skill_map.reg_intro')}</p>
      <fieldset className="skill-map-fieldset"><legend>{fmt(t('skill_map.reg_step1'), { max: MAX_REFS })}</legend>
        {rows.map(row => <label key={row.id} className="skill-map-opt"><input type="checkbox" checked={picked.includes(row.id)} disabled={busy || (!picked.includes(row.id) && picked.length >= MAX_REFS)} onChange={() => toggle(row.id)} />
          <span><strong>{row.payload.title}</strong><span className="skill-map-note">{fmt(t('skill_map.reg_ev_meta'), { date: date(row.createdAt), v: row.version })}</span></span></label>)}
        <p className="skill-map-note"><Link className="elv-link" to="/app/evidence">{t('skill_map.reg_see_evidence')}</Link></p>
      </fieldset>
      <fieldset className="skill-map-fieldset"><legend>{t('skill_map.reg_step2')}</legend>
        {[1, 2, 3, 4].map(n => <label key={n} className="skill-map-opt"><input type="radio" name="skill-map-level" checked={level === n} disabled={busy} onChange={() => { changed(); setLevel(n) }} />
          <span><strong>{t('skill_map.level')} {n}</strong><span>{localized(skill.rubric.levels[String(n)])}</span></span></label>)}
        <p className="skill-map-note">{fmt(t('skill_map.reg_rubric_src'), { v: catalogVersion })}</p>
      </fieldset>
      <div className="skill-map-field"><label htmlFor="skill-map-note">{t('skill_map.reg_step3')}</label>
        <textarea id="skill-map-note" value={note} maxLength={MAX_NOTE} disabled={busy} aria-describedby="skill-map-note-count" onChange={event => { changed(); setNote(event.target.value) }} />
        <p id="skill-map-note-count" className="skill-map-note">{note.length} / {MAX_NOTE}</p></div>
      <p className="skill-map-self-warn" role="note">{t('skill_map.reg_warn')}</p>
      {problem}
      <div className="skill-map-self-actions">
        <button type="button" className="elv-btn" disabled={busy} onClick={() => { setMode('idle'); setFailure(null) }}>{t('skill_map.reg_cancel')}</button>
        <button type="submit" className="elv-btn skill-map-primary" disabled={!ready || busy}>{busy ? t('skill_map.reg_saving') : t('skill_map.reg_save')}</button>
      </div>
    </form>}
    {(evidence.status !== 'ready' || none) && <div className="skill-map-self-actions"><button type="button" className="elv-btn" onClick={() => { setMode('idle'); setFailure(null) }}>{t('skill_map.reg_cancel')}</button></div>}
  </section>
}

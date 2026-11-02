// ES-109: campos que respalda una hoja de vida (experiencia, educación, habilidades, idiomas, sector y años totales) + la marca «Sugerido desde tu hoja de vida».
// Todo se puede escribir a mano sin hoja de vida. Editar un valor sugerido le quita la marca; quitarlo es de un gesto y tiene «Deshacer».
import { useState } from 'react'
import type { DeclaredSkill, Education, Experience, Language, ParticipantContext } from '../participantContext'
import { fill } from './resumeCopy'
import {
  MAX_EDUCATION, MAX_EXPERIENCE, MAX_LANGUAGES, MAX_SKILLS, currentYear, formatPeriod, insertAt, parsePeriod, removeAt,
  type ExtrasKey, type Flags, type ListKey, type Pending, type ScalarKey,
} from './resumeLogic'

type Change = (draft: ParticipantContext, flags: Flags) => void
export type ExtrasProps = {
  t: (key: string) => string
  lang: string
  draft: ParticipantContext
  flags: Flags
  pending: Pending
  errors: ExtrasKey[]
  busy: boolean
  onChange: Change
  onPending: (key: ScalarKey, use: boolean) => void
}
type Removed = { kind: 'item'; key: ListKey; index: number; item: unknown; suggested: boolean; label: string } | { kind: 'scalar'; key: 'sector' | 'totalYearsExperience'; value: string | number; label: string } | null

const CURRENT_WORD: Record<string, string> = { es: 'actual', en: 'current' }

export function SuggestionTag({ t }: { t: (key: string) => string }) {
  return <span className="rs-badge rs-badge-sage"><SparkIcon />{t('resume_suggested')}</span>
}

// Debajo de un campo escalar: marca, «Quitar» y, si había un valor propio, la sugerencia aparte (nunca se sobrescribe).
export function ScalarMeta({ t, name, label, flagged, pending, onRemove, onUse, onIgnore, hint }: {
  t: (key: string) => string; name: string; label: string; flagged: boolean; pending: string | number | undefined
  onRemove: () => void; onUse: () => void; onIgnore: () => void; hint?: string
}) {
  return <>
    {flagged && <div className="rs-meta"><SuggestionTag t={t} /><small>{hint ?? t('resume_edit_hint')}</small>
      <button type="button" className="elv-btn elv-btn-ghost" aria-label={`${t('resume_remove')}: ${label}`} onClick={onRemove}>{t('resume_remove')}</button></div>}
    {pending !== undefined && <div className="rs-pending" role="group" aria-label={fill(t('resume_suggestion_for'), { field: label })}>
      <SuggestionTag t={t} /><p><strong>{String(pending)}</strong></p>
      <div className="rs-actions"><button type="button" className="elv-btn elv-btn-primary" onClick={onUse} data-pending={name}>{t('resume_use_suggestion')}</button>
        <button type="button" className="elv-btn elv-btn-ghost" onClick={onIgnore}>{t('resume_ignore')}</button></div></div>}
  </>
}

function PeriodInput({ id, value, word, t, disabled, onChange, onValid }: {
  id: string; value: Pick<Experience, 'startYear' | 'endYear' | 'isCurrent'>; word: string; t: (key: string) => string; disabled: boolean
  onChange: (next: Pick<Experience, 'startYear' | 'endYear' | 'isCurrent'>) => void; onValid: (ok: boolean) => void
}) {
  const [text, setText] = useState(formatPeriod(value, word))
  const parsed = parsePeriod(text)
  const invalid = parsed === null
  const matches = parsed !== null && parsed.startYear === value.startYear && parsed.endYear === value.endYear && parsed.isCurrent === value.isCurrent
  // Si el valor cambió por fuera (Deshacer, nueva sugerencia) y ya no coincide con lo escrito, se muestra el valor; un texto no válido se conserva para corregirlo.
  const shown = invalid || matches ? text : formatPeriod(value, word)
  return <div className="rs-field"><label htmlFor={id}>{t('resume_period')}</label>
    <input id={id} className="elv-input" value={shown} disabled={disabled} maxLength={24} inputMode="text" aria-invalid={invalid} aria-describedby={`${id}-help`}
      onChange={event => {
        const next = event.target.value; setText(next)
        const nextParsed = parsePeriod(next)
        onValid(nextParsed !== null)
        if (nextParsed) onChange(nextParsed)
      }} />
    <small id={`${id}-help`} className={invalid ? 'rs-err' : ''}>{invalid ? t('resume_period_invalid') : t('resume_period_help')}</small></div>
}

export function ContextExtras(props: ExtrasProps) {
  const { t, lang, draft, flags, pending, errors, busy, onChange, onPending } = props
  const word = CURRENT_WORD[lang] ?? 'actual'
  const [removed, setRemoved] = useState<Removed>(null)
  const [bad, setBad] = useState<Record<string, boolean>>({})
  const [skill, setSkill] = useState('')
  const [live, setLive] = useState('')
  const markRemoved = (next: NonNullable<Removed>) => { setRemoved(next); setLive(`${t('resume_removed')}: ${next.label}`) }
  const err = (key: ExtrasKey) => errors.includes(key)

  function updateItem<K extends ListKey>(key: K, index: number, patch: Partial<ParticipantContext[K][number]>) {
    const list = (draft[key] as unknown[]).map((item, i) => (i === index ? { ...(item as object), ...patch } : item))
    const marks = flags[key].map((mark, i) => (i === index ? false : mark)) // editar un valor sugerido le quita la marca
    onChange({ ...draft, [key]: list } as ParticipantContext, { ...flags, [key]: marks })
  }
  function removeItem<K extends ListKey>(key: K, index: number, label: string) {
    const item = (draft[key] as unknown[])[index]; const suggested = flags[key][index] ?? false
    const next = removeAt(draft, flags, key, index)
    setBad({}) // las posiciones cambian: el aviso de años se recalcula al escribir
    markRemoved({ kind: 'item', key, index, item, suggested, label }); onChange(next.draft, next.flags)
  }
  function addItem<K extends ListKey>(key: K, item: ParticipantContext[K][number]) {
    const next = insertAt(draft, flags, key, (draft[key] as unknown[]).length, item, false); onChange(next.draft, next.flags)
  }
  function undo() {
    if (!removed) return
    if (removed.kind === 'item') { const next = insertAt(draft, flags, removed.key, Math.min(removed.index, (draft[removed.key] as unknown[]).length), removed.item, removed.suggested); onChange(next.draft, next.flags) }
    else onChange({ ...draft, [removed.key]: removed.value }, { ...flags, [removed.key]: true })
    setRemoved(null)
  }
  const scalarRemove = (key: 'sector' | 'totalYearsExperience', label: string) => {
    const value = draft[key]; if (value === null) return
    markRemoved({ kind: 'scalar', key, value, label }); onChange({ ...draft, [key]: null }, { ...flags, [key]: false })
  }
  const sectionError = (key: ExtrasKey) => err(key) ? <p className="rs-err" role="alert">{t('resume_section_invalid')}</p> : null
  const full = (key: ListKey, max: number) => (draft[key] as unknown[]).length >= max

  return (
    <div className="rs-extras">
      <div className="rs-live" role="status" aria-live="polite">{live}</div>
      {removed && <div className="rs-undo" role="status"><span>{t('resume_removed')}: {removed.label}</span><button type="button" className="elv-btn elv-btn-ghost" onClick={undo}>{t('resume_undo')}</button></div>}

      <div className="rs-field">
        <label htmlFor="sector">{t('resume_sector')}</label>
        <input id="sector" className="elv-input" maxLength={80} disabled={busy} value={draft.sector ?? ''} aria-invalid={err('sector')}
          onChange={event => onChange({ ...draft, sector: event.target.value || null }, { ...flags, sector: false })} />
        <ScalarMeta t={t} name="sector" label={t('resume_sector')} flagged={flags.sector && draft.sector !== null} pending={pending.sector}
          onRemove={() => scalarRemove('sector', t('resume_sector'))} onUse={() => onPending('sector', true)} onIgnore={() => onPending('sector', false)} />
      </div>
      <div className="rs-field">
        <label htmlFor="totalYearsExperience">{t('resume_total_years')}</label>
        <input id="totalYearsExperience" type="number" className="elv-input" min={0} max={60} step={1} disabled={busy} value={draft.totalYearsExperience ?? ''} aria-invalid={err('totalYearsExperience')} aria-describedby="totalYearsExperience-help"
          onChange={event => onChange({ ...draft, totalYearsExperience: event.target.value === '' ? null : event.target.valueAsNumber }, { ...flags, totalYearsExperience: false })} />
        <small id="totalYearsExperience-help">{t('resume_total_years_help')}</small>
        <ScalarMeta t={t} name="totalYearsExperience" label={t('resume_total_years')} flagged={flags.totalYearsExperience && draft.totalYearsExperience !== null} pending={pending.totalYearsExperience}
          onRemove={() => scalarRemove('totalYearsExperience', t('resume_total_years'))} onUse={() => onPending('totalYearsExperience', true)} onIgnore={() => onPending('totalYearsExperience', false)} />
      </div>

      <section className="rs-section" aria-labelledby="rs-h-exp">
        <h3 id="rs-h-exp">{t('resume_sec_experience')}</h3>
        {draft.experience.length === 0 && <p className="rs-help">{t('resume_empty_section')}</p>}
        {draft.experience.map((row, i) => (
          <div className={`rs-entry${flags.experience[i] ? ' rs-entry-sug' : ''}`} key={i} role="group" aria-label={`${t('resume_sec_experience')} ${i + 1}`}>
            <div className="rs-meta">{flags.experience[i] ? <SuggestionTag t={t} /> : <span />}
              <button type="button" className="elv-btn elv-btn-ghost" aria-label={`${t('resume_remove_item')}: ${row.role || i + 1}`} onClick={() => removeItem('experience', i, row.role || t('resume_sec_experience'))}>{t('resume_remove')}</button></div>
            <div className="rs-row3">
              <div className="rs-field"><label htmlFor={`exp-role-${i}`}>{t('resume_role')}</label>
                <input id={`exp-role-${i}`} className="elv-input" maxLength={120} disabled={busy} value={row.role} onChange={event => updateItem('experience', i, { role: event.target.value } as Partial<Experience>)} /></div>
              <div className="rs-field"><label htmlFor={`exp-org-${i}`}>{t('resume_organization')}</label>
                <input id={`exp-org-${i}`} className="elv-input" maxLength={120} disabled={busy} value={row.organization ?? ''} onChange={event => updateItem('experience', i, { organization: event.target.value || null } as Partial<Experience>)} /></div>
              <PeriodInput id={`exp-period-${i}`} value={row} word={word} t={t} disabled={busy}
                onValid={ok => setBad(prev => ({ ...prev, [`exp${i}`]: !ok }))} onChange={period => updateItem('experience', i, period)} />
            </div>
          </div>))}
        {sectionError('experience')}
        {Object.values(bad).some(Boolean) && <p className="rs-err" role="alert">{t('resume_period_invalid')}</p>}
        <button type="button" className="elv-btn elv-btn-ghost" disabled={busy || full('experience', MAX_EXPERIENCE)} onClick={() => addItem('experience', { role: '', organization: null, startYear: null, endYear: null, isCurrent: false })}>+ {t('resume_add_experience')}</button>
        {full('experience', MAX_EXPERIENCE) && <small>{t('resume_limit_reached')}</small>}
      </section>

      <section className="rs-section" aria-labelledby="rs-h-edu">
        <h3 id="rs-h-edu">{t('resume_sec_education')}</h3>
        {draft.education.length === 0 && <p className="rs-help">{t('resume_empty_section')}</p>}
        {draft.education.map((row, i) => (
          <div className={`rs-entry${flags.education[i] ? ' rs-entry-sug' : ''}`} key={i} role="group" aria-label={`${t('resume_sec_education')} ${i + 1}`}>
            <div className="rs-meta">{flags.education[i] ? <SuggestionTag t={t} /> : <span />}
              <button type="button" className="elv-btn elv-btn-ghost" aria-label={`${t('resume_remove_item')}: ${row.title || i + 1}`} onClick={() => removeItem('education', i, row.title || t('resume_sec_education'))}>{t('resume_remove')}</button></div>
            <div className="rs-row3">
              <div className="rs-field"><label htmlFor={`edu-kind-${i}`}>{t('resume_kind')}</label>
                <select id={`edu-kind-${i}`} className="elv-select" disabled={busy} value={row.kind} onChange={event => updateItem('education', i, { kind: event.target.value === 'certification' ? 'certification' : 'education' } as Partial<Education>)}>
                  <option value="education">{t('resume_kind_education')}</option><option value="certification">{t('resume_kind_certification')}</option></select></div>
              <div className="rs-field"><label htmlFor={`edu-title-${i}`}>{t('resume_edu_title')}</label>
                <input id={`edu-title-${i}`} className="elv-input" maxLength={160} disabled={busy} value={row.title} onChange={event => updateItem('education', i, { title: event.target.value } as Partial<Education>)} /></div>
              <div className="rs-field"><label htmlFor={`edu-inst-${i}`}>{t('resume_institution')}</label>
                <input id={`edu-inst-${i}`} className="elv-input" maxLength={120} disabled={busy} value={row.institution ?? ''} onChange={event => updateItem('education', i, { institution: event.target.value || null } as Partial<Education>)} /></div>
              <div className="rs-field"><label htmlFor={`edu-year-${i}`}>{t('resume_year')}</label>
                <input id={`edu-year-${i}`} type="number" className="elv-input" min={1950} max={currentYear()} step={1} disabled={busy} value={row.year ?? ''}
                  onChange={event => updateItem('education', i, { year: event.target.value === '' ? null : event.target.valueAsNumber } as Partial<Education>)} /></div>
            </div>
          </div>))}
        {sectionError('education')}
        <button type="button" className="elv-btn elv-btn-ghost" disabled={busy || full('education', MAX_EDUCATION)} onClick={() => addItem('education', { kind: 'education', title: '', institution: null, year: null })}>+ {t('resume_add_education')}</button>
        {full('education', MAX_EDUCATION) && <small>{t('resume_limit_reached')}</small>}
      </section>

      <section className="rs-section" aria-labelledby="rs-h-skills">
        <h3 id="rs-h-skills">{t('resume_sec_skills')}</h3>
        <p className="rs-help">{t('resume_skills_help')}</p>
        {draft.declaredSkills.length === 0 ? <p className="rs-help">{t('resume_empty_section')}</p>
          : <ul className="rs-chips" aria-label={t('resume_sec_skills')}>
            {draft.declaredSkills.map((row, i) => <li className={`rs-chip${flags.declaredSkills[i] ? ' rs-chip-sug' : ''}`} key={`${row.name}-${i}`}>
              <span>{row.name}</span>
              <button type="button" aria-label={fill(t('resume_skill_remove'), { name: row.name })} disabled={busy} onClick={() => removeItem('declaredSkills', i, row.name)}><XIcon /></button></li>)}
          </ul>}
        {draft.declaredSkills.some((_, i) => flags.declaredSkills[i]) && <p className="rs-meta"><SuggestionTag t={t} /></p>}
        {sectionError('declaredSkills')}
        <div className="rs-addrow">
          <div className="rs-field"><label htmlFor="skill-new">{t('resume_skill_new')}</label>
            <input id="skill-new" className="elv-input" maxLength={60} disabled={busy || full('declaredSkills', MAX_SKILLS)} value={skill} onChange={event => setSkill(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></div>
          <button type="button" className="elv-btn" disabled={busy || !skill.trim() || full('declaredSkills', MAX_SKILLS)} onClick={add}>{t('resume_skill_add')}</button>
        </div>
        {full('declaredSkills', MAX_SKILLS) && <small>{t('resume_limit_reached')}</small>}
      </section>

      <section className="rs-section" aria-labelledby="rs-h-lang">
        <h3 id="rs-h-lang">{t('resume_sec_languages')}</h3>
        <p className="rs-help">{t('resume_languages_help')}</p>
        {draft.languages.length === 0 && <p className="rs-help">{t('resume_empty_section')}</p>}
        {draft.languages.map((row, i) => (
          <div className={`rs-entry${flags.languages[i] ? ' rs-entry-sug' : ''}`} key={i} role="group" aria-label={`${t('resume_sec_languages')} ${i + 1}`}>
            <div className="rs-meta">{flags.languages[i] ? <SuggestionTag t={t} /> : <span />}
              <button type="button" className="elv-btn elv-btn-ghost" aria-label={`${t('resume_remove_item')}: ${row.name || i + 1}`} onClick={() => removeItem('languages', i, row.name || t('resume_sec_languages'))}>{t('resume_remove')}</button></div>
            <div className="rs-row2">
              <div className="rs-field"><label htmlFor={`lang-name-${i}`}>{t('resume_language')}</label>
                <input id={`lang-name-${i}`} className="elv-input" maxLength={40} disabled={busy} value={row.name} onChange={event => updateItem('languages', i, { name: event.target.value } as Partial<Language>)} /></div>
              <div className="rs-field"><label htmlFor={`lang-level-${i}`}>{t('resume_level')}</label>
                <input id={`lang-level-${i}`} className="elv-input" maxLength={40} disabled={busy} value={row.level ?? ''} onChange={event => updateItem('languages', i, { level: event.target.value || null } as Partial<Language>)} /></div>
            </div>
          </div>))}
        {sectionError('languages')}
        <button type="button" className="elv-btn elv-btn-ghost" disabled={busy || full('languages', MAX_LANGUAGES)} onClick={() => addItem('languages', { name: '', level: null })}>+ {t('resume_add_language')}</button>
        {full('languages', MAX_LANGUAGES) && <small>{t('resume_limit_reached')}</small>}
      </section>
    </div>
  )

  function add() {
    const name = skill.trim()
    if (!name || draft.declaredSkills.some(item => item.name.toLowerCase() === name.toLowerCase())) { setSkill(''); return }
    const entry: DeclaredSkill = { name, support: null, resumeVersion: null }
    addItem('declaredSkills', entry); setSkill('')
  }
}

const base = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true, className: 'rs-ico' } as const
const SparkIcon = () => <svg {...base}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
const XIcon = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>

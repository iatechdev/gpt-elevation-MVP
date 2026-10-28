import { useLanguage } from '../i18n/useLanguage'
import type { Draft } from './model'
export function EvidenceFormFields({ draft, change, errors }: { draft: Draft; change: <K extends keyof Draft>(key: K, value: Draft[K]) => void; errors: string[] }) {
  const { t } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  const error = (key: string) => errors.includes(key) ? <span id={`${key}-error`} className="evidence-error">{l('invalid_field')}</span> : null
  const help = (n: number) => l('limit').replace('{n}', String(n))
  const field = (key: 'title' | 'situation' | 'responsibility' | 'goal' | 'delivered' | 'learning', max: number) => <div className="evidence-field" key={key}>
    <label htmlFor={key}>{l(key === 'title' ? 'field_title' : key)} · {l(['title', 'situation', 'responsibility', 'delivered'].includes(key) ? 'required' : 'optional')}</label>
    {key === 'title' ? <input id={key} className="elv-input" value={draft[key]} maxLength={max} aria-invalid={errors.includes(key)} aria-describedby={`${key}-help${errors.includes(key) ? ` ${key}-error` : ''}`} onChange={event => change(key, event.target.value)} />
      : <textarea id={key} className="elv-textarea" rows={3} maxLength={max} value={draft[key]} aria-invalid={errors.includes(key)} aria-describedby={`${key}-help${errors.includes(key) ? ` ${key}-error` : ''}`} onChange={event => change(key, event.target.value)} />}
    <small id={`${key}-help`}>{help(max)}{['responsibility', 'delivered'].includes(key) && ` ${l('provenance')}: ${l('self_report')}`}</small>{error(key)}
  </div>
  return <>
    {field('title', 120)}{field('situation', 1000)}{field('responsibility', 1000)}
    {(['actions', 'alternatives'] as const).map(key => <fieldset className="elv-fieldset evidence-field" key={key} id={key} tabIndex={-1}>
      <legend className="elv-fieldset-legend">{l(key)} · {l(key === 'actions' ? 'required' : 'optional')}</legend>
      {draft[key].map((value, i) => <div className="evidence-array" key={i}>
        <label htmlFor={`${key}-${i}`}>{l(key)} {i + 1}</label>
        <textarea className="elv-textarea" id={`${key}-${i}`} rows={2} maxLength={key === 'actions' ? 1000 : 500} value={value} aria-invalid={errors.includes(key)}
          aria-describedby={errors.includes(key) ? `${key}-error` : undefined} onChange={event => change(key, draft[key].map((item, n) => n === i ? event.target.value : item))} />
        {key === 'actions' && <small>{l('provenance')}: {l('self_report')}</small>}
        <button type="button" className="elv-btn elv-btn-ghost" onClick={() => change(key, draft[key].filter((_, n) => n !== i))}>{l(key === 'actions' ? 'remove_action' : 'remove_alternative')} {i + 1}</button>
      </div>)}
      {error(key)}<button type="button" className="elv-btn" disabled={draft[key].length >= (key === 'actions' ? 8 : 5)} onClick={() => change(key, [...draft[key], ''])}>{l(key === 'actions' ? 'add_action' : 'add_alternative')}</button>
    </fieldset>)}
    {field('goal', 500)}{field('delivered', 1000)}
    <fieldset className="elv-fieldset evidence-field" id="observedEffect" tabIndex={-1}>
      <legend className="elv-fieldset-legend">{l('observedEffect')} · {l('required')}</legend>
      {(['known', 'unknown'] as const).map(value => <label className="evidence-choice" key={value}>
        <input type="radio" className="elv-radio" name="effect" checked={draft.effect === value} aria-invalid={errors.includes('observedEffect')}
          aria-describedby={errors.includes('observedEffect') ? 'observedEffect-error' : undefined} onChange={() => change('effect', value)} />{l(value)}
      </label>)}
      {draft.effect === 'known' && <><label htmlFor="effectText">{l('observedEffect')}</label><textarea id="effectText" className="elv-textarea" rows={3} maxLength={1000}
        value={draft.effectText} onChange={event => change('effectText', event.target.value)} aria-invalid={errors.includes('observedEffect')} aria-describedby={`effect-help${errors.includes('observedEffect') ? ' observedEffect-error' : ''}`} /><small id="effect-help">{help(1000)} {l('provenance')}: {l('self_report')}</small></>}
      {error('observedEffect')}
    </fieldset>
    {field('learning', 1000)}
    <div className="evidence-field"><label htmlFor="autonomy">{l('autonomy')}</label>
      <select id="autonomy" className="elv-select" value={draft.autonomy} aria-describedby="autonomy-help" onChange={event => change('autonomy', event.target.value as Draft['autonomy'])}>
        <option value="">{l('unset')}</option>{['conceptual', 'assisted', 'autonomous', 'leads'].map(value => <option key={value} value={value}>{l(value)}</option>)}
      </select><small id="autonomy-help">{l('autonomy_help')}</small>
    </div>
    <fieldset className="elv-fieldset evidence-field" id="artifactRefs" tabIndex={-1}><legend className="elv-fieldset-legend">{l('artifactRefs')}</legend>
      <p>{l('sample_help')}</p>{!draft.artifacts.length && <p>{l('no_sample')}</p>}
      {draft.artifacts.map((ref, i) => <div className="evidence-array" key={i}>
        <label htmlFor={`sample-type-${i}`}>{l('artifactRefs')} {i + 1}</label>
        <select id={`sample-type-${i}`} className="elv-select" value={ref.kind} onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, kind: event.target.value as 'url' | 'text' } : item))}>
          <option value="url">{l('url')}</option><option value="text">{l('text')}</option>
        </select>
        <label htmlFor={`sample-${i}`}>{l(ref.kind)}</label><textarea id={`sample-${i}`} className="elv-textarea" rows={2} value={ref.value} maxLength={ref.kind === 'url' ? 500 : 1000}
          aria-invalid={errors.includes('artifactRefs')} aria-describedby={errors.includes('artifactRefs') ? 'artifactRefs-error' : undefined}
          onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, value: event.target.value } : item))} />
        {ref.kind === 'url' && <><label htmlFor={`note-${i}`}>{l('note')}</label><input id={`note-${i}`} className="elv-input" value={ref.note} maxLength={300}
          onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, note: event.target.value } : item))} /></>}
        <button type="button" className="elv-btn elv-btn-ghost" onClick={() => change('artifacts', draft.artifacts.filter((_, n) => n !== i))}>{l('remove_sample')} {i + 1}</button>
      </div>)}
      {error('artifactRefs')}<button type="button" className="elv-btn" disabled={draft.artifacts.length >= 5} onClick={() => change('artifacts', [...draft.artifacts, { kind: 'url', value: '', note: '' }])}>{l('add_sample')}</button>
    </fieldset>
  </>
}

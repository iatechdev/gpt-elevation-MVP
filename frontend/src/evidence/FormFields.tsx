import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useLanguage } from '../i18n/useLanguage'
import { Button, LinkButton, ScaleField, SelectField, TextAreaField, TextField } from '../cartografia'
import type { Draft } from './model'
// ES-308 (PR 2): los campos son piezas de Cartografía (etiqueta, pista y error con ⚠). Los ids de campo y de grupo no cambian: los enlaces del resumen de errores (`#clave`) siguen llegando a cada uno.
export function EvidenceFormFields({ draft, change, errors }: { draft: Draft; change: <K extends keyof Draft>(key: K, value: Draft[K]) => void; errors: string[] }) {
  const { t } = useLanguage(); const l = (key: string) => t(`evidence.${key}`)
  const bad = (key: string) => errors.includes(key) ? l('invalid_field') : undefined
  const fieldError = (key: string) => errors.includes(key) ? <p className="cg-error" id={`${key}-error`}>{l('invalid_field')}</p> : null // un solo aviso por grupo (acciones, alternativas, muestras)
  const help = (n: number) => l('limit').replace('{n}', String(n))
  const field = (key: 'title' | 'situation' | 'responsibility' | 'goal' | 'delivered' | 'learning', max: number) => {
    const label = `${l(key === 'title' ? 'field_title' : key)} · ${l(['title', 'situation', 'responsibility', 'delivered'].includes(key) ? 'required' : 'optional')}`
    const hint = `${help(max)}${['responsibility', 'delivered'].includes(key) ? ` ${l('provenance')}: ${l('self_report')}` : ''}`
    return key === 'title'
      ? <TextField key={key} id={key} label={label} hint={hint} error={bad(key)} value={draft[key]} maxLength={max} onChange={event => change(key, event.target.value)} />
      : <TextAreaField key={key} id={key} label={label} hint={hint} error={bad(key)} rows={3} maxLength={max} value={draft[key]} onChange={event => change(key, event.target.value)} />
  }
  return <>
    {field('title', 120)}{field('situation', 1000)}{field('responsibility', 1000)}
    {(['actions', 'alternatives'] as const).map(key => <fieldset className="cg-field" key={key} id={key} tabIndex={-1}>
      <legend className="cg-label">{l(key)} · {l(key === 'actions' ? 'required' : 'optional')}</legend>
      {draft[key].map((value, i) => <div className="pg-array" key={i}>
        <TextAreaField id={`${key}-${i}`} label={`${l(key)} ${i + 1}`} hint={key === 'actions' ? `${l('provenance')}: ${l('self_report')}` : undefined} aria-invalid={errors.includes(key) || undefined} aria-describedby={[key === 'actions' ? `${key}-${i}-hint` : '', errors.includes(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined} rows={2} maxLength={key === 'actions' ? 1000 : 500} value={value}
          onChange={event => change(key, draft[key].map((item, n) => n === i ? event.target.value : item))} />
        <div className="pg-actions"><Button variant="ghost" onClick={() => change(key, draft[key].filter((_, n) => n !== i))}>{l(key === 'actions' ? 'remove_action' : 'remove_alternative')} {i + 1}</Button></div>
      </div>)}
      {fieldError(key)}<div className="pg-actions"><LinkButton disabled={draft[key].length >= (key === 'actions' ? 8 : 5)} onClick={() => change(key, [...draft[key], ''])}>{l(key === 'actions' ? 'add_action' : 'add_alternative')}</LinkButton></div>
    </fieldset>)}
    {field('goal', 500)}{field('delivered', 1000)}
    <ScaleField id="observedEffect" tabIndex={-1} legend={`${l('observedEffect')} · ${l('required')}`} name="effect" value={draft.effect ?? ''}
      options={(['known', 'unknown'] as const).map(value => ({ value, label: l(value) }))} error={bad('observedEffect')} onChange={value => change('effect', value as Draft['effect'])} />
    {draft.effect === 'known' && <TextAreaField id="effectText" label={l('observedEffect')} hint={`${help(1000)} ${l('provenance')}: ${l('self_report')}`} error={bad('observedEffect')} rows={3} maxLength={1000}
      value={draft.effectText} onChange={event => change('effectText', event.target.value)} />}
    {field('learning', 1000)}
    <ScaleField legend={l('autonomy')} name="autonomy" hint={l('autonomy_help')} value={draft.autonomy}
      options={[{ value: '', label: l('unset') }, ...['conceptual', 'assisted', 'autonomous', 'leads'].map(value => ({ value, label: l(value) }))]} onChange={value => change('autonomy', value as Draft['autonomy'])} />
    <fieldset className="cg-field" id="artifactRefs" tabIndex={-1}><legend className="cg-label">{l('artifactRefs')}</legend>
      <p className="cg-hint">{l('sample_help')}</p>{!draft.artifacts.length && <p>{l('no_sample')}</p>}
      {draft.artifacts.map((ref, i) => <div className="pg-array" key={i}>
        <SelectField id={`sample-type-${i}`} label={`${l('artifactRefs')} ${i + 1}`} value={ref.kind} onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, kind: event.target.value as 'url' | 'text' } : item))}>
          <option value="url">{l('url')}</option><option value="text">{l('text')}</option>
        </SelectField>
        <TextAreaField id={`sample-${i}`} label={l(ref.kind)} aria-invalid={errors.includes('artifactRefs') || undefined} aria-describedby={errors.includes('artifactRefs') ? 'artifactRefs-error' : undefined} rows={2} value={ref.value} maxLength={ref.kind === 'url' ? 500 : 1000}
          onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, value: event.target.value } : item))} />
        {ref.kind === 'url' && <TextField id={`note-${i}`} label={l('note')} value={ref.note} maxLength={300}
          onChange={event => change('artifacts', draft.artifacts.map((item, n) => n === i ? { ...item, note: event.target.value } : item))} />}
        <div className="pg-actions"><Button variant="ghost" onClick={() => change('artifacts', draft.artifacts.filter((_, n) => n !== i))}>{l('remove_sample')} {i + 1}</Button></div>
      </div>)}
      {fieldError('artifactRefs')}<div className="pg-actions"><LinkButton disabled={draft.artifacts.length >= 5} onClick={() => change('artifacts', [...draft.artifacts, { kind: 'url', value: '', note: '' }])}>{l('add_sample')}</LinkButton></div>
    </fieldset>
  </>
}

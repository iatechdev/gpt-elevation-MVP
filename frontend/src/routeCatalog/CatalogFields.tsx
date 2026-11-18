import { Button, CheckField, SelectField, TextAreaField, TextField } from '../cartografia'
import { useLanguage } from '../i18n/useLanguage'
import { array, object, string, type Data, type Kind, type Spec } from './schema'
import type { Item } from './api'

// ES-310 (PR 4): campos con las piezas de Cartografía (etiqueta visible, mismos ids, mismos límites). La lógica de cada campo no cambia.
export function CatalogFields({ specs, value, onChange, items, path = 'item' }: { specs: Spec[]; value: Data; onChange: (next: Data) => void; items: Record<Kind, Item[]>; path?: string }) {
  const { lang, t } = useLanguage(); const tr = (key: string) => t(`catalog.${key}`)
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next })
  return <>{specs.filter(field => !field.when || value[field.when] === true).map(field => {
    const v = value[field.key]; const id = `${path}-${field.key}`; const label = field[lang]
    if (field.type === 'group') return <fieldset className="rc-group" key={id} id={id}><legend>{label}</legend><CatalogFields specs={field.children!} value={object(v)} onChange={next => set(field.key, next)} items={items} path={id} /></fieldset>
    if (field.type === 'repeat') {
      const rows = array(v)
      return <fieldset className="rc-group" key={id} id={id}><legend>{label}</legend>{rows.map((row, index) => <fieldset className="rc-group" key={index}><legend>{label} {index + 1}</legend><CatalogFields specs={field.children!} value={object(row)} items={items} path={`${id}-${index}`} onChange={next => set(field.key, rows.map((old, n) => n === index ? next : old))} /><div className="pg-actions"><Button variant="ghost" onClick={() => set(field.key, rows.filter((_, n) => n !== index))}>{tr('remove_row')} {index + 1}</Button></div></fieldset>)}<div className="pg-actions"><Button variant="ghost" disabled={rows.length >= (field.max ?? 12)} onClick={() => set(field.key, [...rows, {}])}>{tr('line')} · {label}</Button></div></fieldset>
    }
    if (field.type === 'refs') {
      const selected = array(v).map(string); const refs = field.ref ? items[field.ref] : []; const options = [...new Set([...(field.options ?? refs.map(item => item.itemKey)), ...selected])]
      return <fieldset className="rc-group" key={id} id={id}><legend>{label}</legend>{options.map(option => <CheckField key={option} checked={selected.includes(option)} disabled={!selected.includes(option) && selected.length >= (field.max ?? 12)} onChange={event => set(field.key, event.target.checked ? [...selected, option] : selected.filter(key => key !== option))} label={field.ref ? string(object(refs.find(item => item.itemKey === option)?.labels)[lang]) || option : tr(option).startsWith('catalog.') ? option : tr(option)} />)}{field.key === 'languagesRequired' && <TextField label={tr('other_language')} maxLength={2} pattern="[a-z]{2}" onChange={event => { if (/^[a-z]{2}$/.test(event.target.value) && !selected.includes(event.target.value) && selected.length < 4) { set(field.key, [...selected, event.target.value]); event.target.value = '' } }} />}{!options.length && <p>{tr('none')}</p>}</fieldset>
    }
    if (field.type === 'boolean' || field.type === 'select') return <SelectField key={id} id={id} label={label} value={v === undefined ? '' : String(v)} onChange={event => set(field.key, event.target.value === '' ? undefined : field.type === 'boolean' ? event.target.value === 'true' : event.target.value)}><option value="">{tr('choose')}</option>{(field.type === 'boolean' ? ['true', 'false'] : field.options!).map(option => <option key={option} value={option}>{field.type === 'boolean' ? tr(option === 'true' ? 'yes' : 'no') : tr(option)}</option>)}</SelectField>
    const pattern = field.key.endsWith('Key') ? '[a-z][a-z0-9_]{2,47}' : ['market', 'country'].includes(field.key) ? '[A-Z]{2}' : field.key === 'currency' ? '[A-Z]{3}' : field.key === 'language' ? '[a-z]{2}' : undefined
    if (field.type === 'text' && (field.max ?? 0) > 100) return <TextAreaField key={id} id={id} label={label} rows={3} maxLength={field.max} value={string(v)} onChange={event => set(field.key, event.target.value)} />
    return <div className="rc-control" key={id}><TextField id={id} label={label} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={typeof v === 'number' ? v : string(v)} disabled={field.type === 'country' && v === null} maxLength={field.max} pattern={field.type === 'url' ? 'https://.*' : pattern} min={field.key === 'minutes' ? 1 : 0} max={field.type === 'date' ? new Date().toISOString().slice(0, 10) : field.type === 'number' ? field.max : undefined} step={field.key === 'amount' ? 'any' : 1} onChange={event => set(field.key, field.type === 'number' ? event.target.value === '' ? undefined : Number(event.target.value) : event.target.value)} />{field.type === 'country' && <CheckField checked={v === null} onChange={event => set(field.key, event.target.checked ? null : undefined)} label={tr('not_applicable')} />}</div>
  })}</>
}

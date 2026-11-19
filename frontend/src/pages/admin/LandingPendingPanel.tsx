// ES-90: panel «Pendientes de contenido» al inicio de la pestaña Landing. Usa el mismo guardado (PUT /api/landing-content) que el resto de campos.
// ES-315: Cartografía (Chip, TextField, Button, ItemList), sin estilos en línea ni colores propios.
import { useAdminText } from '../../i18n/useAdminText'
import { Button, Chip, TextField } from '../../cartografia'
import { PENDING_ITEMS, countPending, isPending } from './landingPending'
import type { Lang } from './landingPending'
import { LandingConflict } from './LandingConflict'
import { conflictId, type LandingVersion } from './landingVersions.ts'

type Props = {
  lang: Lang
  content: Record<string, string>
  setValue: (key: string, value: string) => void
  save: (key: string) => void
  saving: string | null
  msgs: Record<string, string>
  conflicts: Record<string, { current: LandingVersion | null }> // ES-279: conflicto de edición simultánea por texto
  onKeepMine: (key: string) => void
  onUseTheirs: (key: string) => void
}

export function LandingPendingPanel({ lang, content, setValue, save, saving, msgs, conflicts, onKeepMine, onUseTheirs }: Props) {
  const tr = useAdminText()
  const { pending, ready } = countPending(content, lang)
  if (pending === 0) return null
  return (
    <section aria-labelledby="landing-pending-title" className="ac-pending">
      <h2 id="landing-pending-title" className="ac-h2">{tr('Pendientes de contenido')}</h2>
      <p role="status" className="cg-hint">
        {pending} {tr('pendientes')} · {ready} {tr('listos')} ({lang.toUpperCase()}). {tr('Mientras un texto siga pendiente, la landing muestra el texto provisional; no se publica ningún dato sin verificar.')}
      </p>
      <ul className="cg-items" aria-label={tr('Pendientes de contenido')}>
        {PENDING_ITEMS.map(item => {
          const isOpen = isPending(item.key, content[item.key], lang)
          const id = `pending-${item.key}`
          return (
            <li key={item.key} className="cg-item ac-frow">
              <div className="ac-pendhead">
                <span className="cg-hint" id={`${id}-missing`}>{tr('Falta:')} {item.missing}</span>
                {isOpen ? <Chip tone="wait">{tr('Pendiente')}</Chip> : <Chip tone="ok" symbol="✓">{tr('Listo')}</Chip>}
              </div>
              <TextField id={id} label={item.label} aria-invalid={conflicts[item.key] ? true : undefined} aria-describedby={conflicts[item.key] ? `${id}-missing ${conflictId(item.key)}` : `${id}-missing`} disabled={saving === item.key} value={content[item.key] ?? ''} onChange={e => setValue(item.key, e.target.value)} />
              <div className="ac-fact"><Button onClick={() => save(item.key)} aria-disabled={saving !== null}>{saving === item.key ? '...' : tr('Guardar')}</Button></div>
              {conflicts[item.key] && <LandingConflict key={conflicts[item.key].current?.updatedAt ?? 'none'} fieldKey={item.key} current={conflicts[item.key].current} mine={content[item.key] ?? ''} busy={saving !== null} onKeepMine={() => onKeepMine(item.key)} onUseTheirs={() => onUseTheirs(item.key)} />}
              {msgs[item.key] && <p role="status" className={msgs[item.key].startsWith('✓') ? 'cg-hint' : 'cg-error'}>{tr(msgs[item.key])}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

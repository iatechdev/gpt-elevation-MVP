// ES-90: panel «Pendientes de contenido» al inicio de la pestaña Landing. Usa el mismo guardado (PUT /api/landing-content) que el resto de campos.
import { useAdminText } from '../../i18n/useAdminText'
import { PENDING_ITEMS, countPending, isPending } from './landingPending'
import type { Lang } from './landingPending'

type Styles = { card: React.CSSProperties; label: React.CSSProperties; input: React.CSSProperties; btnPrimary: React.CSSProperties }
type Props = {
  lang: Lang
  content: Record<string, string>
  setValue: (key: string, value: string) => void
  save: (key: string) => void
  saving: string | null
  msgs: Record<string, string>
  s: Styles
}

const chip = (pending: boolean): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
  background: pending ? '#FEF3C7' : '#DCFCE7', color: pending ? '#92400E' : '#166534',
})

export function LandingPendingPanel({ lang, content, setValue, save, saving, msgs, s }: Props) {
  const tr = useAdminText()
  const { pending, ready } = countPending(content, lang)
  if (pending === 0) return null
  return (
    <section aria-labelledby="landing-pending-title" style={{ marginBottom: '1.5rem' }}>
      <h2 id="landing-pending-title" style={{ fontSize: 16, margin: '0 0 4px' }}>{tr('Pendientes de contenido')}</h2>
      <p role="status" style={{ fontSize: 12, color: '#6B645F', margin: '0 0 12px' }}>
        {pending} {tr('pendientes')} · {ready} {tr('listos')} ({lang.toUpperCase()}). {tr('Mientras un texto siga pendiente, la landing muestra el texto provisional; no se publica ningún dato sin verificar.')}
      </p>
      {PENDING_ITEMS.map(item => {
        const isOpen = isPending(item.key, content[item.key], lang)
        const id = `pending-${item.key}`
        return (
          <div key={item.key} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <label htmlFor={id} style={s.label}>{item.label}</label>
              <span style={chip(isOpen)}>{isOpen ? tr('Pendiente') : tr('Listo')}</span>
            </div>
            <p id={`${id}-missing`} style={{ fontSize: 12, color: '#6B645F', margin: '0 0 8px' }}>{tr('Falta:')} {item.missing}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input id={id} aria-describedby={`${id}-missing`} disabled={saving === item.key} style={{ ...s.input, flex: 1 }} value={content[item.key] ?? ''} onChange={e => setValue(item.key, e.target.value)} />
              <button style={s.btnPrimary} onClick={() => save(item.key)} aria-disabled={saving !== null}>{saving === item.key ? '...' : tr('Guardar')}</button>
            </div>
            {msgs[item.key] && (
              <p role="status" style={{ fontSize: 11, color: msgs[item.key].startsWith('✓') ? '#5C6B4E' : '#DC2626', margin: '4px 0 0' }}>{tr(msgs[item.key])}</p>
            )}
          </div>
        )
      })}
    </section>
  )
}

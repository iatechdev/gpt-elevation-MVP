// ES-112: cabecera de la conversación (privada, «Pausar») y barra de uso de IA. Todo el texto sale de copy.ts (ES/EN).
import { useEffect } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { useSpaceToken } from './hooks'
import { setPaused, usePaused } from './pause'
import { isExhausted, renewalDate, usedPercent } from './usage'
import { load, publish, useUsageState } from './usageStore'

export function ChatBar({ sent }: { sent: number }) {
  const { lang } = useLanguage(); const c = copy[lang]; const token = useSpaceToken(); const paused = usePaused(); const s = useUsageState()
  useEffect(() => {
    if (!token) return
    let active = true
    load(token, () => active)
    return () => { active = false }
  }, [token, sent])
  const ready = s.status === 'ready' ? s.usage : null
  const date = ready && ready.configured ? renewalDate(ready.resetsAt, lang) : ''
  return <section className="space-scope space-chatbar" aria-label={c.conversation}>
    <div className="space-chatbar-head">
      <div><h2>{c.conversation}</h2><p>{c.convPrivate}</p></div>
      <button type="button" className="space-ghost" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? `▶ ${c.resume}` : `⏸ ${c.pause}`}</button>
    </div>
    {s.status === 'loading' && <p className="space-note" role="status">{c.usageLoading}</p>}
    {s.status === 'error' && <p className="space-note" role="status"><button type="button" className="elv-link" onClick={() => { publish({ status: 'loading' }); load(token) }}>{c.usageError}</button></p>}
    {ready && !ready.configured && <p className="space-callout" role="status">{c.usageNone}</p>}
    {ready && ready.configured && <div className="space-usage">
      <div className="space-usage-text"><span>{c.usage}</span><span>{c.usageValue.replace('{n}', String(usedPercent(ready)))} · {c.usageRenews.replace('{date}', date)}</span></div>
      <div className={`space-meter${isExhausted(ready) ? ' space-meter-full' : ''}`} role="progressbar" aria-label={c.usage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent(ready)}><i style={{ width: `${usedPercent(ready)}%` }} /></div>
    </div>}
    {paused && <p className="space-callout" role="status">{c.paused}</p>}
    {ready && ready.configured && isExhausted(ready) && <p className="space-callout" role="status">{c.exhausted.replace('{date}', date)}</p>}
  </section>
}

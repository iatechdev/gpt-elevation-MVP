// ES-112 / ES-333 (PR 2): barra compacta de la conversación: «Menú», «Conversación» + «Privada · Solo visible para ti» y «Pausar» (siempre visibles), con el uso de IA como barra fina de 6 px.
// El texto del uso («Uso de IA… · n % usado · Se renueva el…») vive en el menú (UsageText) y, en escritorio, junto a la barra. Todo el texto sale de copy.ts (ES/EN).
import { useEffect, useRef, type ReactNode } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { useSpaceToken } from './hooks'
import { setPaused, usePaused } from './pause'
import { isExhausted, renewalDate, usedPercent } from './usage'
import { load, publish, useUsageState } from './usageStore'

/** Texto del uso de IA («Uso de IA este periodo · 42 % usado · Se renueva el 30 nov.») o su estado (cargando, error con «Reintentar», sin límite). */
export function UsageText() {
  const { lang } = useLanguage(); const c = copy[lang]; const token = useSpaceToken(); const s = useUsageState()
  const ready = s.status === 'ready' ? s.usage : null
  const date = ready && ready.configured ? renewalDate(ready.resetsAt, lang) : ''
  return <>
    {s.status === 'loading' && <p className="space-note" role="status">{c.usageLoading}</p>}
    {s.status === 'error' && <p className="space-note" role="status"><button type="button" className="elv-link" onClick={() => { publish({ status: 'loading' }); load(token) }}>{c.usageError}</button></p>}
    {ready && !ready.configured && <p className="space-note" role="status">{c.usageNone}</p>}
    {ready && ready.configured && <p className="space-usage-text"><span>{c.usage}</span><span>{c.usageValue.replace('{n}', String(usedPercent(ready)))} · {c.usageRenews.replace('{date}', date)}</span></p>}
  </>
}

export function ChatBar({ sent, menu }: { sent: number; menu?: ReactNode }) {
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
      {menu}
      <div className="space-chatbar-copy"><h2>{c.conversation}</h2><p>{c.convPrivate}</p></div>
      <button type="button" className="space-ghost" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? c.resume : c.pause}</button>
    </div>
    {ready && ready.configured && <div className="space-usage">
      <div className={`space-meter${isExhausted(ready) ? ' space-meter-full' : ''}`} role="progressbar" aria-label={c.usage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent(ready)}><i style={{ width: `${usedPercent(ready)}%` }} /></div>
    </div>}
    {(!ready || !ready.configured) && <div className="space-chatbar-state"><UsageText /></div>}
    {ready && ready.configured && date && <div className="space-usage-desktop"><UsageText /></div>}
  </section>
}

// ES-333 (PR 2): avisos largos de pausa y de límite agotado: van al final del hilo (con role=status, como antes), no en la barra: así la barra y el compositor tienen alto constante.
// El aviso de límite agotado conserva su texto completo (alcance y fecha de renovación, ES-134).
export function ThreadNotices() {
  const { lang } = useLanguage(); const c = copy[lang]; const paused = usePaused(); const s = useUsageState()
  const ready = s.status === 'ready' ? s.usage : null
  const date = ready && ready.configured ? renewalDate(ready.resetsAt, lang) : ''
  const pausedNote = useRef<HTMLParagraphElement>(null), exhaustedNote = useRef<HTMLParagraphElement>(null)
  const exhausted = !!ready && ready.configured && isExhausted(ready)
  // ES-342 (A1): el aviso vive al final del hilo; al aparecer se trae a la vista (si no, queda bajo el borde del hilo, junto al compositor, y se lee a medias).
  useEffect(() => { if (paused) pausedNote.current?.scrollIntoView({ block: 'nearest' }) }, [paused])
  useEffect(() => { if (exhausted) exhaustedNote.current?.scrollIntoView({ block: 'nearest' }) }, [exhausted])
  return <>
    {paused && <p ref={pausedNote} className="space-scope space-callout" role="status">{c.paused}</p>}
    {exhausted && <p ref={exhaustedNote} className="space-scope space-callout" role="status">{c.exhausted.replace('{date}', date)}</p>}
  </>
}

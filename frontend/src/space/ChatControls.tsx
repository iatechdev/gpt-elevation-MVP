import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalChat } from './usePersonalChat'
import { useChatBlocked } from './usageStore'
import { useLanguage } from '../i18n/useLanguage'
const MAX_MESSAGE = 4000 // tope del textarea (maxLength); el contador aparece cuando quedan 400 o menos
const COUNTER_FROM = 3600
// ES-123: ChatContext = avisos de la conversación (sesión vencida, error de carga, envío sin confirmar); ChatInput = caja de mensaje con el selector del diario plegable.
export function ChatContext({ chat }: { chat: PersonalChat }) {
  const { c } = chat
  if (chat.expired) return <div className="space-scope" role="alert">{c.session} <Link to="/login">{c.login}</Link></div>
  return <div className="space-scope">
    {!chat.loaded && <button className="elv-btn" onClick={() => void chat.reload().catch(() => {})}>{c.loadError}</button>}
    {chat.intent && <div className="space-pending"><p>{c.unconfirmed}</p><p className="space-private-text">{chat.intent.message}</p></div>}
    {chat.intent && <div className="space-actions"><button className="elv-btn" disabled={chat.busy} onClick={() => void chat.check()}>{c.check}</button>{chat.retryable && <button className="elv-btn" disabled={chat.busy} onClick={() => void chat.retry()}>{c.retrySend}</button>}</div>}
  </div>
}
export function ChatInput({ chat }: { chat: PersonalChat }) {
  const { c } = chat; const { lang } = useLanguage(); const blocked = useChatBlocked(); const off = blocked.paused || blocked.exhausted
  const toggle = useRef<HTMLButtonElement>(null)
  if (chat.expired) return null
  const locked = chat.busy || !!chat.intent
  const closePicker = () => { chat.setPicker(false); toggle.current?.focus() }
  const diary = chat.selected.length ? c.diaryCount.replace('{n}', String(chat.selected.length)) : c.diaryNone
  return <form className="space-scope chat-composer" onSubmit={event => { event.preventDefault(); void chat.send() }}>
    <div className="chat-composer-top">
      <button ref={toggle} type="button" className="elv-btn chat-diary-toggle" aria-expanded={chat.picker} aria-controls="chat-diary-panel" disabled={locked} onClick={() => chat.picker ? chat.setPicker(false) : void chat.loadPicker()}>📖 {diary} {chat.picker ? '▴' : '▾'}</button>
      <span className="space-note">{c.ai}</span>
    </div>
    {chat.picker && <div id="chat-diary-panel" className="space-card chat-diary-panel" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closePicker() } }}>
      <fieldset className="space-context" disabled={locked}><legend>{c.choose}</legend>
        <p className="space-note">{c.limit}</p>{chat.pickerLoading ? <p>{c.loading}</p> : chat.pickerError ? <button type="button" className="elv-btn" onClick={() => void chat.loadPicker()}>{c.loadError}</button> : !chat.entries.length ? <p>{c.empty}</p> : chat.entries.map(e => <label key={e.id}><input className="elv-checkbox" type="checkbox" checked={chat.selected.some(s => s.id === e.id)} disabled={chat.selected.length >= 3 && !chat.selected.some(s => s.id === e.id)} onChange={event => chat.setSelected(previous => event.target.checked ? [...previous, e] : previous.filter(s => s.id !== e.id))} /><span>{e.date} · {e.content.slice(0, 120)}{e.content.length > 120 ? '…' : ''}</span></label>)}
        <button type="button" className="elv-btn" onClick={() => chat.setSelected([])}>{c.none}</button>
      </fieldset>
      <details className="chat-diary-help"><summary>{c.howTitle}</summary>
        <p className="space-note">{c.contextLimit}</p><p className="space-note">{c.contextPrivacy} {c.deselect}</p>
      </details>
      <button type="button" className="elv-btn" onClick={closePicker}>{c.close}</button>
    </div>}
    <p role="status" aria-live="polite" className="space-note chat-status">{chat.busy ? c.sending : chat.notice}</p>
    <p role="status" aria-live="polite" className="space-note chat-counter">{chat.input.length >= COUNTER_FROM ? (chat.input.length >= MAX_MESSAGE ? c.counterMax : c.counter.replace('{n}', chat.input.length.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US'))) : ''}</p>
    <div className="chat-composer-row">
      <label>{c.composer}<textarea className="elv-textarea space-message" value={chat.input} maxLength={MAX_MESSAGE} disabled={chat.busy || !!chat.intent || !chat.loaded || off} onChange={event => chat.setInput(event.target.value)} rows={3} /></label>
      <button className="elv-btn elv-btn-primary" disabled={chat.busy || !!chat.intent || !chat.loaded || off || !chat.input.trim()}>{chat.busy ? c.sending : c.send}</button>
    </div>
  </form>
}

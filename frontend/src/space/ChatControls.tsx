import { Link } from 'react-router-dom'
import type { PersonalChat } from './usePersonalChat'
export function ChatContext({ chat }: { chat: PersonalChat }) {
  const { c } = chat
  if (chat.expired) return <div className="space-scope" role="alert">{c.session} <Link to="/login">{c.login}</Link></div>
  return <div className="space-scope">
    <p className="space-note">{c.ai}</p>
    {!chat.loaded && <button className="elv-btn" onClick={() => void chat.reload().catch(() => {})}>{c.loadError}</button>}
    <button className="elv-btn" disabled={chat.busy || !!chat.intent} onClick={() => void chat.loadPicker()}>{c.choose}</button>
    <p className="space-note">{chat.selected.length ? `${c.count}: ${chat.selected.length}/3` : c.none}</p>
    {chat.picker && <fieldset className="space-card space-context" disabled={chat.busy || !!chat.intent}><legend>{c.choose}</legend>
      <p className="space-note">{c.limit}</p>{chat.pickerLoading ? <p>{c.loading}</p> : chat.pickerError ? <button type="button" className="elv-btn" onClick={() => void chat.loadPicker()}>{c.loadError}</button> : !chat.entries.length ? <p>{c.empty}</p> : chat.entries.map(e => <label key={e.id}><input className="elv-checkbox" type="checkbox" checked={chat.selected.some(s => s.id === e.id)} disabled={chat.selected.length >= 3 && !chat.selected.some(s => s.id === e.id)} onChange={event => chat.setSelected(previous => event.target.checked ? [...previous, e] : previous.filter(s => s.id !== e.id))} /><span>{e.date} · {e.content.slice(0, 120)}{e.content.length > 120 ? '…' : ''}</span></label>)}
      <button type="button" className="elv-btn" onClick={() => chat.setSelected([])}>{c.none}</button>
    </fieldset>}
    <p className="space-note">{c.contextLimit}</p><p className="space-note">{c.contextPrivacy} {c.deselect}</p>
    {chat.intent && <div className="space-pending"><p>{c.unconfirmed}</p><p className="space-private-text">{chat.intent.message}</p></div>}
    <p role="status" aria-live="polite">{chat.busy ? c.sending : chat.notice}</p>
    {chat.intent && <div className="space-actions"><button className="elv-btn" disabled={chat.busy} onClick={() => void chat.check()}>{c.check}</button>{chat.retryable && <button className="elv-btn" disabled={chat.busy} onClick={() => void chat.retry()}>{c.retrySend}</button>}</div>}
  </div>
}
export function ChatInput({ chat }: { chat: PersonalChat }) {
  const { c } = chat
  if (chat.expired) return null
  return <form className="space-scope" style={{ width: '100%' }} onSubmit={event => { event.preventDefault(); void chat.send() }}><label>{c.composer}<textarea className="elv-textarea space-message" value={chat.input} maxLength={4000} disabled={chat.busy || !!chat.intent || !chat.loaded} onChange={event => chat.setInput(event.target.value)} rows={2} /></label><button className="elv-btn elv-btn-primary" disabled={chat.busy || !!chat.intent || !chat.loaded || !chat.input.trim()}>{chat.busy ? c.sending : c.send}</button></form>
}

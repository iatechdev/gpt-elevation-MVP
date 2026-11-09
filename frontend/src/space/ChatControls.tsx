import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalChat } from './usePersonalChat'
import { useChatBlocked } from './usageStore'
import { useLanguage } from '../i18n/useLanguage'
import { enterShouldSend, readEnterSends, writeEnterSends } from './chatKeys'
const MAX_MESSAGE = 4000 // tope del textarea (maxLength); el contador aparece cuando quedan 400 o menos
const COUNTER_FROM = 3600
// ES-123: ChatContext = avisos de la conversación (sesión vencida, error de carga, envío sin confirmar); ChatInput = caja de mensaje con el selector del diario plegable.
// ES-162: «Copiar» el mensaje sin confirmar. navigator.clipboard.writeText dentro del clic; si el navegador lo rechaza, se selecciona el texto y se pide copiarlo a mano.
function CopyPending({ message, target, c }: { message: string; target: React.RefObject<HTMLParagraphElement | null>; c: PersonalChat['c'] }) {
  const [state, setState] = useState<'' | 'ok' | 'fail'>('')
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); setState('ok') }
    catch { if (target.current) window.getSelection()?.selectAllChildren(target.current); setState('fail') }
  }
  return <><button type="button" className="elv-btn" onClick={() => void copyMessage()}>{c.copy}</button><span aria-live="polite" role="status" className="space-note">{state === 'ok' ? c.copied : state === 'fail' ? c.copyFailed : ''}</span></>
}
export function ChatContext({ chat }: { chat: PersonalChat }) {
  const { c } = chat; const pendingText = useRef<HTMLParagraphElement>(null)
  if (chat.expired) return <div className="space-scope" role="alert">{c.session} <Link to="/login">{c.login}</Link></div>
  return <div className="space-scope">
    {!chat.loaded && <button className="elv-btn" onClick={() => void chat.reload().catch(() => {})}>{c.loadError}</button>}
    {chat.intent && <div className="space-pending"><p>{c.unconfirmed}</p><p ref={pendingText} className="space-private-text">{chat.intent.message}</p></div>}
    {chat.intent && <div className="space-actions"><button className="elv-btn" disabled={chat.busy} onClick={() => void chat.check()}>{c.check}</button>{chat.retryable && <button className="elv-btn" disabled={chat.busy} onClick={() => void chat.retry()}>{c.retrySend}</button>}<CopyPending key={chat.intent.requestId} message={chat.intent.message} target={pendingText} c={c} /></div>}
  </div>
}
// ES-142: aviso bajo la última respuesta cortada por longitud. El texto del modelo no se toca; «Continuar» envía un turno normal.
export function TruncatedNotice({ chat }: { chat: PersonalChat }) {
  const { c } = chat; const blocked = useChatBlocked(); const off = blocked.paused || blocked.exhausted
  const button = useRef<HTMLButtonElement>(null)
  const last = chat.messages[chat.messages.length - 1]
  if (chat.expired || !chat.loaded || last?.role !== 'bot' || !last.truncated) return null
  // Si el botón desaparece porque llegó la respuesta nueva, el foco pasa a la caja de mensaje.
  const onContinue = async () => { await chat.continueReply(); setTimeout(() => { if (!button.current?.isConnected) document.querySelector<HTMLTextAreaElement>('.space-message')?.focus() }, 0) }
  return <div className="space-scope chat-truncated">
    <p className="chat-truncated-msg" role="status">{c.truncated}<span className="chat-truncated-hint">{c.truncatedHint}</span></p>
    <button ref={button} type="button" className="elv-btn" disabled={chat.busy || !!chat.intent || off} onClick={() => void onContinue()}>{chat.busy ? c.sending : c.continue}</button>
  </div>
}
export function ChatInput({ chat }: { chat: PersonalChat }) {
  const { c } = chat; const { lang } = useLanguage(); const blocked = useChatBlocked(); const off = blocked.paused || blocked.exhausted
  const toggle = useRef<HTMLButtonElement>(null); const status = useRef<HTMLParagraphElement>(null)
  const [enterSends, setEnterSends] = useState(readEnterSends) // desactivado por defecto; se recuerda en este navegador
  // ES-134: el aviso de límite recibe el foco al aparecer (el campo de texto queda bloqueado y la persona no debe perderlo).
  useEffect(() => { if (chat.alert && chat.notice) status.current?.focus() }, [chat.alert, chat.notice])
  if (chat.expired) return null
  const locked = chat.busy || !!chat.intent
  const closePicker = () => { chat.setPicker(false); toggle.current?.focus() }
  const canSend = !(chat.busy || chat.intent || !chat.loaded || off || !chat.input.trim())
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
    <p ref={status} tabIndex={chat.alert ? -1 : undefined} role={chat.alert ? 'alert' : 'status'} aria-live={chat.alert ? 'assertive' : 'polite'} className="space-note chat-status">{chat.busy ? c.sending : chat.notice}</p>
    {chat.waiting && chat.slow && <div className="chat-slow"><p role="status" className="space-note">{c.slow}</p><button type="button" className="elv-btn" onClick={chat.stop}>{c.stopWaiting}</button></div>}
    <div className="sr-only" aria-live="polite" aria-atomic="true"><span key={chat.announceKey}>{chat.announcement}</span></div>
    <p role="status" aria-live="polite" className="space-note chat-counter">{chat.input.length >= COUNTER_FROM ? (chat.input.length >= MAX_MESSAGE ? c.counterMax : c.counter.replace('{n}', chat.input.length.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US'))) : ''}</p>
    <div className="chat-composer-row">
      <label>{c.composer}<textarea className="elv-textarea space-message" value={chat.input} maxLength={MAX_MESSAGE} disabled={chat.busy || !!chat.intent || !chat.loaded || off} onChange={event => chat.setInput(event.target.value)} rows={3}
        onKeyDown={event => { if (enterShouldSend({ key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, isComposing: event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode }, enterSends)) { event.preventDefault(); if (canSend) void chat.send() } }} /></label>
      <button className="elv-btn elv-btn-primary" disabled={chat.busy || !!chat.intent || !chat.loaded || off || !chat.input.trim()}>{chat.busy ? c.sending : c.send}</button>
    </div>
    <label className="chat-enter"><input className="elv-checkbox" type="checkbox" checked={enterSends} onChange={event => { setEnterSends(event.target.checked); writeEnterSends(event.target.checked) }} />{c.enterSends}</label>
  </form>
}

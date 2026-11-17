import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalChat } from './usePersonalChat'
import { useChatBlocked } from './usageStore'
import { useLanguage } from '../i18n/useLanguage'
import { enterShouldSend } from './chatKeys'
import { Button, Dialog } from '../cartografia'
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
// ES-333 (PR 2): avisos del envío (estado, respuesta lenta, anuncio) al FINAL del hilo, fuera del compositor, para que éste tenga alto constante. role=status / role=alert y el foco al aviso de límite (ES-134) se conservan.
export function ChatStatus({ chat }: { chat: PersonalChat }) {
  const { c } = chat; const status = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (chat.alert && chat.notice) status.current?.focus() }, [chat.alert, chat.notice])
  if (chat.expired) return null
  return <div className="space-scope chat-notices">
    <p ref={status} tabIndex={chat.alert ? -1 : undefined} role={chat.alert ? 'alert' : 'status'} aria-live={chat.alert ? 'assertive' : 'polite'} className="space-note chat-status">{chat.busy ? c.sending : chat.notice}</p>
    {chat.waiting && chat.slow && <div className="chat-slow"><p role="status" className="space-note">{c.slow}</p><button type="button" className="elv-btn" onClick={chat.stop}>{c.stopWaiting}</button></div>}
    <div className="sr-only" aria-live="polite" aria-atomic="true"><span key={chat.announceKey}>{chat.announcement}</span></div>
  </div>
}
// ES-333 (PR 2): el diario es una hoja inferior (Dialog) y no un panel que empuja el hilo; «Enter envía…» vive en el menú (el estado lo guarda quien monta el chat).
export function ChatInput({ chat, enterSends }: { chat: PersonalChat; enterSends: boolean }) {
  const { c } = chat; const { lang } = useLanguage(); const blocked = useChatBlocked(); const off = blocked.paused || blocked.exhausted
  const toggle = useRef<HTMLButtonElement>(null); const field = useRef<HTMLTextAreaElement>(null); const hadFocus = useRef(false)
  // E314-3: mientras se envía la caja se deshabilita y el foco caería al <body>; al terminar el envío vuelve a la caja si la persona estaba en ella (o en «Enviar»), salvo que el aviso de límite (ES-134) reclame el foco.
  useEffect(() => { if (!chat.busy && hadFocus.current && !chat.alert) { hadFocus.current = false; field.current?.focus() } }, [chat.busy, chat.alert])
  if (chat.expired) return null
  const locked = chat.busy || !!chat.intent
  const closePicker = () => chat.setPicker(false) // el Dialog devuelve el foco al botón «Diario» que lo abrió
  const canSend = !(chat.busy || chat.intent || !chat.loaded || off || !chat.input.trim())
  const diary = chat.selected.length ? c.diaryCount.replace('{n}', String(chat.selected.length)) : c.diaryNone
  return <form className="space-scope chat-composer" onSubmit={event => { event.preventDefault(); hadFocus.current = document.activeElement === field.current || (document.activeElement instanceof HTMLElement && document.activeElement.closest('.chat-composer-row') !== null); void chat.send() }}>
    <div className="chat-composer-top">
      <button ref={toggle} type="button" className="elv-btn chat-diary-toggle" aria-haspopup="dialog" aria-expanded={chat.picker} disabled={locked} onClick={() => void chat.loadPicker()}>{diary}</button>
    </div>
    <Dialog sheet open={chat.picker} onClose={closePicker} title={c.choose} actions={<Button variant="ghost" onClick={closePicker}>{c.close}</Button>}>
      <fieldset className="space-context" disabled={locked}><legend className="sr-only">{c.choose}</legend>
        <p className="space-note">{c.limit}</p>{chat.pickerLoading ? <p>{c.loading}</p> : chat.pickerError ? <button type="button" className="elv-btn" onClick={() => void chat.loadPicker()}>{c.loadError}</button> : !chat.entries.length ? <p>{c.empty}</p> : chat.entries.map(e => <label key={e.id}><input className="elv-checkbox" type="checkbox" checked={chat.selected.some(s => s.id === e.id)} disabled={chat.selected.length >= 3 && !chat.selected.some(s => s.id === e.id)} onChange={event => chat.setSelected(previous => event.target.checked ? [...previous, e] : previous.filter(s => s.id !== e.id))} /><span>{e.date} · {e.content.slice(0, 120)}{e.content.length > 120 ? '…' : ''}</span></label>)}
        <button type="button" className="elv-btn" onClick={() => chat.setSelected([])}>{c.none}</button>
      </fieldset>
      <details className="chat-diary-help"><summary>{c.howTitle}</summary>
        <p className="space-note">{c.contextLimit}</p><p className="space-note">{c.contextPrivacy} {c.deselect}</p>
      </details>
    </Dialog>
    <p role="status" aria-live="polite" className="space-note chat-counter">{chat.input.length >= COUNTER_FROM ? (chat.input.length >= MAX_MESSAGE ? c.counterMax : c.counter.replace('{n}', chat.input.length.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US'))) : ''}</p>
    <div className="chat-composer-row">
      <label><span className="sr-only">{c.composer}</span><textarea ref={field} className="elv-textarea space-message" value={chat.input} maxLength={MAX_MESSAGE} disabled={chat.busy || !!chat.intent || !chat.loaded || off} onChange={event => chat.setInput(event.target.value)} rows={1}
        onKeyDown={event => { if (enterShouldSend({ key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, isComposing: event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode }, enterSends)) { event.preventDefault(); if (canSend) { hadFocus.current = true; void chat.send() } } }} /></label>
      <button className="elv-btn elv-btn-primary" disabled={chat.busy || !!chat.intent || !chat.loaded || off || !chat.input.trim()}>{chat.busy ? c.sending : c.send}</button>
    </div>
  </form>
}

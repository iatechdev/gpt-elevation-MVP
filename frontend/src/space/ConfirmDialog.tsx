import { useEffect, useRef } from 'react'
export function ConfirmDialog({ text, cancel, confirm, onClose, onConfirm }: { text: string; cancel: string; confirm: string; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { const previous = document.activeElement; ref.current?.showModal(); cancelRef.current?.focus(); return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() } }, [])
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="space-dialog-text"><p id="space-dialog-text">{text}</p><div className="space-actions"><button className="elv-btn" ref={cancelRef} onClick={onClose}>{cancel}</button><button className="elv-btn" onClick={onConfirm}>{confirm}</button></div></dialog>
}

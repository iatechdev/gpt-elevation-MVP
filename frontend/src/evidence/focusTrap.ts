// ES-110: un diálogo modal no deja que Tab ni Shift+Tab salgan de él.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
export function trapTab(event: { key: string; shiftKey: boolean; preventDefault: () => void }, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(item => item.offsetParent !== null || item === document.activeElement)
  if (!items.length) { event.preventDefault(); container.focus(); return }
  const first = items[0]; const last = items[items.length - 1]; const active = document.activeElement
  if (event.shiftKey && (active === first || active === container || !container.contains(active))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (active === last || !container.contains(active))) { event.preventDefault(); first.focus() }
}

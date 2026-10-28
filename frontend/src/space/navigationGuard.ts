// Loaded before BrowserRouter so cancelled Back does not unmount private drafts.
let active: { index: number; cancel: () => boolean } | null = null
let restoring: number | null = null
window.addEventListener('popstate', event => {
  const index: unknown = event.state?.idx
  if (restoring !== null && index === restoring) { restoring = null; event.stopImmediatePropagation(); return }
  if (!active || typeof index !== 'number' || active.index === index || !active.cancel()) return
  event.stopImmediatePropagation(); restoring = active.index; window.history.go(active.index - index)
})
export function registerSpaceGuard(cancel: () => boolean) {
  const index: unknown = window.history.state?.idx
  const guard = typeof index === 'number' ? { index, cancel } : null
  active = guard
  return () => { if (active === guard) active = null }
}

// Loaded before BrowserRouter mounts. A popstate listener added by a page effect
// runs after the router's listener and cannot reliably preserve a mounted draft.
// Only this form registers a guard; all other routes retain existing navigation.
let active: { index: number; cancel: () => boolean } | null = null
let restoringIndex: number | null = null
window.addEventListener('popstate', event => {
  const index: unknown = event.state?.idx
  if (restoringIndex !== null && index === restoringIndex) {
    restoringIndex = null
    event.stopImmediatePropagation()
    return
  }
  if (!active || typeof index !== 'number' || index === active.index || !active.cancel()) return
  event.stopImmediatePropagation()
  restoringIndex = active.index
  window.history.go(active.index - index)
})
export function registerContextNavigationGuard(cancel: () => boolean) {
  const index: unknown = window.history.state?.idx
  const guard = typeof index === 'number' ? { index, cancel } : null
  active = guard
  return () => { if (active === guard) active = null }
}

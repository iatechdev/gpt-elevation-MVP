// Installed before BrowserRouter. No effect outside an active dirty facilitation form.
type Blocker = (target: () => void) => void
let blocker: Blocker | null = null
let restoring = false
let lastIndex: number | null = null
export function setBlocker(value: Blocker | null) {
  blocker = value
  lastIndex = typeof history.state?.idx === 'number' ? history.state.idx : null
}
window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; return }
  if (!blocker || lastIndex === null || typeof event.state?.idx !== 'number') return
  const delta = event.state.idx - lastIndex
  if (!delta) return
  event.stopImmediatePropagation()
  restoring = true
  history.go(-delta)
  const current = blocker
  current(() => { blocker = null; history.go(delta) })
})


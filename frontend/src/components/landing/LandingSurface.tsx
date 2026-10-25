import { useSyncExternalStore, type HTMLAttributes } from 'react'

const darkQuery = '(prefers-color-scheme: dark)'
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(darkQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const getSnapshot = () => window.matchMedia(darkQuery).matches

export function LandingSurface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return <div {...props} data-theme={dark ? 'elevation-landing-dark' : 'elevation-landing-light'}
    className={`landing-scope ${className}`} />
}

import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'
import { SpaceRoutesContext } from './routesContext'
function paths(children: ReactNode, parent = ''): string[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ path?: string; children?: ReactNode }>(child)) return []
    const path = child.props.path?.startsWith('/') ? child.props.path : [parent, child.props.path].filter(Boolean).join('/')
    return [...(path ? [path] : []), ...paths(child.props.children, path)]
  })
}
export function RegisteredRoutes({ children }: { children: ReactNode }) {
  return <SpaceRoutesContext.Provider value={new Set(paths(children))}>{children}</SpaceRoutesContext.Provider>
}

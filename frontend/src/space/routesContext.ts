import { createContext, useContext } from 'react'
export const SpaceRoutesContext = createContext<ReadonlySet<string>>(new Set())
export function useSpaceRoutes() { return useContext(SpaceRoutesContext) }

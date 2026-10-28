import { createContext, useContext } from 'react'
import type { Command, FixtureClient, State } from './fixture'
import type { CopyKey, Locale } from './copy'
export type CareerContextValue = { state: State; client: FixtureClient; lang: Locale; t: (key: CopyKey) => string; busy: boolean; uncertain: boolean; dirty: boolean; setDirty: (dirty: boolean, key?: string) => void; otherDirty: (key: string) => boolean; send: (command: Command, key?: string) => Promise<{ ok: boolean; id?: number }>; navigate: (to: string) => void }
export const CareerContext = createContext<CareerContextValue | null>(null)
export function useCareer() { const value = useContext(CareerContext); if (!value) throw new Error('Career provider missing'); return value }

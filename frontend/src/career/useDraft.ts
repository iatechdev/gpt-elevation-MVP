import { useEffect, useId } from 'react'
import { useCareer } from './context'
export function useDraft(key: string) {
  const instance = useId()
  const scopeKey = `${key}-${instance}`
  const c = useCareer(), setDirty = c.setDirty
  useEffect(() => () => setDirty(false, scopeKey), [scopeKey, setDirty])
  return { ...c, touch: () => setDirty(true, scopeKey), clean: () => setDirty(false, scopeKey), blocked: c.busy || c.uncertain || c.otherDirty(scopeKey), save: (command: Parameters<typeof c.send>[0]) => c.send(command, scopeKey) }
}

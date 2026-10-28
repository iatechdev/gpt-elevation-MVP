import { useEffect, useState } from 'react'
export const readEvidenceToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
export function useEvidenceToken() {
  const [token, setToken] = useState(readEvidenceToken)
  useEffect(() => {
    const update = () => setToken(readEvidenceToken())
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) }
  }, [])
  return token
}

import { useEffect, useState } from 'react'
export const readCompassToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
export function useCompassToken() {
  const [token, setToken] = useState(readCompassToken)
  useEffect(() => {
    const update = () => setToken(readCompassToken())
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) }
  }, [])
  return token
}


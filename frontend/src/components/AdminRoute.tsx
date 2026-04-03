import { Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'

export function AdminRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('elevation_token')
  const role  = localStorage.getItem('elevation_role')
  if (!token || (role !== 'admin' && role !== 'superadmin')) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
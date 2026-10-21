
// HU-046 — Route guard for /therapist/* paths

import { Navigate, Outlet } from 'react-router-dom'

export function TherapistRoute() {
  const token = localStorage.getItem('elevation_token')
  const role  = localStorage.getItem('elevation_role')

  if (!token) return <Navigate to="/login" replace />
  if (role !== 'therapist') return <Navigate to="/" replace />

  return <Outlet />
}
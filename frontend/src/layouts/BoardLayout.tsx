// frontend/src/layouts/BoardLayout.tsx
import { Outlet } from 'react-router-dom'
import { BoardFrame } from '../shell/frames'

// ES-153: marco de la junta: solo el manifiesto, sin barra lateral.
export function BoardLayout() {
  return <BoardFrame><Outlet /></BoardFrame>
}

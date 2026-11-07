// frontend/src/layouts/TherapistLayout.tsx
// HU-046 — Layout for therapist role · HU-082 — selector ES/EN · ES-100 — cabecera adaptable
// ES-153: marco del profesional (Panel, Personas en facilitación, menú con Revisiones profesionales y Salir).

import { Outlet } from 'react-router-dom'
import { ProfessionalFrame } from '../shell/frames'
import '../styles/therapist.css'

export function TherapistLayout() {
  return <ProfessionalFrame><Outlet /></ProfessionalFrame>
}

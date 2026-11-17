// frontend/src/layouts/TherapistLayout.tsx
// HU-046 — Layout for therapist role · HU-082 — selector ES/EN · ES-100 — cabecera adaptable
// ES-153: marco del profesional (Panel, Personas en facilitación, menú con Revisiones profesionales y Salir).
// ES-309: las pantallas ya migradas a Cartografía (shell/professionalLayoutState.ts) usan tema claro/oscuro del sistema.

import { Outlet, useLocation } from 'react-router-dom'
import { ProfessionalFrame } from '../shell/frames'
import { isMigratedProfessionalPath } from '../shell/professionalLayoutState'
import '../styles/therapist.css'

export function TherapistLayout() {
  const { pathname } = useLocation()
  return <ProfessionalFrame migrated={isMigratedProfessionalPath(pathname)}><Outlet /></ProfessionalFrame>
}

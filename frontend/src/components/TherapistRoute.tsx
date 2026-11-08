
// HU-046 — Route guard for /therapist/* paths
// ES-153: rol profesional verificado en el servidor; otro rol ve la pantalla «sin acceso».

import { RoleGate } from '../shell/RoleGate'

export function TherapistRoute() {
  return <RoleGate zone="professional" />
}

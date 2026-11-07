import { RoleGate } from '../shell/RoleGate'

// ES-153: la sesión se verifica en el servidor al entrar y la zona de la ruta decide el rol (shell/access.ts). Ya no basta con tener un token.
export function ProtectedRoute() {
  return <RoleGate />
}

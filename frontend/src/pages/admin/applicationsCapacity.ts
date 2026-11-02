// ES-107: aviso del backoffice cuando el formulario público de solicitudes está cerrado por el tope global.
// Solo lo ven admin y superadmin (el endpoint lo exige); al público el servidor le responde sin cifras.
export type Capacity = { full: boolean; pending: number; maxPending: number; bytes: number; maxBytes: number }

const MB = 1024 * 1024
const whole = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

// -> la respuesta validada, o null si el servidor devolvió algo que no es el contrato (el aviso nunca se inventa).
export function parseCapacity(body: unknown): Capacity | null {
  const c = body as Partial<Capacity> | null
  if (!c || typeof c !== 'object' || typeof c.full !== 'boolean') return null
  if (![c.pending, c.maxPending, c.bytes, c.maxBytes].every(whole)) return null
  return c as Capacity
}

// -> null cuando el formulario recibe solicitudes (no hay aviso).
export function capacityNotice(capacity: Capacity | null): { title: string; body: string } | null {
  if (!capacity || !capacity.full) return null
  const used = Math.round(capacity.bytes / MB)
  const max = Math.round(capacity.maxBytes / MB)
  return {
    title: 'El formulario público está cerrado',
    body: `Se alcanzó el tope de solicitudes: ${capacity.pending} de ${capacity.maxPending} pendientes (hojas de vida: ${used} de ${max} MB). `
      + 'Quien intente enviar una solicitud ve «Por ahora no estamos recibiendo solicitudes». '
      + 'Revisa, aprueba o rechaza las pendientes, o elimina las que ya no necesites, para volver a recibir.',
  }
}

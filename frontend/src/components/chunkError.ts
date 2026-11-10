// ES-129 (QA-129-02): reconoce el error de un bloque diferido que no se pudo descargar (404, corte de red o index.html servido en su lugar).
// ES-234 (E232-1): sin conexión, Vite falla primero con «Unable to preload CSS for …» (o «Unable to preload …» de otros recursos) antes de pedir el JS: también es un bloque que no se pudo descargar.
export function isChunkLoadError(error: unknown) {
  const text = `${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? error}`
  return /ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|MIME type|Unable to preload/i.test(text)
}

// ES-250 (E234-1, E234-2, E234-3): qué le decimos a la persona.
//  offline  = falló una descarga y el navegador no tiene red → «Sin conexión»
//  version  = falló la descarga de un bloque de JavaScript con red → «Hay una versión nueva» (bloque viejo, 404 o index.html en su lugar)
//  resource = falló otra descarga con red (CSS, imagen, un fetch suelto): NO se disfraza de «versión nueva»
//  code     = error real de código al renderizar (no es una descarga)
export type FailureKind = 'offline' | 'version' | 'resource' | 'code'
export function classifyFailure(error: unknown, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): FailureKind {
  if (!isChunkLoadError(error)) return 'code'
  if (!online) return 'offline'
  const text = `${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? error}`
  const scriptLike = /ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically|MIME type|Unable to preload[^\n]*\.m?js\b/i.test(text)
  return scriptLike ? 'version' : 'resource'
}

/** Registro sin datos personales: solo el NOMBRE del error y los nombres de componentes de la pila; nunca el mensaje, las props ni el estado. */
export function safeBoundaryLog(error: unknown, componentStack: string | null | undefined, pathname: string): string[] {
  const name = typeof (error as { name?: unknown })?.name === 'string' ? String((error as { name: string }).name).slice(0, 60) : 'Error'
  const components = [...(componentStack ?? '').matchAll(/^\s*at ([A-Za-z_$][\w$]*)/gm)].map(match => match[1]).slice(0, 8)
  return ['[boundary]', name, pathname.split(/[?#]/)[0].slice(0, 120), components.join(' > ')]
}

// ES-129 (QA-129-02): reconoce el error de un bloque diferido que no se pudo descargar (404, corte de red o index.html servido en su lugar).
// ES-234 (E232-1): sin conexión, Vite falla primero con «Unable to preload CSS for …» (o «Unable to preload …» de otros recursos) antes de pedir el JS: también es un bloque que no se pudo descargar.
export function isChunkLoadError(error: unknown) {
  const text = `${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? error}`
  return /ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|MIME type|Unable to preload/i.test(text)
}

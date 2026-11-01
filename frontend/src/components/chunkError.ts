// ES-129 (QA-129-02): reconoce el error de un bloque diferido que no se pudo descargar (404, corte de red o index.html servido en su lugar).
export function isChunkLoadError(error: unknown) {
  const text = `${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? error}`
  return /ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|MIME type/i.test(text)
}

// ES-63: decisión del PO: ambas puertas llevan siempre a /login, incluso con sesión.
export function doorTarget(): string {
  return '/login'
}

// Separa la última palabra (para el subrayado ocre); el texto completo se conserva intacto.
export function splitLastWord(title: string): { head: string; last: string } {
  const match = /^(.*?)(\S+)(\s*)$/s.exec(title)
  if (!match) return { head: title, last: '' }
  return { head: match[1], last: match[2] + match[3] }
}

export const journalCopy = {
  es: {
    title: 'Mi diario', private: 'Privado · Solo para ti', recent: 'Entradas recientes', select: 'Selecciona una entrada reciente o crea una nueva.',
    entry: 'Entrada privada', bridge: 'Al Puente →', bridgeNote: 'El Puente estará disponible cuando su flujo de autorización esté integrado.',
    manual: 'Guardado manual', draftWarning: 'El texto sin guardar permanece solo en esta pestaña. Guárdalo antes de cerrar.', save: 'Guardar entrada',
    unconfirmed: 'Guardado sin confirmar', count: 'caracteres',
  },
  en: {
    title: 'My diary', private: 'Private · Only for you', recent: 'Recent entries', select: 'Select a recent entry or create a new one.',
    entry: 'Private entry', bridge: 'To the Bridge →', bridgeNote: 'The Bridge will be available once its authorization flow is integrated.',
    manual: 'Manual saving', draftWarning: 'Unsaved text stays only in this tab. Save it before closing.', save: 'Save entry',
    unconfirmed: 'Save not confirmed', count: 'characters',
  },
} as const

// Noon/UTC keeps a stored calendar date stable across the browser's time zone.
export function journalDate(date: string, lang: 'es' | 'en') {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}
export function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

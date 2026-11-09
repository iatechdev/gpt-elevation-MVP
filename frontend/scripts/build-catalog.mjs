// ES-154: genera src/i18n/catalog/{es,en}.json desde docs/ux/plataforma/textos.json (fuente única de textos).
// Uso: `npm run i18n:build`. La prueba es-154 falla si los archivos generados no coinciden con la fuente.
// Las claves con un idioma vacío NO se escriben en ese idioma: la prueba las reporta y t() cae a la clave visible en desarrollo, nunca a un texto inventado.
import fs from 'node:fs'

const source = new URL('../../docs/ux/plataforma/textos.json', import.meta.url)
const outDir = new URL('../src/i18n/catalog/', import.meta.url)

export function splitCatalog(raw) {
  const out = { es: {}, en: {} }
  for (const [key, entry] of Object.entries(raw.textos)) {
    for (const lang of ['es', 'en']) if (typeof entry[lang] === 'string' && entry[lang].trim() !== '') out[lang][key] = entry[lang]
  }
  return out
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const { es, en } = splitCatalog(JSON.parse(fs.readFileSync(source, 'utf8')))
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(new URL('es.json', outDir), `${JSON.stringify(es)}\n`)
  fs.writeFileSync(new URL('en.json', outDir), `${JSON.stringify(en)}\n`)
  console.log(`catálogo: ${Object.keys(es).length} claves ES, ${Object.keys(en).length} claves EN`)
}

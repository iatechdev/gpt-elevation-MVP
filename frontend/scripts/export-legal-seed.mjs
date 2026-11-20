// ES-336 (F1): genera backend/seeds/legalSeed.json a partir de frontend/src/legal/legalCopy.ts (lo que sirve hoy la SPA). Uso, desde frontend/:  node scripts/export-legal-seed.mjs
// La prueba es-336-semilla.test.mjs falla si el archivo generado y legalCopy.ts dejan de coincidir.
import fs from 'node:fs'
import { LEGAL } from '../src/legal/legalCopy.ts'
import { TERMS_VERSION } from '../src/legal/version.ts'

export const buildSeed = () => {
  const documents = []
  for (const lang of ['es', 'en']) for (const docKey of ['privacy', 'terms']) {
    const c = LEGAL[lang][docKey]
    documents.push({ docKey, lang, content: { title: c.title, banner: c.draft, ...(c.updated ? { updated: c.updated } : {}), sections: c.sections } })
  }
  return { _comment: 'ES-336 (F1): semilla de los documentos legales = lo que sirve hoy frontend/src/legal/legalCopy.ts (privacy y terms, ES y EN). Regenerar con frontend/scripts/export-legal-seed.mjs; la prueba es-336-semilla.test.mjs comprueba que coinciden.', version: TERMS_VERSION, changeKind: 'material', documents }
}

const target = new URL('../../backend/seeds/legalSeed.json', import.meta.url)
if (process.argv[1]?.endsWith('export-legal-seed.mjs')) {
  const seed = buildSeed()
  fs.writeFileSync(target, JSON.stringify(seed, null, 2) + '\n')
  console.log(`${seed.documents.length} documentos, versión ${seed.version}`)
}

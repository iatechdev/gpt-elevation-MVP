// ES-301 (frontend): casilla del registro + páginas /privacidad y /terminos. Contratos del código; el comportamiento (axe claro/oscuro, teclado, errores por campo) lo mide scripts/es301-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { TERMS_VERSION } from '../src/legal/version.ts'
import { LEGAL } from '../src/legal/legalCopy.ts'
import { accessEs, accessEn } from '../src/access/accessCopy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const flat = (content) => [content.title, content.draft, content.updated ?? '', ...content.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.numbered ?? [])])].join('\n')

test('ES-301: la versión del cliente es la misma que fija el servidor (y el servidor exige la aceptación)', () => {
  const server = read('../../backend/utils/terms.js')
  assert.match(server, new RegExp(`const TERMS = Object\\.freeze\\(\\{ version: '${TERMS_VERSION}', required: true \\}\\)`))
  assert.equal(TERMS_VERSION, '2026-11-v2')
})

test('ES-301: los dos documentos existen en ES y EN, dicen «sin revisión legal» y su versión, y conservan los marcadores sin rellenar', () => {
  for (const lang of ['es', 'en']) for (const doc of ['privacy', 'terms']) {
    const text = flat(LEGAL[lang][doc])
    assert.ok(text.includes(TERMS_VERSION), `${lang}/${doc} dice su versión`)
    assert.match(LEGAL[lang][doc].draft, lang === 'es' ? /sin revisión legal/ : /without legal review/)
    assert.ok(/\[\[[^\]]+\]\]/.test(text), `${lang}/${doc} conserva marcadores`)
  }
  const es = flat(LEGAL.es.privacy) + flat(LEGAL.es.terms), en = flat(LEGAL.en.privacy) + flat(LEGAL.en.terms)
  // los datos de la empresa que faltan siguen como marcadores: nada de razón social, NIT, correo ni líneas inventadas
  for (const marker of ['[[POR COMPLETAR: razón social]]', '[[POR COMPLETAR: NIT]]', '[[POR COMPLETAR: plazos de conservación]]', '[[POR COMPLETAR: edad mínima, revisión legal]]', '[[POR COMPLETAR: ley aplicable, jurisdicción, contacto — revisión legal.]]', '[[POR COMPLETAR: línea local — decisión de producto pendiente, no inventar.]]']) assert.ok(es.includes(marker), marker)
  for (const marker of ['[[TO BE COMPLETED: legal name]]', '[[TO BE COMPLETED: tax ID]]', '[[TO BE COMPLETED: retention periods]]', '[[TO BE COMPLETED: minimum age, legal review]]', '[[TO BE COMPLETED: governing law, jurisdiction, contact — legal review.]]', '[[TO BE COMPLETED: local line — product decision pending, do not invent.]]']) assert.ok(en.includes(marker), marker)
  assert.doesNotMatch(es + en, /@[a-z0-9-]+\.[a-z]{2,}|https?:\/\/|\bNIT\s*\d|\b\d{3}\.\d{3}/i, 'sin correos, URLs ni números de empresa inventados')
})

test('ES-301: producto no clínico y sin promesas en los textos (diagnóstico, empleo, privacidad del diario y de la crisis)', () => {
  assert.match(flat(LEGAL.es.privacy), /No es terapia, no hace diagnósticos, no receta nada y no promete resultados ni empleo/)
  assert.match(flat(LEGAL.es.privacy), /Lo que podría indicar una crisis no se comparte con nadie/)
  assert.match(flat(LEGAL.en.privacy), /It is not therapy, it does not diagnose, it prescribes nothing, and it does not promise results or a job/)
  assert.match(flat(LEGAL.en.privacy), /Anything that could point to a crisis is not shared with anyone/)
  assert.match(flat(LEGAL.es.terms), /No garantizamos resultados, entrevistas, ofertas ni empleo/)
  assert.equal(LEGAL.es.terms.sections[0].numbered.length, 9); assert.equal(LEGAL.en.terms.sections[0].numbered.length, 9)
  assert.equal(LEGAL.es.privacy.sections.length, LEGAL.en.privacy.sections.length)
})

test('ES-301: las rutas /privacidad y /terminos existen, con noindex mientras haya marcadores', () => {
  const app = read('../src/App.tsx'), page = read('../src/legal/LegalPage.tsx')
  assert.match(app, /path="\/privacidad" element=\{<PrivacyPage \/>\}/); assert.match(app, /path="\/terminos" element=\{<TermsPage \/>\}/)
  assert.match(page, /meta\.name = 'robots'; meta\.content = 'noindex'/); assert.match(page, /if \(!markers\) return/)
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|innerHTML/)
  assert.doesNotMatch(read('../src/legal/legal.css').replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|rgb\(/)
})

test('ES-301: la casilla va en el registro con sus dos enlaces en pestaña nueva, error por campo y envío de acceptedTerms + termsVersion; sin «consentimiento»', () => {
  const card = read('../src/access/AccessCard.tsx'), page = read('../src/pages/LoginPage.tsx')
  assert.match(card, /type="checkbox"/); assert.match(card, /htmlFor="access-terms"/); assert.match(card, /aria-describedby=\{error \? 'access-terms-error' : undefined\}/)
  assert.equal((card.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length, 2); assert.match(card, /to="\/privacidad"/); assert.match(card, /to="\/terminos"/)
  assert.match(page, /acceptedTerms: true, termsVersion: TERMS_VERSION/)
  assert.match(page, /terms_required' \|\| data\.code === 'terms_not_accepted'/); assert.match(page, /terms_version_mismatch/)
  assert.match(page, /<Link to="\/privacidad">/)
  for (const key of ['access.terms_a', 'access.terms_privacy', 'access.terms_and', 'access.terms_terms', 'access.terms_end', 'access.terms_new_tab', 'access.err_terms', 'access.terms_changed']) { assert.ok(key in accessEs && key in accessEn, key) }
  assert.equal(accessEs['access.err_terms'], 'Para crear tu cuenta necesitas aceptar el aviso de privacidad y los términos.')
  assert.equal(accessEn['access.err_terms'], 'To create your account you need to accept the privacy notice and the terms.')
  assert.equal(accessEs['access.terms_a'] + accessEs['access.terms_privacy'] + accessEs['access.terms_and'] + accessEs['access.terms_terms'] + accessEs['access.terms_end'], 'He leído y acepto el aviso de privacidad y los términos de uso.')
  assert.equal(accessEn['access.terms_a'] + accessEn['access.terms_privacy'] + accessEn['access.terms_and'] + accessEn['access.terms_terms'] + accessEn['access.terms_end'], 'I have read and accept the privacy notice and the terms of use.')
  assert.ok(![...Object.values(accessEs), ...Object.values(accessEn)].some((text) => /consentimiento|consent\b/i.test(text)))
})

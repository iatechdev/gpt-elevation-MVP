// ES-182 (E45-1): Manifiesto ético con versión opcional en inglés — contrato del cliente y textos aprobados (ES-182, comentario 12765).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const es = read('../src/i18n/es.ts'), en = read('../src/i18n/en.ts')
const pub = read('../src/pages/ManifestoPage.tsx'), admin = read('../src/pages/board/BoardManifest.tsx')

test('E45-1: los 4 textos aprobados, tal cual, en ES y EN', () => {
  const T = {
    manifest_public_en_missing: ['Este texto aún no está disponible en inglés; se muestra la versión en español.', 'This text is not yet available in English; the Spanish version is shown.'],
    board_form_content_en: ['Versión en inglés (opcional)', 'English version (optional)'],
    board_form_content_en_hint: ['Si la dejas vacía, quienes lean en inglés verán el texto en español con un aviso.', 'If you leave it empty, people reading in English will see the Spanish text with a notice.'],
    board_has_en: ['Con versión en inglés', 'Has English version'],
  }
  for (const [key, [e, n]] of Object.entries(T)) { assert.ok(es.includes(`${key}: '${e}'`), `es ${key}`); assert.ok(en.includes(`${key}: '${n}'`), `en ${key}`) }
})

test('E45-1: página pública — en inglés usa contentEn si existe; si falta, texto en español con aviso y lang="es"; en español nunca muestra el aviso', () => {
  assert.match(pub, /contentEn: typeof en === 'string' && en\.trim\(\) \? en : null/)
  assert.match(pub, /const fallback = lang === 'en' && state\.status === 'ready' && !state\.manifesto\.contentEn/)
  assert.match(pub, /lang === 'en' && state\.manifesto\.contentEn \? state\.manifesto\.contentEn : state\.manifesto\.content/)
  assert.match(pub, /\{fallback && <Banner kind="note" title=\{t\('manifest_public_en_missing'\)\} \/>\}/)
  assert.match(pub, /lang=\{fallback \? 'es' : undefined\}/)
})

test('E45-1: administración — campo opcional (no cuenta para el mínimo de 50), se envía recortado y vacío = no se envía; marca EN en la versión activa y en el historial', () => {
  assert.match(admin, /contentEn: newContentEn\.trim\(\) \|\| undefined/)
  assert.match(admin, /id="bm-content-en" label=\{t\('board_form_content_en'\)\}[\s\S]*lang="en"[\s\S]*hint=\{fieldErrorEn \? undefined : t\('board_form_content_en_hint'\)\} error=\{fieldErrorEn \?\? undefined\}/)
  assert.match(admin, /if \(newContentEn\.trim\(\) && newContentEn\.trim\(\)\.length < 50\) \{\s*setFieldErrorEn\(t\('board_error_min'\)\)/) // vacío = válido; si viene, mismo mínimo que el español (el servidor también lo exige)
  assert.equal((admin.match(/\{(?:active|v)\.contentEn && <Chip symbol="EN">\{t\('board_has_en'\)\}<\/Chip>\}/g) ?? []).length, 2)
  assert.match(admin, /setNewContentEn\(''\)/)
})

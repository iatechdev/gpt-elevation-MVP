// ES-95: formulario público de profesionales y pestaña de solicitudes del backoffice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy, MAX_CV_BYTES } from '../src/professional/copy.ts'
import { EMPTY, LIMITS, fileProblem, validProfileUrl, validate } from '../src/professional/validation.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const pdf = { name: 'cv.pdf', type: 'application/pdf', size: 1000 }
const good = { ...EMPTY, name: 'Persona Sintética', email: 'synthetic@example.test', country: 'Colombia', profession: 'Psicología' }

test('ES-95: ES y EN tienen exactamente las mismas claves y ningún texto promete plazo, empleo ni ingresos', () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
  for (const lang of ['es', 'en']) for (const [key, value] of Object.entries(copy[lang])) {
    assert.ok(String(value).length > 1, `${lang}.${key}`)
    assert.doesNotMatch(String(value), /garantiz|guarantee|empleo seguro|job offer|ingresos|salary|en \d+ (horas|días)|within \d+/i, `${lang}.${key}`)
  }
  assert.match(copy.es.cv, /PDF, máximo 5 MB/); assert.match(copy.en.cv, /PDF, up to 5 MB/); assert.equal(MAX_CV_BYTES, 5 * 1024 * 1024)
  assert.match(copy.es.notice, /no es un servicio de emergencias/); assert.match(copy.en.notice, /not an emergency service/)
})

test('ES-95: validación del cliente: obligatorios, correo, enlace, consentimiento y hoja de vida', () => {
  assert.deepEqual(validate(good, pdf, true), [])
  assert.deepEqual(validate(EMPTY, null, false), ['name', 'email', 'country', 'profession', 'cv', 'consent'])
  assert.deepEqual(validate({ ...good, email: 'sin-arroba' }, pdf, true), ['email'])
  assert.deepEqual(validate({ ...good, profileUrl: 'javascript:alert(1)' }, pdf, true), ['profileUrl'])
  assert.deepEqual(validate({ ...good, profileUrl: 'https://example.test/perfil' }, pdf, true), [])
  assert.deepEqual(validate({ ...good, message: 'x'.repeat(LIMITS.message + 1) }, pdf, true), ['message'])
  assert.deepEqual(validate({ ...good, licenseNumber: '', profileUrl: '', message: '' }, pdf, true), []) // opcionales vacíos
  assert.equal(validProfileUrl('https://user:pass@example.test'), false); assert.equal(validProfileUrl('ftp://example.test'), false)
})

test('ES-95: la hoja de vida solo se acepta como PDF de hasta 5 MB, y quitarla vuelve a exigirla', () => {
  assert.equal(fileProblem(pdf), null); assert.equal(fileProblem(null), 'required')
  assert.equal(fileProblem({ name: 'cv.docx', type: 'application/msword', size: 10 }), 'type')
  assert.equal(fileProblem({ name: 'cv.pdf', type: '', size: 10 }), null) // algunos navegadores no informan el tipo: manda la extensión (el servidor verifica la firma real)
  assert.equal(fileProblem({ ...pdf, size: MAX_CV_BYTES + 1 }), 'size'); assert.equal(fileProblem({ ...pdf, size: MAX_CV_BYTES }), null)
  assert.deepEqual(validate(good, { name: 'cv.exe', type: 'application/x-msdownload', size: 10 }, true), ['cv'])
})

test('ES-95: el formulario no guarda nada en el navegador ni en la URL, no envía el nombre del archivo y trae campo trampa y accesibilidad', () => {
  const page = read('../src/professional/ProfessionalApplicationPage.tsx'); const api = read('../src/professional/api.ts')
  assert.doesNotMatch(page + api, /localStorage|sessionStorage|indexedDB|history\.(push|replace)State|navigate\(/)
  assert.match(api, /data\.append\('cv', file, 'cv\.pdf'\)/) // el nombre original no viaja
  assert.match(page, /<section[^>]*aria-labelledby="pro-title"/); assert.match(page, /role="alert"/); assert.match(page, /htmlFor=\{id\}/)
  assert.match(page, /pro-trap" aria-hidden="true"/); assert.match(page, /tabIndex=\{-1\} autoComplete="off" name="bot_trap"/)
  assert.match(page, /type="file" accept="application\/pdf,\.pdf"/); assert.match(page, /aria-describedby=\{`pro-cv-help/)
  assert.match(read('../src/App.tsx'), /path="\/profesionales" element=\{<ProfessionalApplicationPage \/>\}/) // ruta pública, fuera de las rutas con sesión
})

test('ES-95 backoffice: la pestaña lista, aprueba, rechaza con motivo, descarga con sesión y precarga «Crear usuario» sin contraseña', () => {
  const panel = read('../src/pages/admin/ProfessionalApplicationsPanel.tsx'); const users = read('../src/pages/admin/AdminUsers.tsx')
  assert.match(read('../src/pages/admin/AdminContent.tsx'), /<ProfessionalApplicationsPanel s=\{\{ card, label, input, btnPrimary, btnSecondary \}\} \/>/)
  assert.match(panel, /Aprobar no crea la cuenta/); assert.match(panel, /Escribe el motivo del rechazo/); assert.match(panel, /target="_blank" rel="noopener noreferrer"/)
  assert.match(panel, /Authorization: `Bearer \$\{token\}`/); assert.match(panel, /createObjectURL/); assert.doesNotMatch(panel, /window\.open|href=\{`\$\{API\}/) // sin URL pública de la hoja de vida
  assert.match(panel, /item\.status === 'approved' && <Link/); assert.match(panel, /to="\/admin\/users" state=\{\{ newTherapist: \{ name: item\.name, email: item\.email \} \}\}/); assert.doesNotMatch(panel, /\?newTherapist|[?&]name=|[?&]email=/) // sin datos personales en la URL
  assert.doesNotMatch(panel, /password/i) // la contraseña la define quien crea la cuenta
  assert.match(users, /location\.state as \{ newTherapist\?/); assert.match(users, /password: '', role: 'therapist'/); assert.match(users, /navigate\(location\.pathname, \{ replace: true, state: null \}\)/); assert.doesNotMatch(users, /searchParams\.get\('newTherapist'\)/)
})

test('ES-95 landing: el bloque de profesionales enlaza al formulario y el texto del catálogo deja de ser provisional', () => {
  const join = read('../src/components/landing/LandingJoin.tsx'); const catalog = JSON.parse(read('../../shared/landing-content.json'))
  assert.match(join, /<Link to="\/profesionales" className="elv-btn landing-join-create">\{text\('landing\.join\.professional_cta'\)\}<\/Link>/)
  const cta = catalog.find(entry => entry.key === 'landing.join.professional_cta')
  assert.deepEqual([cta.es, cta.en], ['Unirme como profesional', 'Join as a professional'])
  for (const entry of catalog.filter(e => e.key.startsWith('landing.join.professional'))) for (const lang of ['es', 'en']) assert.doesNotMatch(entry[lang], /\[|Próximamente|Coming soon/, entry.key)
})

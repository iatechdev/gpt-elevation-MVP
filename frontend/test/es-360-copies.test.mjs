// ES-360: revisión de copies de la plataforma (diseño 12863, decisiones 12870). Lo que NO puede volver a aparecer y lo que sí debe decir cada pantalla, en ES y EN.
// Aquí viven las comprobaciones de contenido; el comportamiento en navegador (axe, CLS, teclado, demostración sin red) lo mide scripts/es360-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createLoader } from './support/loadTsx.mjs'
import { accessEs, accessEn } from '../src/access/accessCopy.ts'
import { shellCopy } from '../src/shell/copy.ts'
import { PUBLIC_NAV } from '../src/shell/nav.ts'
import { dataCopy } from '../src/space/dataCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const byKey = Object.fromEntries(catalog.map(entry => [entry.key, entry]))
const root = new URL('../src/components/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const load = createLoader()
const sections = load(`${root}landing/PortadaSections.tsx`)
const requirements = load(`${root}../access/PasswordRequirements.tsx`)
const text = lang => key => { const entry = byKey[key]; if (!entry) throw new Error(`sin clave ${key}`); return entry[lang] }
const html = element => renderToStaticMarkup(createElement(MemoryRouter, null, element))
const visible = catalog

test('ES-360 marcadores internos: ningún texto del catálogo trae notas de diseño, planes de prueba, estados de la escala vieja ni marcadores pendientes (ES y EN)', () => {
  const internal = /sintétic|synthetic|dato de prueba|test data|plan de prueba|test plan|espacio reservado|space reserved|fotograf|photograph|POR COMPLETAR|POR REVISAR|TO BE COMPLETED|\bTODO\b|lorem|\[\[|\{\{|\bundefined\b|\bNaN\b|\bnull\b|qa-/i
  const oldScale = /Disponibilidad por confirmar|Availability to be confirmed|Próximamente|Coming soon|Consulta disponibilidad|Check availability/
  for (const entry of visible) for (const lang of ['es', 'en']) {
    assert.doesNotMatch(entry[lang], internal, `${entry.key} (${lang})`)
    assert.doesNotMatch(entry[lang], oldScale, `${entry.key} (${lang})`)
  }
})

test('ES-360 privacidad: ni «solo tú los ves» ni «un espacio solo para ti» en el registro, el inicio de sesión ni «Mis datos»; el registro dice qué ve cada actor', () => {
  const only = /solo tú|solo tu |only you|a space just for you|un espacio solo para ti|just for you/i
  for (const copy of [accessEs, accessEn]) for (const [key, value] of Object.entries(copy)) assert.doesNotMatch(value, only, key)
  for (const lang of ['es', 'en']) for (const [key, value] of Object.entries(dataCopy[lang])) assert.doesNotMatch(String(value), only, `data.${key} (${lang})`)
  const es = read('../src/i18n/es.ts'), en = read('../src/i18n/en.ts')
  assert.doesNotMatch(es, /Un espacio solo para ti|Entrar a mi espacio/); assert.doesNotMatch(en, /A space just for you|Enter my space/)
  // qué ve cada actor: el profesional no lee chat ni diario; la IA procesa con un proveedor externo; nada sobre el equipo de Elevation (no verificado)
  assert.match(accessEs['access.privacy_note'], /Tu profesional no puede leer tus conversaciones con el asistente ni tu diario/); assert.match(accessEs['access.privacy_note'], /proveedor externo/)
  assert.match(accessEn['access.privacy_note'], /Your professional cannot read your conversations with the assistant or your journal/); assert.match(accessEn['access.privacy_note'], /external provider/)
  for (const value of [accessEs['access.privacy_note'], accessEn['access.privacy_note']]) assert.doesNotMatch(value, /equipo|team|nadie|nobody/i)
})

test('ES-360 textos de acceso: «Iniciar sesión» / «Sign in» (no «Entrar»), enlace de privacidad al aviso completo y sin «Crear una cuenta es gratis»', () => {
  assert.equal(accessEs['access.sign_in'], 'Iniciar sesión'); assert.equal(accessEn['access.sign_in'], 'Sign in')
  assert.equal(shellCopy.es.signIn, 'Iniciar sesión'); assert.equal(shellCopy.en.signIn, 'Sign in')
  assert.equal(accessEs['access.privacy_link'], 'aviso de privacidad'); assert.equal(accessEn['access.privacy_link'], 'privacy notice')
  assert.equal(PUBLIC_NAV.find(item => item.label === 'privacy').to, '/privacidad')
  assert.ok(PUBLIC_NAV.every(item => !item.to.includes('#privacidad')))
  assert.equal(accessEs['access.no_payment'], 'Por ahora no hay pago en línea: crear una cuenta no te cobra nada.') // decisión 12870: el texto vigente, no «gratis»
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.doesNotMatch(entry[lang], /Crear una cuenta es gratis|Creating an account is free/, entry.key)
  assert.equal(byKey['landing.access.reset.send'].es, 'Enviar enlace para restablecer la contraseña')
  assert.equal(byKey['landing.access.reset.send'].en, 'Send link to reset your password')
})

test('ES-360 contraseña: el límite de bytes ya no se lista de antemano; se avisa solo si se supera, con palabras comunes (sin «bytes»)', () => {
  const policy = JSON.parse(read('../../shared/registration-password-policy.json'))
  for (const lang of ['es', 'en']) {
    assert.doesNotMatch(policy.message[lang], /bytes/i); assert.doesNotMatch(byKey['landing.access.password_policy'][lang], /bytes/i)
    assert.equal(byKey['landing.access.password_policy'][lang], policy.message[lang]) // el servidor y la pantalla dicen lo mismo
    assert.doesNotMatch(byKey['landing.access.pw.too_long'][lang], /bytes/i); assert.doesNotMatch(byKey['landing.access.pw.missing.max_bytes'][lang], /bytes/i)
  }
  assert.equal(byKey['landing.access.pw.max_bytes'], undefined)
  const { PasswordRequirements } = requirements
  const draw = (lang, password) => html(createElement(PasswordRequirements, { id: 'pw-req', password, showErrors: false, text: text(lang) }))
  for (const lang of ['es', 'en']) {
    assert.ok(!draw(lang, '').includes(byKey['landing.access.pw.too_long'][lang]), 'vacío: sin aviso')
    assert.ok(!draw(lang, 'Abcdef1!').includes(byKey['landing.access.pw.too_long'][lang]), 'dentro del límite: sin aviso')
    assert.ok(!draw(lang, `Abc1!${'ñ'.repeat(33)}`).includes(byKey['landing.access.pw.too_long'][lang]) || new TextEncoder().encode(`Abc1!${'ñ'.repeat(33)}`).length > 72)
    assert.ok(draw(lang, `Abc1!${'😀'.repeat(20)}`).includes(byKey['landing.access.pw.too_long'][lang]), '30 emojis (más de 72 bytes): con aviso')
    assert.ok(draw(lang, `Abc1!${'ñ'.repeat(40)}`).includes(byKey['landing.access.pw.too_long'][lang]), '40 «ñ» (más de 72 bytes, menos de 72 caracteres): con aviso')
  }
})

test('ES-360 una sola escala de estado: «Disponible» y «En preparación»; lo que está en preparación va en un bloque aparte con su título', () => {
  const draw = (Section, lang) => html(createElement(Section, { text: text(lang) }))
  for (const lang of ['es', 'en']) {
    const available = byKey['landing.status.available'][lang], soon = byKey['landing.status.soon'][lang]
    const features = draw(sections.Features, lang), skill = draw(sections.SkillMap, lang)
    const count = (out, word) => (out.match(new RegExp(`<span class="cg-chip[^"]*">(?:<span aria-hidden="true">[^<]*</span>)?${word}</span>`, 'g')) ?? []).length // solo los chips, no el título del bloque
    assert.equal(count(features, available), 3); assert.equal(count(features, soon), 2) // conversación, diario y brújula / ejercicios y «Tus datos»
    assert.equal(count(skill, available), 1); assert.equal(count(skill, soon), 3) // SkillMap / rutas, experimento, tareas e IA
    for (const out of [features, skill]) { assert.ok(out.includes(byKey['landing.soon.title'][lang])); assert.ok(out.includes(byKey['landing.soon.intro'][lang])) }
  }
  assert.ok(byKey['landing.status.available'].es === 'Disponible' && byKey['landing.status.soon'].es === 'En preparación')
})

test('ES-360 próximo paso (variante B, piloto cerrado): título y texto del piloto, «Crear cuenta» e «Iniciar sesión» con destino real', () => {
  for (const lang of ['es', 'en']) {
    const out = html(createElement(sections.NextStep, { text: text(lang) }))
    assert.ok(out.includes(byKey['landing.next.pilot.title'][lang])); assert.ok(out.includes(byKey['landing.next.pilot.body'][lang]))
    assert.match(out, /href="\/login\?mode=register"/); assert.match(out, /href="\/login"/)
  }
})

test('ES-360 solicitud profesional: título, texto, botón y nota; sin tarjetas, sin «junta», sin plazos ni promesa de acceso', () => {
  for (const lang of ['es', 'en']) {
    const out = html(createElement(sections.Professionals, { text: text(lang), applicationAvailable: true }))
    for (const key of ['title', 'intro', 'cta', 'cta_note']) assert.ok(out.includes(byKey[`landing.pros.${key}`][lang]), key)
    assert.match(out, /href="\/profesionales"/)
    assert.doesNotMatch(out, /\bjunta\b|\bboard\b|credencial|credential|\d+ (días|horas|days|hours)/i)
    assert.ok(!html(createElement(sections.Professionals, { text: text(lang), applicationAvailable: false })).includes('href="/profesionales"'))
  }
  assert.deepEqual(catalog.filter(entry => /^landing\.pros\./.test(entry.key)).map(entry => entry.key).sort(), ['landing.pros.cta', 'landing.pros.cta_note', 'landing.pros.intro', 'landing.pros.title'])
})

test('ES-360 lo retirado ya no existe: planes en la portada, estado del proyecto, «Cómo vincularte», estados por tarjeta, numeración, nota de foto y detalle técnico del mapa', () => {
  const gone = /^landing\.(project|join)\.|^landing\.(features|skillmap|pricing|project|trust|faq|pros|join)\.number$|^landing\.features\.[a-z]+\.status$|^landing\.features\.languages\.|^landing\.skillmap\.(status|connection|capabilities\.|evidence\.|autonomy\.|routes\.(continuity|adjacent|exploratory)\.)|^landing\.pros\.(label|private\.|bridge\.|invitation\.|[1-6]\.)|^landing\.(trust\.coming|faq\.plans)$|^landing\.portada\.(photo|try_empty)$|^landing\.access\.pw\.max_bytes$/
  assert.deepEqual(catalog.filter(entry => gone.test(entry.key)).map(entry => entry.key), [])
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length)
  const tail = read('../src/components/landing/LandingTail.tsx'), page = read('../src/pages/LandingPage.tsx'), body = read('../src/components/portada/PortadaBody.tsx'), sectionsSource = read('../src/components/landing/PortadaSections.tsx')
  for (const source of [tail, page, body, sectionsSource]) {
    assert.doesNotMatch(source, /LandingPlans|PlanCards|usePlans|usePlanRequests|pricing\/|\/api\/pricing|\/api\/plans|fetch\(/) // la portada no lee planes de la base ni hace red
  }
  for (const file of ['LandingOffering', 'LandingJoin', 'LandingProject', 'LandingProfessionals']) assert.throws(() => read(`../src/components/landing/${file}.tsx`), /ENOENT/, file)
  assert.doesNotMatch(read('../src/components/landing/LandingTrustFaq.tsx'), /\/pricing|landing\.faq\.plans|landing\.trust\.coming/)
})

test('ES-360 grafía: «SkillMap» en todo el catálogo, el menú y las etiquetas del editor (nunca «Skill Map»)', () => {
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.doesNotMatch(entry[lang], /Skill Map/, `${entry.key} (${lang})`)
  assert.equal(byKey['landing.nav.skillmap'].es, 'SkillMap'); assert.equal(byKey['landing.nav.skillmap'].en, 'SkillMap')
  assert.equal(byKey['landing.skillmap.label'].es, 'SkillMap')
  assert.doesNotMatch(read('../src/pages/admin/landingLabels.ts'), /Skill Map/)
})

test('ES-360 portada: la promesa dice qué puede hacer la persona y qué paso dar; el mapa no certifica ni predice empleo; sin porcentajes, diagnóstico ni empleabilidad', () => {
  assert.equal(byKey['landing.portada.hero_pre'].es, 'Reconoce lo que sabes hacer a partir de tu'); assert.equal(byKey['landing.portada.hero_em'].es, 'experiencia.')
  assert.equal(byKey['landing.portada.cta_try'].es, 'Probar un ejemplo'); assert.equal(byKey['landing.portada.cta_create'].es, 'Crear cuenta')
  assert.match(byKey['landing.portada.steps_note'].es, /No es una certificación profesional/); assert.match(byKey['landing.skillmap.p3.body'].es, /no certifica tus competencias ni predice si conseguirás empleo/)
  const claims = /diagnóstic|diagnos|trastorno|disorder|terapia de|garantiz|guarantee|empleabilidad|employability|\d+\s?%|asegura(mos)? (que )?(consigas|encontr)/i
  for (const entry of visible.filter(item => /^landing\.(portada|features|skillmap|langs|next|pros|footer)\./.test(item.key))) for (const lang of ['es', 'en']) {
    if (entry.key === 'landing.skillmap.routes.body') continue // dice «Sin porcentajes de empleabilidad ni de reemplazo por IA» (negación aprobada)
    if (entry.key === 'landing.skillmap.p3.body') continue // «no ... predice si conseguirás empleo» (negación)
    if (entry.key === 'landing.footer.notice') continue // «No es terapia» (negación)
    assert.doesNotMatch(entry[lang], claims, `${entry.key} (${lang})`)
  }
})

test('ES-360 bilingüe: cada clave del diseño existe en ES y EN, no vacía, sin mezclar idiomas en los textos nuevos', () => {
  const fresh = ['landing.status.available', 'landing.status.soon', 'landing.portada.cta_try', 'landing.portada.cta_create', 'landing.portada.hero_alt', 'landing.portada.hint_q', 'landing.portada.steps_heading', 'landing.portada.steps_note',
    'landing.features.intro', 'landing.soon.title', 'landing.soon.intro', 'landing.skillmap.intro', 'landing.skillmap.p1.title', 'landing.skillmap.p1.body', 'landing.skillmap.p2.title', 'landing.skillmap.p2.body', 'landing.skillmap.p3.title',
    'landing.skillmap.p3.body', 'landing.langs.title', 'landing.langs.body', 'landing.next.title', 'landing.next.body', 'landing.next.login', 'landing.next.pilot.title', 'landing.next.pilot.body', 'landing.footer.privacy', 'landing.access.pw.too_long']
  for (const key of fresh) { const entry = byKey[key]; assert.ok(entry && entry.es.trim() && entry.en.trim(), key); assert.notEqual(entry.es, entry.en, `${key}: ES y EN no pueden ser idénticos`) }
  for (const key of fresh.filter(item => !['landing.status.available'].includes(item))) assert.doesNotMatch(byKey[key].en, /[áéíóúñ¿¡]/i, `${key}: el inglés no lleva español`)
})

test('ES-360 (diseño 12871) hojas de vida y diario: sin «solo tú» ni «solo para ti»; dicen qué se cifra y qué profesional no llega sin autorización', () => {
  const resume = read('../src/context/resume/resumeCopy.ts'), journal = read('../src/space/journalCopy.ts')
  const only = /solo tú|solo para ti|only you|only for you|just for you/i
  assert.doesNotMatch(resume, only); assert.doesNotMatch(journal, only)
  for (const phrase of ['Al proveedor de IA solo llega texto', 'Tu hoja de vida quedó guardada y cifrada.', 'No llegan a ningún profesional sin tu autorización aparte.', 'Only text reaches the AI provider', 'Your résumé was saved and encrypted.', 'They do not reach any professional without your separate permission.']) assert.ok(resume.includes(phrase), phrase)
  assert.ok(journal.includes('Privado · Tú decides si el asistente lo usa') && journal.includes('Private · You decide whether the assistant uses it'))
})

test('ES-360 sin planes públicos: /pricing redirige a la portada, ya no existen PricingPage/LandingPlans/PlanCards ni textos de planes (solo el período que exige el servidor)', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /<Route path="\/pricing" element=\{<Navigate to="\/" replace \/>\} \/>/); assert.doesNotMatch(app, /PricingPage/)
  for (const file of ['pages/PricingPage.tsx', 'components/landing/LandingPlans.tsx', 'components/landing/PlanCards.tsx', 'pricing/pricing.css']) assert.throws(() => read('../src/' + file), /ENOENT/, file)
  assert.deepEqual(catalog.filter(entry => /^landing\.pricing\./.test(entry.key)).map(entry => entry.key).sort(), ['landing.pricing.period.month', 'landing.pricing.period.year'])
  assert.equal(byKey['landing.nav.plans'], undefined)
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.doesNotMatch(entry[lang], /cambia de plan|change plans|plan de prueba|solicitar este plan|request this plan/i, entry.key)
})

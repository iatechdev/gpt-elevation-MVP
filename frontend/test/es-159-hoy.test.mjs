// ES-159 (P08): «Hoy» (check-in) y «Tu punto de partida» (onboarding) con Cartografía en el marco de persona.
// Lógica pura (escala 1–5, guardado y errores, servicios de ayuda) + estructura (sin emojis, sin estilos en línea, sin números escritos, claves ES/EN);
// el comportamiento, el teclado y axe los mide scripts/es159-check.cjs en navegador, y el servidor real scripts/es159-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMood, MOOD_VALUES, needsSupport, saveMood } from '../src/checkin/moodLogic.ts'
import { countryFor, DEFAULT_COUNTRY, loadContactEntries } from '../src/checkin/contactEntries.ts'
import { checkinEn, checkinEs } from '../src/checkin/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const reply = (status, body = {}) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })

test('ES-159: la escala es 1–5 (el servidor rechaza 0): cinco valores, ninguno fuera de rango', () => {
  assert.deepEqual([...MOOD_VALUES], [1, 2, 3, 4, 5])
  for (const bad of [0, 6, -1, 1.5, '3', null, undefined, NaN]) assert.equal(isMood(bad), false, String(bad))
  for (const good of MOOD_VALUES) assert.equal(isMood(good), true)
})

test('ES-159: el aviso de apoyo aparece solo con «Cargado» (1) y «Bajo» (2)', () => {
  assert.deepEqual(MOOD_VALUES.filter(value => needsSupport(value)), [1, 2])
  assert.equal(needsSupport(null), false)
})

test('ES-159: guardar envía mood 1–5 con el token y distingue ok / sesión vencida / error; una respuesta no-2xx NUNCA es éxito', async () => {
  const calls = []
  const request = status => async (url, init) => { calls.push({ url, init }); return { ok: status >= 200 && status < 300, status } }
  assert.equal(await saveMood(1, 'tok', request(200)), 'ok')
  assert.equal(calls[0].url.endsWith('/api/mood/checkin'), true)
  assert.equal(calls[0].init.method, 'POST'); assert.equal(calls[0].init.headers.Authorization, 'Bearer tok')
  assert.deepEqual(JSON.parse(calls[0].init.body), { mood: 1 })
  assert.equal(await saveMood(5, 'tok', request(400)), 'error') // antes: 400 ignorado y la pantalla seguía como si hubiera guardado
  assert.equal(await saveMood(3, 'tok', request(500)), 'error')
  assert.equal(await saveMood(3, 'tok', request(401)), 'expired')
  assert.equal(await saveMood(3, 'tok', request(403)), 'expired')
  assert.equal(await saveMood(3, 'tok', async () => { throw new TypeError('red') }), 'error')
})

test('ES-159: el país de los servicios de ayuda es el de residencia (dos letras) o el predeterminado', () => {
  assert.equal(countryFor('dk'), 'DK'); assert.equal(countryFor('CO'), 'CO')
  for (const bad of [null, undefined, '', 'COL', '1', 'C']) assert.equal(countryFor(bad), DEFAULT_COUNTRY, String(bad))
})

test('ES-159: los servicios de ayuda salen de la lista del servidor; sin entradas = lista vacía (sin número inventado); error = excepción', async () => {
  const entry = { id: 1, country: 'CO', name: 'Servicio de prueba', contact: 'dato-de-prueba', description: { es: 'a', en: 'b' } }
  assert.deepEqual(await loadContactEntries('CO', undefined, reply(200, { entries: [entry, { id: 2 }, null, 'x'] })), [entry]) // descarta formas inválidas
  assert.deepEqual(await loadContactEntries('CO', undefined, reply(200, { entries: [] })), [])
  await assert.rejects(loadContactEntries('CO', undefined, reply(500)))
  await assert.rejects(loadContactEntries('CO', undefined, reply(200, { nada: 1 })))
  let asked = ''
  await loadContactEntries('xxx', undefined, async url => { asked = url; return reply(200, { entries: [] })() })
  assert.ok(asked.endsWith('/api/contact-entries?country=CO'), asked) // país inválido → predeterminado
})

test('ES-159: Hoy sin emojis, sin estilos en línea, sin fondo animado, sin números escritos y con las dos lenguas completas', () => {
  const files = ['../src/pages/CheckinPage.tsx', '../src/checkin/MoodScale.tsx', '../src/checkin/SupportNotice.tsx', '../src/checkin/copy.ts']
  for (const file of files) {
    const src = read(file)
    assert.ok(!src.includes('style={{'), `${file} sin estilos en línea`)
    assert.ok(!/\p{Extended_Pictographic}/u.test(src), `${file} sin emojis`)
    assert.ok(!src.includes('BreathingBackground'), `${file} sin fondo animado`)
    assert.ok(!/lang === 'es' \?/.test(src), `${file} sin textos decididos por idioma`)
    assert.ok(!/\d{3,}/.test(src.replace(/\d+(rem|px|em)|\/\*[\s\S]*?\*\/|\/\/[^\n]*|ES-\d+|\.\.\/|[\d.]+\)/g, '')), `${file} sin números de teléfono escritos`)
  }
  assert.deepEqual(Object.keys(checkinEs).sort(), Object.keys(checkinEn).sort())
  for (const [key, value] of [...Object.entries(checkinEs), ...Object.entries(checkinEn)]) assert.ok(value.trim().length > 0, key)
  assert.ok(read('../src/pages/CheckinPage.tsx').includes('<PersonFrame migrated>'))
})

test('ES-159: Hoy usa el marco de persona, no deja la pantalla sin salida y no dobla el envío', () => {
  const page = read('../src/pages/CheckinPage.tsx')
  assert.ok(page.includes('sending.current'), 'ignora un segundo envío mientras guarda')
  assert.ok(page.includes("result === 'error'") && page.includes("result === 'expired'") && page.includes('invalidateStoredSession(token)'))
  assert.ok(page.includes('goChat') && page.includes('checkin.go_without_saving') && page.includes('checkin.skip'), 'se puede pasar a la conversación sin guardar')
  assert.ok(!page.includes('elevation_checkin_mood'), 'ya no guarda el ánimo en el almacenamiento local')
})

test('ES-159: el punto de partida va en el marco de persona con el tema de Cartografía y conserva su lógica de borrador, conflicto y salida', () => {
  const form = read('../src/context/ParticipantContextForm.tsx')
  assert.ok(form.includes('<PersonFrame migrated><OnboardingContent /></PersonFrame>'))
  assert.ok(form.includes('participant-context-scope cg-onboarding'))
  assert.ok(!/<main[ >]/.test(form) && !form.includes('context-header'), 'el encabezado y el <main> los pone el marco')
  for (const piece of ['beforeunload', 'registerContextNavigationGuard', "error.status === 409", 'setLostDraft(true)', "'save_draft'", 'expectedVersion']) assert.ok(form.includes(piece), piece)
  const css = read('../src/context/onboardingCartografia.css')
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(css), 'la hoja de Cartografía no trae colores fijos: todo sale de --cg-*')
})

test('ES-159 (E264-1): el texto de privacidad es verdadero: no afirma que solo la persona (ni «nadie más») lo ve; nombra al profesional autorizado, al equipo de la plataforma y a la IA', () => {
  const both = checkinEs['checkin.intro'] + checkinEn['checkin.intro']
  assert.ok(!/solo t[úu] ves|only you see|nadie más|no one else/i.test(both), 'sin promesas absolutas')
  assert.match(checkinEs['checkin.intro'], /autorizaste compartir con tu profesional, también lo ve. Tu promedio de ánimo puede verlo el equipo de la plataforma y se usa, con apoyo de IA, para generar tus recomendaciones/)
  assert.match(checkinEn['checkin.intro'], /allowed sharing with your professional, they can too. Your average mood can be seen by the platform team and is used, with AI support, to generate your recommendations/)
})

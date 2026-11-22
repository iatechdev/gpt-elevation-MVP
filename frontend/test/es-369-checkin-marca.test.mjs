// ES-369 (QA-424-1/2): la marca del check-in es de UNA persona y de UN día en la zona de la persona; el almacenamiento bloqueado no rompe nada.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CHECKIN_MARK_KEY, LEGACY_CHECKIN_KEY, PERSON_ZONE_KEY, checkinDone, markCheckin, personIdFromToken, personToday, rememberZone, rememberedZone } from '../src/checkin/checkinMark.ts'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const tokenOf = id => `h.${b64({ id, name: 'Ana', role: 'user' })}.s`
const makeStore = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, String(value)) }, removeItem: key => { map.delete(key) }, map } }
const blocked = { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('SecurityError') }, removeItem() { throw new Error('SecurityError') } }

test('ES-369: el id de la persona sale del token; tokens raros no dan id', () => {
  assert.equal(personIdFromToken(tokenOf(7)), '7'); assert.equal(personIdFromToken(tokenOf('42')), '42')
  for (const bad of ['', 'abc', 'a.b.c', 'a..c', tokenOf(-1.5), tokenOf('x1'), tokenOf(null), `h.${b64([1])}.s`]) assert.equal(personIdFromToken(bad), null, bad)
})

test('ES-369 (QA-424-1): otra persona en el mismo navegador NO ve «ya registrado»', () => {
  const store = makeStore(); const now = new Date('2026-11-21T15:00:00Z')
  markCheckin(tokenOf(1), now, store)
  assert.equal(checkinDone(tokenOf(1), now, store), true)
  assert.equal(checkinDone(tokenOf(2), now, store), false, 'persona B con la marca de A')
  assert.equal(checkinDone('', now, store), false, 'sin token')
  assert.equal(checkinDone(tokenOf(1), new Date('2026-11-22T15:00:00Z'), store), false, 'otro día')
})

test('ES-369 (QA-424-1): el día es el de la ZONA de la persona (#411), no el del navegador', () => {
  const store = makeStore(); const token = tokenOf(1)
  rememberZone(token, 'America/Bogota', store); assert.equal(rememberedZone(token, store), 'America/Bogota'); assert.equal(rememberedZone(tokenOf(2), store), null, 'la zona es de su persona')
  const evening = new Date('2026-11-21T03:00:00Z') // 22:00 del 20 en Bogotá; ya es 21 en UTC
  assert.equal(personToday(token, evening, store), '2026-11-20')
  markCheckin(token, evening, store)
  assert.equal(checkinDone(token, new Date('2026-11-21T04:30:00Z'), store), true, 'a las 23:30 locales del mismo día sigue marcado')
  assert.equal(checkinDone(token, new Date('2026-11-21T05:00:00Z'), store), false, 'a medianoche de Bogotá cambia el día')
  assert.equal(personToday(token, evening, makeStore()), '2026-11-20', 'sin zona recordada, el respaldo es America/Bogota (como el servidor), no UTC')
  rememberZone(token, 'Zona/Inventada', store); assert.equal(personToday(token, evening, store), '2026-11-21', 'una zona que el navegador no conoce cae a UTC sin lanzar')
})

test('ES-369 (QA-432-1): sin zona recordada (registro desde Hoy o CheckinPage) la marca sigue vigente de 19:00 a 23:59 de Bogotá y cambia a medianoche', () => {
  for (const [label, store] of [['Hoy/CheckinPage sin zona', makeStore()], ['con la zona ya recordada', (() => { const s = makeStore(); rememberZone(tokenOf(1), 'America/Bogota', s); return s })()]]) {
    for (const utc of ['2026-11-21T00:00:00Z', '2026-11-21T02:59:00Z', '2026-11-21T04:59:00Z']) { // 19:00, 21:59 y 23:59 del día 20 en Bogotá
      const at = new Date(utc); markCheckin(tokenOf(1), at, store)
      assert.equal(checkinDone(tokenOf(1), at, store), true, `${label}: ${utc} marca y lee el mismo día`)
      assert.equal(checkinDone(tokenOf(1), new Date('2026-11-21T04:59:59Z'), store), true, `${label}: sigue vigente hasta las 23:59:59 locales`)
      assert.equal(checkinDone(tokenOf(1), new Date('2026-11-21T05:00:00Z'), store), false, `${label}: cambia a medianoche local, no antes ni después`)
    }
  }
})

test('ES-369 (QA-424-2): con el almacenamiento bloqueado nada lanza y no hay marca', () => {
  const token = tokenOf(1); const now = new Date()
  assert.doesNotThrow(() => { markCheckin(token, now, blocked); rememberZone(token, 'America/Bogota', blocked) })
  assert.equal(checkinDone(token, now, blocked), false); assert.equal(rememberedZone(token, blocked), null)
  assert.equal(checkinDone(token, now, null), false); assert.doesNotThrow(() => markCheckin(token, now, null))
  const store = makeStore({ [CHECKIN_MARK_KEY]: '{no es json', [PERSON_ZONE_KEY]: '[]' }); assert.equal(checkinDone(token, now, store), false)
})

test('ES-369: la marca vieja (fecha suelta) ya no vale; las pantallas usan el módulo y cerrar sesión borra las tres claves', () => {
  const store = makeStore({ [LEGACY_CHECKIN_KEY]: new Date().toDateString() }); assert.equal(checkinDone(tokenOf(1), new Date(), store), false)
  const dash = read('../src/pages/UserDashboard.tsx'), checkin = read('../src/pages/CheckinPage.tsx'), out = read('../src/access/signOut.ts')
  for (const source of [dash, checkin]) assert.doesNotMatch(source, /elevation_checkin_date|toDateString\(\)/)
  assert.match(dash, /useState\(\(\) => checkinDone\(getToken\(\)\)\)/); assert.match(dash, /rememberZone\(getToken\(\), zone\)/); assert.match(dash, /markCheckin\(getToken\(\)\)/)
  assert.match(dash, /const getToken = \(\) => \{ try \{ return localStorage\.getItem\('elevation_token'\) \?\? '' \} catch \{ return '' \} \}/)
  assert.match(checkin, /markCheckin\(readStoredToken\(\)\)/)
  assert.match(out, /SESSION_KEYS = \['elevation_token', 'elevation_role', 'elevation_name', LEGACY_CHECKIN_KEY, CHECKIN_MARK_KEY, PERSON_ZONE_KEY\]/)
})

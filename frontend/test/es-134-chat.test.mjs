// ES-134: aviso de límite con alcance y fecha, avisos que siguen al idioma y envío sin confirmar que sobrevive a navegar y recargar.
process.env.TZ = 'America/Bogota' // la fecha de reinicio se muestra en la zona de la persona
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SpaceError, makeIntent } from '../src/space/api.ts'
import { isAlert, noticeForError, noticeText } from '../src/space/notices.ts'
import { clearPending, loadPending, savePending } from '../src/space/pending.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const RESET = '2026-11-01T00:00:00.000Z'
const TOKEN = 'header.payload.signature-abcdefghijklmnopqrstuvwxyz0123'
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }

test('ES-134: con el cupo del grupo agotado el aviso dice «grupo» y la fecha de reinicio, en ES y EN', () => {
  const notice = noticeForError(new SpaceError(429, 'ai_budget_exhausted', false, 'cohort', RESET))
  const es = noticeText(notice, 'es'); const en = noticeText(notice, 'en')
  assert.match(es, /grupo/); assert.match(es, /31 de octubre/); assert.match(es, /no se envió/)
  assert.match(en, /group/); assert.match(en, /October 31|31 October/); assert.match(en, /not sent/)
  assert.doesNotMatch(es, /tu cuenta\.\s/); assert.doesNotMatch(en, /your account’s AI limit/)
  assert.equal(isAlert(notice), true)
})

test('ES-134: con el límite de la persona el aviso habla de su cuenta; sin fecha no inventa una; sin alcance no atribuye el límite', () => {
  const person = noticeText(noticeForError(new SpaceError(429, 'ai_budget_exhausted', false, 'person', RESET)), 'es')
  assert.match(person, /tu cuenta/); assert.match(person, /31 de octubre/)
  const noDate = noticeText(noticeForError(new SpaceError(429, 'ai_budget_exhausted', false, 'cohort', '')), 'en')
  assert.match(noDate, /group/); assert.match(noDate, /Once it renews/); assert.doesNotMatch(noDate, /\d{4}/)
  const badDate = noticeText({ k: 'budget', scope: 'person', resetsAt: 'no-es-fecha' }, 'es')
  assert.match(badDate, /Cuando se renueve/)
  assert.equal(noticeText(noticeForError(new SpaceError(429, 'ai_budget_exhausted', false, '', RESET)), 'es'), noticeText({ k: 'budgetGeneric' }, 'es'))
})

test('ES-134: cada error HTTP produce un aviso en el idioma activo y cambiar de idioma después del error cambia el texto', () => {
  const errors = [
    new SpaceError(401), new SpaceError(429, 'ai_budget_exhausted', false, 'cohort', RESET), new SpaceError(429, 'ai_budget_exhausted', false, 'person', RESET),
    new SpaceError(429, 'ai_budget_exhausted', false, 'cohort', ''), new SpaceError(503, 'ai_budget_not_configured'), new SpaceError(502),
    new SpaceError(409, 'turn_in_progress'), new SpaceError(500, '', true), new TypeError('Failed to fetch'),
  ]
  for (const error of errors) {
    const notice = noticeForError(error)
    const es = noticeText(notice, 'es'); const en = noticeText(notice, 'en')
    assert.ok(es && en && es !== en, JSON.stringify(notice))
    assert.doesNotMatch(en, /No pudimos|Conservamos|Llegaste|Tu mensaje|El envío|se conserva/, en)
    assert.doesNotMatch(es, /We could not|Your message|You reached|The message/, es)
  }
  for (const k of ['sendError', 'pending', 'loadError', 'contextChanged', 'confirmed', 'restored']) {
    assert.notEqual(noticeText({ k }, 'es'), noticeText({ k }, 'en'), k)
  }
})

test('ES-134: el aviso del chat se guarda como clave, no como texto ya traducido, y el de límite se anuncia como alerta', () => {
  const hook = read('../src/space/usePersonalChat.ts')
  assert.doesNotMatch(hook, /setNotice\(c\./); assert.doesNotMatch(hook, /fail\(error, c\./)
  assert.match(read('../src/space/ChatControls.tsx'), /role=\{chat\.alert \? 'alert' : 'status'\}/)
})

test('ES-134: el envío sin confirmar se guarda, se restaura con el mismo requestId y se borra al confirmar', () => {
  const store = memory()
  const intent = makeIntent('Quiero hablar de mi semana', 'es', [4, 9], 'req-12345678', 'compass')
  savePending(TOKEN, intent, store)
  const restored = loadPending(TOKEN, store)
  assert.deepEqual({ ...restored }, { ...intent })
  assert.equal(restored.requestId, 'req-12345678')
  clearPending(store)
  assert.equal(loadPending(TOKEN, store), null)
})

test('ES-134: otra sesión o cuenta no recupera el envío ajeno, y el almacenamiento dañado se descarta', () => {
  const store = memory()
  savePending(TOKEN, makeIntent('Mensaje privado', 'en', [], 'req-abcdefgh'), store)
  assert.equal(loadPending('otro.token.de-otra-cuenta-ZZZZZZZZZZZZZZZZZZZZZZ', store), null)
  assert.equal(store.getItem('elevation_pending_chat'), null)
  savePending(TOKEN, makeIntent('Mensaje privado', 'en', [], 'req-abcdefgh'), store)
  assert.equal(loadPending('', store), null)
  store.setItem('elevation_pending_chat', '{no es json')
  assert.equal(loadPending(TOKEN, store), null)
  store.setItem('elevation_pending_chat', JSON.stringify({ t: TOKEN.slice(-24), message: 'x', lang: 'es', requestId: '!!', ids: [] }))
  assert.equal(loadPending(TOKEN, store), null)
})

test('ES-134: el chat restaura el pendiente al montar y lo persiste o borra según el estado', () => {
  const hook = read('../src/space/usePersonalChat.ts')
  assert.match(hook, /useState<Intent \| null>\(\(\) => \(token \? loadPending\(token\) : null\)\)/)
  assert.match(hook, /savePending\(token, intent\); else clearPending\(\)/)
  assert.match(hook, /\{ k: 'restored' \}/)
})

// QA-134-01: el mensaje pendiente es privado y no sobrevive al cierre de sesión, en ningún sitio donde se retiran las claves de sesión.
test('ES-134: invalidar la sesión borra el mensaje pendiente y la huella no guarda ningún fragmento del token', async () => {
  const session = memory(); globalThis.sessionStorage = session
  const local = memory(); local.setItem('elevation_token', TOKEN); globalThis.localStorage = local
  globalThis.window = { dispatchEvent() {} }; globalThis.Event = class { constructor(type) { this.type = type } }
  savePending(TOKEN, makeIntent('Texto privado del mensaje', 'es', [], 'req-privado1'))
  const raw = session.getItem('elevation_pending_chat')
  assert.ok(raw.includes('Texto privado del mensaje'))
  for (let i = 0; i + 8 <= TOKEN.length; i++) assert.ok(!JSON.stringify(JSON.parse(raw).t).includes(TOKEN.slice(i, i + 8)), 'fragmento del token ' + i)
  const { invalidateStoredSession } = await import('../src/access/session.ts')
  invalidateStoredSession(TOKEN)
  assert.equal(session.getItem('elevation_pending_chat'), null)
  assert.equal(local.getItem('elevation_token'), null)
})

test('ES-134: todos los cierres de sesión de la aplicación limpian el mensaje pendiente', () => {
  // ES-136: administración, junta, terapeuta y dashboard cierran con signOut(), que limpia el pendiente antes de borrar el token; el chat conserva su cierre.
  const out = read('../src/access/signOut.ts')
  assert.ok(out.includes('clearPending()') && out.indexOf('clearPending()') < out.indexOf('localStorage.removeItem(key)'))
  for (const file of ['../src/layouts/AdminLayout.tsx', '../src/layouts/BoardLayout.tsx', '../src/layouts/TherapistLayout.tsx', '../src/pages/UserDashboard.tsx'])
    assert.ok(read(file).includes('SessionControl') && !read(file).includes("localStorage.removeItem('elevation_token')"), file)
  for (const file of ['../src/pages/ChatPage.tsx']) {
    const source = read(file)
    const removals = source.match(/localStorage\.removeItem\('elevation_token'\)/g) ?? []
    const cleared = source.match(/clearPending\(\)[^\n]*\n\s*localStorage\.removeItem\('elevation_token'\)|clearPending\(\); localStorage\.removeItem\('elevation_token'\)/g) ?? []
    assert.ok(removals.length > 0 && cleared.length === removals.length, `${file}: ${cleared.length}/${removals.length}`)
  }
})

test('ES-134: el aviso de límite recibe el foco al aparecer y solo ese aviso es enfocable', () => {
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /useEffect\(\(\) => \{ if \(chat\.alert && chat\.notice\) status\.current\?\.focus\(\) \}, \[chat\.alert, chat\.notice\]\)/)
  assert.match(controls, /tabIndex=\{chat\.alert \? -1 : undefined\}/)
  assert.ok(controls.indexOf('status.current?.focus()') < controls.indexOf('if (chat.expired) return null', controls.indexOf('export function ChatInput')), 'el efecto va antes del retorno anticipado (reglas de hooks)')
})

// QA M2: la barra «Uso de IA» y el aviso de límite muestran la misma fecha de reinicio (una sola función, hora local de la persona).
test('ES-134: la barra de uso y el aviso de límite dicen el mismo día de reinicio, en cualquier zona horaria', async () => {
  const { renewalDate } = await import('../src/space/usage.ts')
  for (const tz of ['America/Bogota', 'UTC', 'Asia/Tokyo', 'Europe/Madrid']) {
    process.env.TZ = tz
    for (const iso of ['2026-12-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', '2026-11-30T23:30:00.000Z']) for (const lang of ['es', 'en']) {
      const date = renewalDate(iso, lang)
      assert.ok(noticeText({ k: 'budget', scope: 'cohort', resetsAt: iso }, lang).includes(date), `${tz} ${iso} ${lang}: ${date}`)
    }
  }
  process.env.TZ = 'America/Bogota'
  assert.match(renewalDate('2026-12-01T00:00:00.000Z', 'es'), /30 de noviembre/)
  assert.match(read('../src/space/notices.ts'), /renewalDate\(notice\.resetsAt, lang\)/)
})

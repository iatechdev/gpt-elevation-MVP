// ES-148 · Lee (solo lectura, sin IA) el historial de chat de la persona sintética con la sesión guardada y lo resume en docs/ux/capturas/chat-real/transcripcion.json.
// Uso: node scripts/leer-historial-chat.mjs <n turnos finales>   (usa e2e/.auth/USER.json; no necesita credenciales)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const state = JSON.parse(readFileSync(join(here, '..', '.auth', 'USER.json'), 'utf8'))
const token = state.origins.flatMap((o) => o.localStorage).find((i) => i.name === 'elevation_token')?.value
if (!token) throw new Error('Sin sesión guardada de persona.')
const base = process.env.E2E_BASE_URL ?? 'https://backend-staging-e3a6.up.railway.app'
if (!/^https:\/\/backend-staging-[a-z0-9-]+\.up\.railway\.app$/.test(base)) throw new Error('Solo staging.')
const res = await fetch(`${base}/api/messages`, { headers: { Authorization: `Bearer ${token}` } })
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const rows = await res.json()
const n = Number(process.argv[2] ?? 8)
const last = rows.slice(-n)
const turns = last.map((m) => {
  const text = String(m.text ?? m.content ?? m.message ?? '')
  const role = m.role ?? (m.sender === 'user' ? 'user' : 'bot')
  return {
    rol: role, caracteres: text.length, parrafos: text.split(/\n{2,}/).length, preguntas: (text.match(/\?/g) ?? []).length,
    markdownCrudo: /(\*\*|__|^#{1,3}\s|^\s*[-*]\s|^\s*\d+\.\s)/m.test(text), texto: text,
  }
})
writeFileSync(join(here, '..', '..', 'docs', 'ux', 'capturas', 'chat-real', 'transcripcion.json'), JSON.stringify({ nota: 'Mensajes de prueba inocuos de una cuenta sintética de staging. Sin datos personales.', turnos: turns }, null, 1))
console.log('turnos guardados:', turns.length, 'claves del primero:', Object.keys(last[0] ?? {}).join(','))

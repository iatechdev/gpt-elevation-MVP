// ES-148 · Lanzador: lee el archivo LOCAL de cuentas sintéticas y las pasa a Playwright SOLO como variables de entorno del proceso hijo.
// Uso: node scripts/con-credenciales.mjs "<ruta del archivo>" npx playwright test tests/auditoria.spec.ts
// Nunca imprime ni guarda los valores. Formato esperado por línea: "<rol> <correo> clave: <clave>".
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const [file, ...cmd] = process.argv.slice(2)
if (!file || cmd.length === 0) { console.error('Uso: con-credenciales.mjs <archivo> <comando...>'); process.exit(2) }
const env = { ...process.env }
const roles = { user: 'USER', therapist: 'THERAPIST', admin: 'ADMIN', superadmin: 'SUPERADMIN' }
let found = 0
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(user|therapist|admin|superadmin)\s+(\S+@\S+)\s+clave:\s*(\S+)\s*$/i)
  if (!m) continue
  const r = roles[m[1].toLowerCase()]
  env[`E2E_${r}_EMAIL`] = m[2]; env[`E2E_${r}_PASSWORD`] = m[3]; found++
}
console.error(`[lanzador] cuentas cargadas: ${found} (valores no mostrados)`)
const child = spawn(cmd[0], cmd.slice(1), { env, stdio: 'inherit', shell: true })
child.on('exit', (c) => process.exit(c ?? 1))

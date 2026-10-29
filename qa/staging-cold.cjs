// QA-Claude-2 — ST-2 arranque en frío en staging. Espera IDLE_MIN minutos SIN tráfico propio y mide la primera petición
// a /api/health, /api/login (credenciales falsas → 401) y la SPA, y luego 5 repeticiones "en caliente" como línea base.
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const idle = Number(process.env.IDLE_MIN || 11)
const time = async (m, p, b) => { const s = performance.now(); const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined, signal: AbortSignal.timeout(60000) }); await r.text(); return { s: r.status, ms: performance.now() - s } }
;(async () => {
  console.log(`inicio ${new Date().toISOString()}; espero ${idle} min sin tráfico…`); await new Promise(r => setTimeout(r, idle * 60000))
  const fake = { email: 'no-existe-cold@example.test', password: 'Falsa-1234-x' }
  const first = { health: await time('GET', '/api/health'), login: await time('POST', '/api/login', fake), spa: await time('GET', '/') }
  console.log(`PRIMERA petición tras ${idle} min de inactividad propia (${new Date().toISOString()}): health ${first.health.s} ${first.health.ms.toFixed(0)} ms · login(401 esperado) ${first.login.s} ${first.login.ms.toFixed(0)} ms · SPA ${first.spa.s} ${first.spa.ms.toFixed(0)} ms`)
  const warm = []; for (let i = 0; i < 5; i++) warm.push((await time('GET', '/api/health')).ms)
  const lw = []; for (let i = 0; i < 2; i++) lw.push((await time('POST', '/api/login', fake)).ms)
  const med = [...warm].sort((a, b) => a - b)[2]
  console.log(`en caliente: health mediana ${med.toFixed(0)} ms (${warm.map(x => x.toFixed(0)).join('/')}) · login ${lw.map(x => x.toFixed(0)).join('/')} ms`)
  const ok = first.health.ms <= 5000 && first.login.ms <= 5000
  console.log(`primer health / mediana caliente = ${(first.health.ms / med).toFixed(1)}×; umbral propuesto: primera respuesta ≤ 5 s → ${ok ? 'CUMPLE' : 'NO CUMPLE'}`); console.log(first.health.ms > 3 * med + 300 ? 'Se observa sobrecoste de arranque en frío.' : 'No se observa sobrecoste de arranque en frío (servicio siempre activo o recuperación inmediata).')
  console.log('FIN')
})()

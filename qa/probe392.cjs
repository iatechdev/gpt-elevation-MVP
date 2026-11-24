// [QA-Claude-3] sonda de #392: ¿qué pasa al registrar tras cerrar sesión? (solo qa/)
const L = require('./lib3.cjs'); const { mk, open, sleep } = L
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve()
  const U = await mk('user', 'Cierre Sintético'); const p = await open(U, { lang: 'es', url: '/login?mode=register', wait: 2200 })
  p.on('response', async r => { if (r.url().includes('/api/register')) console.log('REG', r.status(), (await r.text()).slice(0, 200)) })
  if (process.env.SIGNOUT !== '0') { await p.getByRole('button', { name: /Cerrar sesión para crear/ }).click(); await sleep(2500) }
  const email = `qa3-392p-${Date.now()}@example.test`; await p.fill('#access-name', 'Nueva Sintética'); await p.fill('#access-email', email); await p.fill('#access-password', L.PASS)
  const cbs = await p.locator('input[type=checkbox]').count(); console.log('checkboxes', cbs); if (cbs) await p.locator('input[type=checkbox]').first().check()
  await p.locator('form button[type=submit]').first().click(); await sleep(3500)
  console.log('ruta', await p.evaluate(() => location.pathname + location.search), '|', (await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 400))
  await L.done(); srv?.close?.(); process.exit(0)
})()

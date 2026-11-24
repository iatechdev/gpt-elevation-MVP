const L = require('./qa5-lib.cjs'); const { mk, open, call, sleep, dbq } = L
;(async () => { await L.DB.connect(); await L.launch(); const srv = await L.serve()
  const S = await mk('superadmin', 'S'); const U = await mk('user', 'U')
  const r = await call('POST', '/api/admin/pricing', S.token, { slug: 'pb' + Date.now().toString(36).slice(-5), name_es: 'a', name_en: 'b', price: '1', currency: 'USD', period: 'month', features_es: [], features_en: [], isHighlighted: false, isActive: true, order: 1 }); const id = r.j.plan?.id ?? r.j.id
  for (const mut of [{ price: 'abc' }, { name_es: '' }, { order: -3 }, { currency: 'JPY' }]) { const w = await call('PUT', '/api/admin/pricing/' + id, S.token, { name_es: 'a', name_en: 'b', price: '1', currency: 'USD', period: 'month', features_es: [], features_en: [], isHighlighted: false, isActive: true, order: 1, ...mut }); console.log(JSON.stringify(mut), w.s, w.tx.slice(0, 200)) }
  const p = await open(U, { lang: 'es', url: '/admin/content', wait: 2000 }); console.log('user ruta', await p.evaluate(() => location.pathname), (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200))
  await L.done(); srv.close(); process.exit(0) })()

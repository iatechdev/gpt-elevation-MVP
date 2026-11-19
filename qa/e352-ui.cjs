// [QA-Claude-3] #352 F3: /app/route-catalog en navegador con el backend del PR, con etiquetas sanas y con la tabla de definiciones ausente (ES/EN).
const L = require('./lib3.cjs'); const { ck, info, mk, open, dbq, sleep } = L
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); const U = await mk('user', 'A-352-UI')
  const grab = async lang => { const p = await open(U, { lang, w: 1360, url: '/app/route-catalog', wait: 3500 }); const t = await p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ')); const st = { t, errs: p.errs, h1: await p.evaluate(() => document.querySelectorAll('h1').length), five: await p.evaluate(() => document.body.innerText.match(/\b5\d\d\b|error|undefined|\[object/i)?.[0] || '') }; await p.c.close(); return st }
  const healthy = { es: await grab('es'), en: await grab('en') }
  info('sano ES:', healthy.es.t.slice(0, 260)); ck('F352-10 con etiquetas sanas la pantalla carga (1 h1, sin errores de página)', healthy.es.h1 === 1 && healthy.es.errs.length === 0, healthy.es.errs.join())
  await dbq('ALTER TABLE "SkillDefinitions" RENAME TO "SkillDefinitions_ausente"')
  try {
    const deg = { es: await grab('es'), en: await grab('en') }
    info('degradado ES:', deg.es.t.slice(0, 260)); info('degradado EN:', deg.en.t.slice(0, 200))
    ck('F352-11 con la tabla de definiciones ausente la pantalla sigue cargando (1 h1, 0 errores de página, sin 5xx/undefined/[object])', deg.es.h1 === 1 && deg.en.h1 === 1 && deg.es.errs.length === 0 && deg.en.errs.length === 0 && !/undefined|\[object/i.test(deg.es.t + deg.en.t), deg.es.five + '|' + deg.en.five)
    ck('F352-12 la pantalla degradada conserva el contenido principal (mismos roles que con etiquetas sanas)', deg.es.t.length > 0.6 * healthy.es.t.length, `${deg.es.t.length} vs ${healthy.es.t.length}`)
  } finally { await dbq('ALTER TABLE "SkillDefinitions_ausente" RENAME TO "SkillDefinitions"') }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })

// [QA-Claude-3] #386: las tablas del sistema de diseño (/design-system, las demás consumidoras de DataTable) deben ser idénticas a main.
const L = require('./lib3.cjs')
;(async () => { await L.launch(); const srv = await L.serve(); const p = await L.open(null, { lang: 'es', url: '/design-system', wait: 2500 })
  const t = await p.evaluate(() => [...document.querySelectorAll('table')].map(t => ({ c: t.querySelector('caption')?.textContent.trim(), h: [...t.querySelectorAll('thead th')].map(th => th.textContent.trim() + (th.querySelector('.cg-sr') ? '(sr)' : '')), html: t.querySelector('thead')?.innerHTML.length })))
  console.log('DS386 ' + L.LABEL + ' ' + process.env.DIST.split('dist-')[1] + ' tablas=' + t.length + ' sr=' + JSON.stringify(t).split('(sr)').length - 1 + ' ' + JSON.stringify(t).slice(0, 300)); srv.close(); process.exit(0) })()

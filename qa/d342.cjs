// [QA-Claude-3] Vuelca el texto de <main> de la portada en dos idiomas para compararlo PR vs main (diferencias esperadas: solo la sección de planes).
const L = require('./lib3.cjs'); const { open, info } = L
;(async () => { await L.DB.connect(); await L.launch(); const srv = await L.serve(); const out = {}
  for (const lang of ['es', 'en']) { const p = await open(null, { lang, w: 1360, url: process.env.ROUTE || '/', wait: 3000 }); out[lang] = await p.evaluate(() => (document.querySelector('main')?.innerText || '').split('\n').map(x => x.trim()).filter(Boolean)); await p.c.close() }
  L.fs.writeFileSync('C:/Users/Usuario/tools/qa3/out/d342' + (process.env.ROUTE ? 'p' : '') + '-' + L.LABEL + '.json', JSON.stringify(out)); await L.done(); srv?.close?.(); process.exit(0) })()

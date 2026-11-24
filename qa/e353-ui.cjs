// [QA-Claude-3] #353 F1: pantalla /admin/metrics con el backend del PR: «Sin datos» con 1–2 personas y promedio con 3 (general, ánimo y por profesional), ES/EN, 1360/390. Via qa/run.sh (build main, que ya trae #318).
const L = require('./lib3.cjs'); const { ck, info, mk, open, dbq, sleep } = L
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); const AD = await mk('admin', 'AD-353UI'); const T = await mk('therapist', 'Prof Sintética 353')
  const P = []; for (let i = 0; i < 4; i++) { const u = await mk('user', 'P' + i + '-353UI'); await dbq('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [T.id, u.id]); P.push(u) }
  const reset = async () => { await dbq('DELETE FROM "SessionRatings"'); await dbq('DELETE FROM "MoodLogs"') }
  const seed = async people => { await reset(); let d = 0; for (let k = 0; k < 6; k++) { const u = P[k % people]; d++; await dbq('INSERT INTO "SessionRatings"("rating","date","UserId","createdAt","updatedAt") VALUES (4,(now()::date - $1::int),$2,now(),now())', [d, u.id]); await dbq('INSERT INTO "MoodLogs"("checkin_mood","checkout_mood","date","UserId","createdAt","updatedAt") VALUES (3,4,(now()::date - $1::int),$2,now(),now())', [d, u.id]) } }
  const read = async (lang, w) => { const p = await open(AD, { lang, w, url: '/admin/metrics', wait: 3500 }); const t = await p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ')); const r = { t, errs: p.errs, ov: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) }; await p.c.close(); return r }
  for (const people of [1, 2, 3]) {
    await seed(people); for (const [lang, w] of [['es', 1360], ['en', 390]]) {
      const r = await read(lang, w); const nodata = (r.t.match(/sin datos|no data/gi) || []).length; info(`${people} persona(s) ${lang} ${w}:`, `sin datos×${nodata}`, r.t.match(/.{0,50}(calificaci|rating).{0,70}/i)?.[0] || '', '|', r.t.match(/Prof Sint.{0,80}/i)?.[0] || '')
      if (people < 3) ck(`F353-1 ${people} persona(s) × 6 valoraciones y ánimos (${lang} ${w}): «Sin datos» en el promedio de valoración, el de ánimo y el del profesional (≥ 3 apariciones), sin desborde ni errores`, nodata >= 3 && r.ov <= 0 && r.errs.length === 0, `sin datos×${nodata} ov=${r.ov} errs=${r.errs.join()}`)
      else ck(`F353-2 3 personas × 6 (${lang} ${w}): se muestran promedios (4,0 de valoración; el ánimo 3,5) y no «Sin datos» en esas tarjetas`, /(4|4[.,]0) (de|of) 5/.test(r.t) && /3[.,]5/.test(r.t) && r.ov <= 0 && r.errs.length === 0, `sin datos×${nodata} ${r.t.match(/(4|4[.,]0) (de|of) 5/)?.[0]} ${r.t.match(/3[.,]5/)?.[0]}`)
    }
  }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })

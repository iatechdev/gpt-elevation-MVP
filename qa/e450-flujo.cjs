// [QA-Claude-3] PR #450 (ES-387): flujo HTTP real del chat contra un backend propio (sin clave de IA: si la frase NO se detecta como crisis, la solicitud llega al proveedor y falla/avisa; si SÍ, responde interrumpida sin llamar a IA).
// Uso: API=http://localhost:8197 bash qa/run.sh e450-flujo.cjs p450 qa3_450 BACKEND=C:/Users/Usuario/tools/qa3/wt/backend
const L = require('./lib3.cjs'); const { ck, info, call, dbq, mk } = L
const Z = '\u200B', N = '\u0000', V = '\u000B', SHY = '\u00AD', RLO = '\u202E', BOM = '\uFEFF', NEL = '\u0085'
const CASES = [['limpia', 'me quiero morir'], ['ZWSP entre palabras', `quiero${Z}morir`], ['ZWSP entre palabras ES larga', `no${Z}quiero${Z}seguir${Z}viviendo`], ['VT entre palabras', `quiero${V}morir`], ['NUL entre palabras', `quiero${N}morir`], ['NEL entre palabras', `quiero${NEL}morir`], ['BOM entre palabras', `quiero${BOM}morir`], ['SHY entre palabras', `quiero${SHY}morir`], ['RLO entre palabras', `quiero${RLO}morir`], ['NUL dentro de la palabra', `quiero mor${N}ir`], ['ZWSP dentro de la palabra', `quiero mor${Z}ir`], ['EN ZWSP entre palabras', `i${Z}want${Z}to${Z}die`], ['EN NUL entre palabras', `i${N}want${N}to${N}die`], ['EN NUL dentro', `i want to k${N}ill myself`], ['mayúsculas + ZWSP', `QUIERO${Z}MORIR`], ['puntuación + ZWSP', `¡quiero${Z}morir!!!`]]
;(async () => {
  await L.DB.connect(); const U = await mk('user', 'P-450'); const rows = []
  for (const [lbl, msg] of CASES) { const r = await call('POST', '/api/chat', U.token, { message: msg, lang: 'es' }); const interrupted = r.j?.interrupted === true; rows.push([lbl, r.s, interrupted]); info(`${lbl.padEnd(32)} HTTP ${r.s} interrumpida=${interrupted} ${interrupted ? '' : (r.tx || '').slice(0, 70)}`) }
  const g = l => rows.find(r => r[0] === l)
  ck('F0 control: la frase limpia interrumpe con respuesta de apoyo', g('limpia')[2] === true, JSON.stringify(g('limpia')))
  const miss = rows.filter(r => !r[2]); ck('F1 TODAS las variantes con invisibles/controles interrumpen el chat (el detector las ve tras el pipeline real de la ruta)', miss.length === 0, JSON.stringify(miss))
  const msgs = await dbq('SELECT count(*)::int n FROM "Messages" WHERE "UserId"=$1', [U.id]).catch(() => null); info('mensajes guardados: ' + JSON.stringify(msgs))
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })

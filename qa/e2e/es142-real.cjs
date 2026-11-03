// [QA-Claude] ES-142 · muestra con IA REAL vía staging (aprobada por Mauricio: ≈10 llamadas, ≈150 mil tokens de entrada). Cuentas SINTÉTICAS propias.
// Pregunta: ¿CHAT_MAX_TOKENS=3000 alcanza para respuestas largas en español e inglés? Registra truncated, longitud y gasto por llamada.
// Uso: node qa/e2e/es142-real.cjs   (tope duro: 10 llamadas; se detiene si el gasto acumulado supera 200000 tokens)
const L = require('./lib.cjs'); const { j, fs, path } = L; const crypto = require('crypto');
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); };
const PROMPTS = {
  es: ['Quiero un plan de tres meses, semana por semana, para pasar de la docencia al análisis de datos. Sé detallado en cada semana.',
    'Explícame con detalle cómo podría preparar mis entrevistas de trabajo durante seis semanas: qué practicar cada semana y cómo medir mi avance.',
    'Ayúdame a ordenar mis ideas: escribe un plan de aprendizaje de SQL y Excel para dos meses, con ejercicios concretos cada semana y qué evidencia guardar.',
    'Cuéntame con mucho detalle cómo podría reconstruir mi hoja de vida, sección por sección, con ejemplos de cómo redactar cada logro.',
    'Descríbeme un plan de tres meses para explorar tres rutas de carrera distintas con pequeños experimentos semanales y cómo decidir al final.'],
  en: ['I want a three-month plan, week by week, to move from teaching into data analysis. Be detailed for every week.',
    'Explain in detail how I could prepare for job interviews over six weeks: what to practise each week and how to measure my progress.',
    'Help me organise my thoughts: write a two-month learning plan for SQL and Excel with concrete weekly exercises and what evidence to keep.',
    'Tell me in great detail how I could rebuild my CV, section by section, with examples of how to word each achievement.',
    'Describe a three-month plan to explore three different career paths with small weekly experiments and how to decide at the end.'],
};
(async () => {
  let spent = 0, calls = 0; const rows = [];
  for (const lang of ['es', 'en']) {
    const P = await L.newPersona('r142' + lang); const s = await L.login(P); if (!s) { console.log('ERROR sin sesión ' + lang); process.exit(1); } const tok = s.token;
    const usage = async () => (await j('GET', '/api/ai/usage', tok)).j?.used ?? 0;
    for (const [i, msg] of PROMPTS[lang].entries()) {
      if (calls >= 10 || spent > 200000) break; const u0 = await usage(); const rid = crypto.randomUUID(); const t0 = Date.now();
      const r = await j('POST', '/api/chat', tok, { message: msg, requestId: rid }); calls++; const u1 = await usage(); spent += (u1 - u0);
      const reply = r.j?.reply || ''; const row = { lang, n: i + 1, http: r.s, truncated: r.j?.truncated === true, chars: reply.length, words: reply.split(/\s+/).filter(Boolean).length, tokensUsed: u1 - u0, ms: Date.now() - t0, endsClean: /[.!?…»”)\]*]\s*$/.test(reply.trim()) };
      rows.push(row); console.log(JSON.stringify({ info: 'llamada', ...row }));
      if (r.s !== 200) { R(`ES142-REAL ${lang}${i + 1}: respuesta 200`, false, `http=${r.s} ${JSON.stringify(r.j).slice(0, 200)}`); }
      // el texto de la respuesta NO se guarda en la evidencia (solo métricas)
      if (i === 0) { const rep = await j('POST', '/api/chat', tok, { message: msg, requestId: rid }); const u2 = await usage(); R(`ES142-REAL ${lang}: repetición del mismo requestId no gasta ni cambia truncated`, rep.s === 200 && rep.j?.replayed === true && (rep.j?.truncated === true) === row.truncated && u2 === u1, `http=${rep.s} replayed=${rep.j?.replayed} gasto=${u2 - u1}`); }
    }
    const msgs = await j('GET', '/api/messages', tok); const bots = (msgs.j || []).filter(m => m.role === 'bot'); const nT = bots.filter(m => m.truncated === true).length; const mine = rows.filter(x => x.lang === lang);
    R(`ES142-REAL ${lang}: GET /api/messages coincide con las respuestas (truncated:true = ${mine.filter(x => x.truncated).length})`, bots.length === mine.length && nT === mine.filter(x => x.truncated).length, `bots=${bots.length} truncadas=${nT}`);
  }
  const t = rows.filter(r => r.truncated);
  for (const lang of ['es', 'en']) { const m = rows.filter(r => r.lang === lang); R(`ES142-REAL ${lang}: cuántas de ${m.length} respuestas largas cierran por tope de 3000 (truncated:true)`, m.length > 0 && m.every(r => r.http === 200), `truncadas=${m.filter(r => r.truncated).length}/${m.length} · palabras (mín–máx)=${Math.min(...m.map(r => r.words))}–${Math.max(...m.map(r => r.words))} · tokens gastados por llamada=${m.map(r => r.tokensUsed).join(',')} · terminan en signo de cierre=${m.filter(r => r.endsClean).length}/${m.length}`); }
  console.log('RESUMEN-ES142-REAL ' + JSON.stringify({ llamadas: calls, tokensTotales: spent, truncadas: t.length, filas: rows }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-142-pr131-real.json'), JSON.stringify({ llamadas: calls, tokensTotales: spent, filas: rows, checks: out }, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });

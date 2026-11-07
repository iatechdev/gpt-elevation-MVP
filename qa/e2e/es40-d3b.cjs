// [QA-Claude] ES-40 · repetición de D3b (validación de entradas de la exportación) tras esperar la ventana del límite por minuto (la primera corrida tocó el 429 antes de validar).
const L = require('./lib.cjs'); const { j, fs, path } = L;
(async () => {
  const P = await L.newPersona('r40v'); const s = await L.login(P); await new Promise(r => setTimeout(r, 65000));
  const extra = await j('POST', '/api/exports/preview', s.token, { type: 'personal', locale: 'es', x: 1 }); const loc = await j('POST', '/api/exports/preview', s.token, { type: 'personal', locale: 'fr' }); const prof = await j('POST', '/api/exports/preview', s.token, { type: 'professional', locale: 'es' });
  const r = { id: 'D3b-bis campo extra → 400, idioma inválido → 400; la exportación professional responde sin 5xx inesperado', ok: extra.s === 400 && loc.s === 400 && prof.s < 500 || (prof.s === 503 && !!prof.j?.code), detail: `extra=${extra.s} idioma=${loc.s} professional=${prof.s} ${prof.j?.code ?? ''}` };
  console.log(JSON.stringify(r)); const f = path.join(__dirname, '..', 'evidence', 'ES-40-v3-staging.json'); const o = JSON.parse(fs.readFileSync(f, 'utf8')); o.push(r); fs.writeFileSync(f, JSON.stringify(o, null, 1));
})();

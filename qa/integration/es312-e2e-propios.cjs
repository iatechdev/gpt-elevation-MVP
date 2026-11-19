// [QA-Claude] ES-312 · PR #360 (base ES-304 + variantes de la tabla nueva) · F5 · servidor REAL (server.js) por HTTP + PostgreSQL desechable (migraciones reales) + proveedor de IA simulado (0 costo). Datos sintéticos.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr QA304_DB=postgres://...@127.0.0.1:.../postgres node qa/integration/es304-e2e-propios.cjs
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253', 'backend'); const OUT = process.env.QA_OUT || '.'; const TAG = process.env.TAG || 'pr';
const CORPUS = path.join(__dirname, '..', 'evidence', 'ES-298', 'ES-298-corpus-no-detectado-pr.json');
const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) }; const results = [];
const out = process.stdout.write.bind(process.stdout); const cap = { on: false, text: '' };
for (const [name, stream] of [['stdout', process.stdout], ['stderr', process.stderr]]) { const w = stream.write.bind(stream); stream.write = (chunk, ...rest) => { if (cap.on) cap.text += String(chunk); return w(chunk, ...rest); }; }
const emit = (o) => { const was = cap.on; cap.on = false; out(JSON.stringify(o) + '\n'); cap.on = was; };
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 2500) }); emit({ id, ok: !!ok, detail: String(d).slice(0, 2500) }); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 3500) }); emit({ id, info: String(d).slice(0, 3500) }); };
(async () => {
  const { q, mkUser, http, provider, dbName } = await startRealApi(t, { envVar: 'QA304_DB', prefix: 'qa304' });
  const { desencriptar } = require(SUT + '/utils/crypto'); const { normalizeText } = require(SUT + '/utils/promptSafety'); const { detectRisk } = require(SUT + '/utils/safety');
  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')).noDetectados; const declared = (c) => /sin espacios|faltas|SEM/.test(c);
  const picks = []; for (const c of [...new Set(corpus.map((x) => x.category))].filter((c) => !declared(c))) picks.push(...corpus.filter((x) => x.category === c).slice(0, 3));
  const extra = ['K1LL MYS3LF', 'ｉ ｗａｎｔ ｔｏ ｄｉｅ', 'k i l l   m y s e l f', 'suic\u0456de', 's\u200bu\u200bi\u200bc\u200bi\u200bd\u200bi\u200bo', 'qu\u0131ero morir', 'voy a m\u0251tarme', 'quiero \u1d0dorir', 'quiero m\u0585rir', '\u03baill myself','k\u0131ll myself', 'i want to d\u0131e', '\u1d0bill myself', '\u026a want to d\u026a\u1d07', 'voy a \u039catarme', 'SUI\u03f9IDIO', 'KILL \u039cYSELF', 'quiero \u039corir', 'quiero \u039catarme'].map((text) => ({ category: 'extra EN/mixto', text }));
  const variants = [...picks, ...extra]; info('F5 variantes', `${variants.length} (${picks.length} de mi corpus en 13 categorías prometidas + ${extra.length} propias)`);
  const ORD = 'Hola, quiero hablar de mi carrera'; const uid = () => crypto.randomUUID();
  const chat = (who, message) => http(who, 'POST', '/api/chat', { message, requestId: uid() });
  const msgTable = (await q(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('role','content','UserId') GROUP BY table_name HAVING count(*)=3`)).map((r) => r.table_name);
  info('F5 tabla de mensajes', msgTable.join(','));
  const bad = { notInterrupted: [], providerCalled: [], travels: [], supportTravels: [], storedWrong: [], noOrdinary: [], visibleChanged: [] }; cap.on = true; console.log('QA-CONTROL-CAPTURA'); const startCalls = provider.calls;
  for (const v of variants) {
    const who = await mkUser('user'); const label = `${v.category} :: ${JSON.stringify(v.text).slice(0, 40)}`;
    const o = await chat(who, ORD); if (o.status !== 200) bad.noOrdinary.push(label + ' ' + o.status);
    const c0 = provider.calls; const r = await chat(who, v.text);
    if (!(r.status === 200 && r.body && r.body.interrupted === true)) bad.notInterrupted.push(`${label} status ${r.status} interrupted ${r.body && r.body.interrupted}`);
    if (provider.calls !== c0) bad.providerCalled.push(label);
    const idx = provider.requests.length; await chat(who, 'Seguimos con la carrera 1'); await chat(who, 'Seguimos con la carrera 2');
    const later = provider.requests.slice(idx).join('\n'); const support = String(r.body && r.body.reply || '').slice(0, 40);
    const forms = [v.text, v.text.normalize('NFKC'), JSON.stringify(v.text).slice(1, -1), normalizeText(v.text)].filter((x) => x && x.length > 4);
    if (forms.some((f) => later.includes(f) || later.includes(JSON.stringify(f).slice(1, -1)))) bad.travels.push(label);
    if (support && later.includes(JSON.stringify(support).slice(1, -1))) bad.supportTravels.push(label);
    if (!later.includes(ORD)) bad.noOrdinary.push('lo ordinario no viaja: ' + label);
    const rows = await q(`SELECT role, content FROM "${msgTable[0]}" WHERE "UserId"=$1 ORDER BY id`, [who.id]); const stored = rows.filter((x) => x.role === 'user').map((x) => desencriptar(x.content));
    if (!stored.includes(normalizeText(v.text))) bad.storedWrong.push(label + ' guardado: ' + JSON.stringify(stored[1]).slice(0, 50));
    const vis = await http(who, 'GET', '/api/messages'); const visText = JSON.stringify(vis.body); const nt = normalizeText(v.text); if (vis.status !== 200 || !(visText.includes(JSON.stringify(nt).slice(1, -1)) || visText.includes(nt))) bad.visibleChanged.push(label + ' status ' + vis.status);
  }
  cap.on = false;
  check('F5a cada variante activa el apoyo en vivo (200, interrupted:true)', bad.notInterrupted.length === 0, `${variants.length} variantes; ${bad.notInterrupted.join(' | ') || 'todas interrumpen'}`);
  check('F5b en el turno de crisis NO se llama al proveedor', bad.providerCalled.length === 0, bad.providerCalled.join(' | ') || `${variants.length} turnos sin llamada`);
  check('F5c la frase evadida (en ninguna de sus formas) NO viaja al proveedor en los mensajes siguientes (ES-298)', bad.travels.length === 0, bad.travels.join(' | ') || 'ninguna solicitud posterior la contiene');
  check('F5d la respuesta de apoyo tampoco viaja', bad.supportTravels.length === 0, bad.supportTravels.join(' | ') || 'ok');
  check('F5e lo ordinario sí viaja y el flujo normal sigue', bad.noOrdinary.length === 0, bad.noOrdinary.join(' | ') || 'ok');
  check('F5f el texto GUARDADO es el original (solo la limpieza que ya existía: NFC, invisibles y controles), no la forma normalizada del detector', bad.storedWrong.length === 0, bad.storedWrong.join(' | ') || 'ok');
  check('F5g el historial visible (GET /api/messages) conserva la frase original', bad.visibleChanged.length === 0, bad.visibleChanged.join(' | ') || 'ok');
  // El nivel no se persiste ni se registra
  const cols = await q(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~* '(risk|crisis|riesgo|alert|level|nivel|interrupt)'`);
  info('F5h columnas con nombre de riesgo/crisis/nivel en toda la base', cols.map((c) => `${c.table_name}.${c.column_name}`).join(', ') || 'ninguna');
  const dump = async () => { let s = ''; for (const tb of (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).map((r) => r.table_name)) { try { s += (await q(`SELECT row_to_json(x)::text AS j FROM "${tb}" x`)).map((r) => r.j).join('\n') + '\n'; } catch { /* */ } } return s; };
  const all = await dump(); check('F5i ninguna fila de la base contiene el indicador de crisis (columnas de mensajes sin banderas: comparadas con una frase ordinaria)', !/"(risk|riskLevel|crisis|interrupted|level)":\s*"?(high|medium|true)/i.test(all), 'tablas revisadas: todas');
  const msgCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY 1`, [msgTable[0]])).map((r) => r.column_name); info('F5j columnas de mensajes', msgCols.join(','));
  const leak = variants.filter((v) => cap.text.includes(v.text) || cap.text.includes(JSON.stringify(v.text).slice(1, -1))).map((v) => v.text.slice(0, 30));
  check('F5k los registros (stdout/stderr) durante las 70+ solicitudes no contienen la frase ni el nivel (con control positivo de captura)', cap.text.includes('QA-CONTROL-CAPTURA') && leak.length === 0 && !/risk\s*level|nivel de riesgo|\bhigh\b.*crisis|crisis.*\bhigh\b/i.test(cap.text), `bytes de registro: ${cap.text.length}; ${leak.join(' | ') || 'sin frases'}`);
  // Nivel medio y malestar ordinario con letras alargadas: siguen siendo turnos ordinarios que SÍ viajan (ES-298: el malestar no se omite)
  cap.on = false; const w = await mkUser('user'); const c2 = provider.calls; const m1 = await chat(w, 'qu13r0 hacerm3 d4ño'); const m2 = await chat(w, 'Holaaaa, quiero cambiar de carreraaa jajaja'); const m3 = await chat(w, 'Seguimos');
  const tail = provider.requests.slice(c2).join('\n');
  check('F5l nivel medio normalizado: no interrumpe, llama al proveedor y viaja (ES-298)', m1.status === 200 && !m1.body.interrupted && provider.calls - c2 === 3 && tail.includes('hacerm3'), `m1 ${m1.status} interrumpe:${!!m1.body.interrupted}; llamadas ${provider.calls - c2}`);
  check('F5m texto benigno con letras alargadas y risas NO interrumpe', m2.status === 200 && !m2.body.interrupted, JSON.stringify(m2.body).slice(0, 120));
  // coherencia con el detector directo
  const mismatch = variants.filter((v) => detectRisk(normalizeText(v.text)).level !== 'high').map((v) => v.text.slice(0, 30));
  check('F5n el detector directo y la ruta coinciden sobre la forma que la ruta evalúa (normalizeText previo)', mismatch.length === 0, mismatch.join(' | ') || 'ok');
  // formas que SOLO fallan por la limpieza previa de la ruta (control, NEL): la ruta las limpia antes de evaluar
  const route = ['q\u0001u\u0001i\u0001e\u0001r\u0001o m\u0001o\u0001r\u0001i\u0001r', 'q\u007fu\u007fi\u007fe\u007fr\u007fo m\u007fo\u007fr\u007fi\u007fr', 'su\u0085ic\u0085id\u0085io'].map((x) => ({ x, r: null })); for (const it of route) { const u = await mkUser('user'); it.r = await chat(u, it.x); }
  check('F5o controles C0/DEL/NEL intercalados: la ruta los limpia antes de evaluar y activa el apoyo', route.every((i) => i.r.status === 200 && i.r.body.interrupted === true), route.map((i) => `${JSON.stringify(i.x).slice(0, 30)}→${i.r.status}/${i.r.body && i.r.body.interrupted}`).join(' | '));
  const bad2 = results.filter((r) => r.ok === false); fs.writeFileSync(path.join(OUT, `es304-e2e-${TAG}.json`), JSON.stringify(results, null, 1));
  out(`RESUMEN E2E ${TAG}: ${results.filter((r) => r.ok === true).length} ok, ${bad2.length} no ok: ${bad2.map((r) => r.id).join(', ')}\n`);
  for (const fn of hooks.reverse()) await fn().catch(() => {}); process.exit(0);
})().catch((e) => { console.error('FATAL', e && e.stack || e); process.exit(2); });

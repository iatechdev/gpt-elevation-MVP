// ES-390 (residual QA-450-2): un separador invisible ENTRE palabras y otros invisibles DENTRO de palabras en el mismo mensaje. Las formas de ES-387 leían TODOS como espacio o TODOS quitados: la mezcla se detectaba solo en ~40 %
// (7 700 casos medidos: 39,8 % por detectRisk y 20,8 % por el camino del chat). Ahora cada racha de controles/invisibles es un MARCADOR y las reglas se leen tolerantes (el marcador vale espacio o nada).
// La prueba de rendimiento va PRIMERA: después de miles de evaluaciones la misma medición se degrada.
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectRisk, normalizeForRisk, _steps } = require('../utils/safety');
const { normalizeText } = require('../utils/promptSafety');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');

const c = (...points) => String.fromCharCode(...points);
const SEP = { ZWSP: c(0x200B), SHY: c(0xAD), ZWJ: c(0x200D), BOM: c(0xFEFF), VT: c(0x0B), NUL: c(0), FS: c(0x1C), RLO: c(0x202E), NEL: c(0x85), WJ: c(0x2060) };
const PHRASES = ['me quiero morir', 'no quiero seguir viviendo', 'quiero suicidarme', 'i want to kill myself', 'voy a quitarme la vida', 'better off dead', 'mejor estar muerto', 'i dont want to be alive'];
// Todas las posiciones DENTRO de una palabra (entre dos letras de la misma palabra).
const innerPositions = (phrase) => { const out = []; let at = 0; for (const word of phrase.split(' ')) { for (let k = 1; k < word.length; k += 1) out.push(at + k); at += word.length + 1; } return out; };
const mixed = (phrase, between, inner, position) => phrase.slice(0, position).split(' ').join(between) + inner + phrase.slice(position).split(' ').join(between);

test('ES-390: rendimiento RELATIVO a una referencia de la misma corrida, con mezclas de invisibles (4 000 caracteres) y entradas hostiles de hasta 100 000', () => {
  const sample = `Hoy fue un día largo${SEP.ZWSP} pero avancé${SEP.SHY} con mi plan${SEP.VT} y hablé${SEP.NUL}con mi mentor.\n`.repeat(50).slice(0, 4000);
  const reference = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const stats = (list) => { const s = [...list].sort((x, y) => x - y); return { median: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)] }; };
  const hr = () => process.hrtime.bigint(); const work = []; const base = [];
  for (let i = 0; i < 20; i += 1) { detectRisk(`${sample}w${i}`); reference(`${sample}w${i}`); }
  for (let i = 0; i < 100; i += 1) { let s = hr(); detectRisk(`${sample}${i}`); work.push(Number(hr() - s) / 1e6); s = hr(); reference(`${sample}${i}`); base.push(Number(hr() - s) / 1e6); }
  const w = stats(work); const r = stats(base);
  assert.ok(w.median / r.median < 400, `mediana ${w.median.toFixed(2)} ms contra la referencia ${r.median.toFixed(2)} ms (razón ${(w.median / r.median).toFixed(1)})`);
  if (r.p95 < 5) assert.ok(w.p95 < 50, `equipo libre: p95 ${w.p95.toFixed(2)} ms`);
  const start = hr();
  for (const text of [`a${SEP.ZWSP}`.repeat(50000), `quiero${SEP.ZWSP}mori`.repeat(10000), `me${SEP.ZWSP}qu${SEP.SHY}iero${SEP.ZWSP}mori${SEP.VT}`.repeat(8000), `${SEP.ZWSP}${SEP.SHY}`.repeat(50000), `no${SEP.ZWSP}quiero${SEP.SHY}seguir `.repeat(5000)]) detectRisk(text);
  const ms = Number(hr() - start) / 1e6; assert.ok(ms < 6000, `entradas hostiles: ${ms.toFixed(0)} ms`);
});

test('ES-390: mezcla: separador X entre palabras + relleno Y DENTRO de una palabra, TODAS las posiciones, en 5 x 5 pares: detectRisk Y el camino del chat (normalizeForRisk) detectan', () => {
  let cases = 0;
  for (const phrase of PHRASES) {
    for (const x of ['ZWSP', 'SHY', 'VT', 'NUL', 'BOM']) {
      for (const y of ['ZWSP', 'SHY', 'VT', 'NUL', 'BOM']) {
        for (const position of innerPositions(phrase)) {
          cases += 1;
          const text = mixed(phrase, SEP[x], SEP[y], position);
          assert.equal(detectRisk(text).level, 'high', `detectRisk ${x} entre palabras + ${y} en ${position}: «${phrase}»`);
          const stored = normalizeForRisk(text, normalizeText);
          assert.equal(detectRisk(stored).level, 'high', `chat ${x}+${y} en ${position}: «${phrase}» (lo guardado se reevalúa igual)`);
        }
      }
    }
  }
  assert.ok(cases > 2000, `casos: ${cases}`);
});

test('ES-390: los demás separadores en la mezcla (ZWJ, FS, RLO, NEL, WJ), varios rellenos a la vez y nivel medio', () => {
  for (const x of ['ZWJ', 'FS', 'RLO', 'NEL', 'WJ']) for (const y of ['ZWJ', 'FS', 'RLO', 'NEL', 'WJ']) {
    assert.equal(detectRisk(mixed('me quiero morir', SEP[x], SEP[y], 6)).level, 'high', `${x}+${y}`);
    assert.equal(detectRisk(mixed('i want to kill myself', SEP[x], SEP[y], 9)).level, 'high', `${x}+${y} EN`);
  }
  assert.equal(detectRisk(`m${SEP.SHY}e${SEP.ZWSP}qu${SEP.NUL}ie${SEP.VT}ro${SEP.BOM}mo${SEP.ZWJ}ri${SEP.SHY}r`).level, 'high', 'rellenos en muchas posiciones');
  assert.equal(detectRisk(`no${SEP.ZWSP}agu${SEP.SHY}anto${SEP.ZWSP}mas`).level, 'medium');
  assert.equal(detectRisk(`hu${SEP.SHY}rt${SEP.ZWSP}myself`).level, 'medium');
  assert.equal(detectRisk(`me${SEP.ZWSP}qu${SEP.SHY}iero${SEP.ZWSP}morir`).lang, 'es');
  assert.equal(detectRisk(`i${SEP.ZWSP}wa${SEP.SHY}nt${SEP.ZWSP}to${SEP.ZWSP}kill${SEP.ZWSP}myself`).lang, 'en');
});

test('ES-390: ADITIVO: lo que la forma de siempre detectaba se detecta igual (nivel e idioma), con y sin mezclas al final', () => {
  const rank = { high: 2, medium: 1 };
  for (const text of ['me quiero morir', 'no quiero seguir viviendo', 'quiero suicidarme', 'i want to kill myself', 'no aguanto mas', 'self-harm', 'hola, todo bien', 'quiero comer pizza', `s u i c i d i o${SEP.ZWSP}`, 'Q U I E R O  M O R I R', `me${SEP.ZWSP}quiero${SEP.ZWSP}morir`, `su${SEP.ZWSP}icid${SEP.SHY}io`]) {
    const before = _steps.legacy(text); const now = detectRisk(text);
    assert.ok((rank[now.level] || 0) >= (rank[before.level] || 0), `nunca menos: «${text}»`);
    if (before.level) assert.deepEqual({ level: now.level, lang: now.lang }, { level: before.level, lang: before.lang });
  }
});

test('ES-390: falsos positivos: texto legítimo con mezclas de invisibles NO sube a crisis (cota: los 3 preexistentes de QA-6)', () => {
  const legit = [
    `Quiero${SEP.ZWSP}comer${SEP.SHY}mejor${SEP.ZWSP}esta semana`, `No${SEP.VT}quie${SEP.NUL}ro${SEP.VT}más${SEP.ZWSP}tareas hoy, gracias`, `Voy${SEP.ZWJ}a${SEP.SHY}mi${SEP.ZWJ}entre${SEP.BOM}vista${SEP.ZWJ}mañana`,
    `Please${SEP.SHY}kill${SEP.ZWSP}the${SEP.SHY}pro${SEP.ZWSP}cess and restart`, `Me${SEP.FS}quie${SEP.ZWSP}ro${SEP.FS}ir${SEP.NUL}a${SEP.FS}casa temprano`, `Hoy${SEP.NEL}ha${SEP.SHY}blé${SEP.NEL}con${SEP.NEL}mi${SEP.ZWSP}mentor`,
    `We${SEP.WJ}want${SEP.ZWSP}to${SEP.WJ}sh${SEP.SHY}ip${SEP.WJ}the${SEP.ZWSP}release`, `Quiero${SEP.ZWSP}vi${SEP.SHY}vir${SEP.ZWSP}mejor y seguir${SEP.ZWSP}vi${SEP.SHY}viendo en Bogotá`, `I${SEP.ZWSP}wa${SEP.SHY}nt${SEP.ZWSP}to${SEP.ZWSP}live${SEP.ZWSP}in${SEP.SHY}Lisbon`,
    `Mi${SEP.NUL}currí${SEP.SHY}culum${SEP.NUL}está${SEP.ZWSP}listo`, `Quiero${SEP.ZWSP}mo${SEP.SHY}ver${SEP.ZWSP}el escritorio al fondo`, `Me${SEP.ZWSP}quiero${SEP.SHY}cor${SEP.ZWSP}tar el pelo mañana`, `Texto persa con ZWNJ: می${c(0x200C)}خواهم، y 👩${c(0x200D)}💻 en el saludo`,
  ];
  for (const text of legit) assert.equal(detectRisk(text).level, null, `no debe activarse: ${JSON.stringify(text.slice(0, 40))}`);
});

test('ES-390: el camino del chat: lo guardado de un mensaje con mezcla se reevalúa igual (historial) y un mensaje ordinario queda idéntico a antes', () => {
  for (const text of [mixed('me quiero morir', SEP.ZWSP, SEP.SHY, 6), mixed('quiero suicidarme', SEP.VT, SEP.NUL, 9), mixed('i want to kill myself', SEP.ZWSP, SEP.BOM, 9)]) {
    const stored = normalizeForRisk(text, normalizeText);
    assert.equal(detectRisk(stored).level, 'high'); assert.equal(detectRisk(stored).lang, detectRisk(text).lang);
  }
  for (const text of [`Hoy${SEP.ZWSP} fue${SEP.SHY} un día largo`, 'Texto llano sin nada', `می${c(0x200C)}خواهم`, 'Quiero morir']) assert.equal(normalizeForRisk(text, normalizeText), text.includes(SEP.ZWSP) || text.includes(SEP.SHY) || text.includes(c(0x200C)) ? normalizeText(text) : text);
});

test('ES-390 (HTTP): un mensaje del chat con la mezcla INTERRUMPE el turno sin llamar al proveedor y no viaja en los siguientes', async (t) => {
  promptVault.getActivePrompt = async () => 'Synthetic system prompt';
  const post = (request, body) => request('POST', '/api/chat', { role: 'user', id: 103, body });
  for (const [phrase, x, y, position] of [['me quiero morir', SEP.ZWSP, SEP.SHY, 6], ['no quiero seguir viviendo', SEP.VT, SEP.NUL, 10], ['i want to kill myself', SEP.ZWSP, SEP.BOM, 9]]) {
    const state = install(); models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
    const calls = []; anthropic.messages.create = async (options) => { calls.push(options); return { content: [{ type: 'text', text: 'Respuesta sintética' }] }; };
    const request = await startApp(t);
    await post(request, { message: 'Hola, quiero hablar de mi carrera' });
    const before = calls.length;
    const crisis = await post(request, { message: mixed(phrase, x, y, position), lang: /^[a-z ]+$/.test(phrase) && phrase.startsWith('i ') ? 'en' : 'es' });
    assert.equal(crisis.body.interrupted, true, JSON.stringify(mixed(phrase, x, y, position))); assert.equal(calls.length, before, 'el proveedor NO se llama');
    for (let i = 0; i < 2; i += 1) await post(request, { message: `Seguimos con la carrera ${i}` });
    const later = calls.slice(before).map((o) => JSON.stringify(o)).join('\n');
    assert.ok(!later.includes(phrase) && !later.includes(phrase.split(' ').join('')) && !later.includes(crisis.body.reply.slice(0, 40)), 'la frase y la respuesta de apoyo no viajan después');
    assert.ok(state.messages.length >= 2 + 2 + 4, 'nada se borró del historial guardado');
  }
});

test('ES-390 (mutación, lectura de código): las reglas tolerantes y el marcador existen y la forma con marcador va DESPUÉS de las de siempre', () => {
  const src = require('node:fs').readFileSync(require.resolve('../utils/safety'), 'utf8');
  assert.ok(src.indexOf('GAPS_TEST.test(nfkc)') < src.indexOf('const marked = unmask(') && src.includes('TOLERANT_UNITED') && src.includes('function tolerant('));
  assert.ok(src.includes('if (rawText !== best && rank(rawText) > bestRank) best = rawText;'));
});

test('ES-390 (O457-1): un U+0001 escrito por la persona NO vuelve tolerante una forma normal: lo que se detectaba antes se sigue detectando', () => {
  for (const text of [`no${c(1)}me quiero matar`, `no${c(1)}me quiero morir`, `${c(1)}me quiero morir`, `me quiero morir${c(1)}`, `quiero${c(1)}suicidarme`]) {
    assert.equal(_steps.legacy(text).level === null || detectRisk(text).level === 'high', true);
    assert.equal(detectRisk(text).level, 'high', JSON.stringify(text));
  }
  assert.equal(_steps.legacy(`no${c(1)}me quiero matar`).level, 'high', 'en la forma de siempre ya era high');
  assert.equal(detectRisk(`no${c(1)}me quiero matar`).level, 'high');
});

test('ES-390 (F457-1, HTTP): lo que VIAJA al proveedor nunca lleva controles (mensaje actual e historial), aunque lo guardado de una mezcla de riesgo MEDIO los conserve', async (t) => {
  promptVault.getActivePrompt = async () => 'Synthetic system prompt';
  const post = (request, body) => request('POST', '/api/chat', { role: 'user', id: 104, body });
  const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
  const hasControl = (value) => (typeof value === 'string' ? CONTROLS.test(value) : value && typeof value === 'object' ? Object.values(value).some(hasControl) : false);
  for (const message of [`no${SEP.ZWSP}pue${SEP.NUL}do${SEP.VT}mas`, `ya${SEP.SHY}no${SEP.NEL}pue${SEP.FS}do${SEP.ZWSP}más`, `i${SEP.ZWSP}can${SEP.NUL}t${SEP.ZWSP}go${SEP.ZWSP}on`, `Hoy${SEP.NUL} fue${SEP.VT} un día${SEP.ZWSP} largo`]) {
    const state = install(); models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
    const calls = []; anthropic.messages.create = async (options) => { calls.push(options); return { content: [{ type: 'text', text: 'Respuesta sintética' }] }; };
    const request = await startApp(t);
    const first = await post(request, { message });
    assert.ok(first.status === 200, `status ${first.status}`);
    for (let i = 0; i < 2; i += 1) await post(request, { message: `Seguimos ${i}` });
    assert.ok(calls.length >= 3, 'el riesgo medio SÍ llama al proveedor');
    for (const call of calls) assert.equal(hasControl(call), false, `ningún control viaja al proveedor: ${JSON.stringify(message)}`);
    assert.ok(state.messages.length >= 6);
  }
});

test('ES-390 (F457-1): la barrera de salida (stripInvisible / fenceUntrusted) quita también los controles; salto de línea, tabulador y CR se conservan', () => {
  const { stripInvisible, fenceUntrusted } = require('../utils/promptSafety');
  const text = `a${c(0)}b${c(0x0B)}c${c(0x0C)}d${c(0x85)}e${c(0x1F)}f${c(0x7F)}g\nh\ti\r\nj`;
  assert.equal(stripInvisible(text), 'abcdefg\nh\ti\r\nj');
  const fenced = fenceUntrusted('the message', `x${c(0)}y${c(0x0B)}z`).block;
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(fenced));
});

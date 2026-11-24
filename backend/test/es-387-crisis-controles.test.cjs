// ES-387: la detección de crisis NO se pierde cuando los espacios de la frase son controles o invisibles (VT, FF, NEL, FS–US, NUL, DEL, ZWSP, ZWNJ, ZWJ, LRM, WJ, BOM, SHY, RLO...) ni cuando uno se mete DENTRO de una palabra.
// Antes: «me[ZWSP]quiero[ZWSP]morir» se leía «mequieromorir» (fail-open). Ahora el detector lee además una forma con ellos como ESPACIO y otra con los controles quitados. ADITIVO: nunca menos detección que antes.
// La prueba de rendimiento va PRIMERA: después de miles de evaluaciones la misma medición se degrada.
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectRisk, _steps } = require('../utils/safety');

const c = (...points) => String.fromCharCode(...points);
const SEPARATORS = {
  VT: c(0x0B), FF: c(0x0C), NEL: c(0x85), FS: c(0x1C), GS: c(0x1D), RS: c(0x1E), US: c(0x1F), NUL: c(0), SOH: c(1), DEL: c(0x7F),
  ZWSP: c(0x200B), ZWNJ: c(0x200C), ZWJ: c(0x200D), LRM: c(0x200E), RLM: c(0x200F), WJ: c(0x2060), BOM: c(0xFEFF), SHY: c(0xAD), RLO: c(0x202E), LRE: c(0x202A), ISEP: c(0x2063), FA: c(0x2061),
  'ZWSP+VT': c(0x200B, 0x0B), 'NUL+SHY': c(0, 0xAD), ' ZWSP ': ` ${c(0x200B)} `, 'VT+VT': c(0x0B, 0x0B),
};
const HIGH_PHRASES = [
  'me quiero morir', 'no quiero seguir viviendo', 'quiero suicidarme', 'i want to kill myself', 'voy a quitarme la vida', 'no vale la pena vivir', 'quiero acabar con mi vida',
  'better off dead', 'i wish i was dead', 'i want to end my life', 'no quiero vivir', 'mejor estar muerto', 'me voy a matar', 'i dont want to be alive', 'i want to die',
];

test('ES-387: rendimiento RELATIVO a una referencia de la misma corrida (texto de ~4 000 caracteres con controles e invisibles; la forma nueva solo corre si hay controles)', () => {
  const sample = `Hoy fue un día largo${c(0x200B)} pero avancé con mi plan${c(0x0B)} y hablé con mi mentor.\n`.repeat(50).slice(0, 4000);
  const reference = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const stats = (list) => { const s = [...list].sort((x, y) => x - y); return { median: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)] }; };
  const hr = () => process.hrtime.bigint(); const work = []; const base = [];
  for (let i = 0; i < 20; i += 1) { detectRisk(`${sample}w${i}`); reference(`${sample}w${i}`); }
  for (let i = 0; i < 100; i += 1) { let s = hr(); detectRisk(`${sample}${i}`); work.push(Number(hr() - s) / 1e6); s = hr(); reference(`${sample}${i}`); base.push(Number(hr() - s) / 1e6); }
  const w = stats(work); const r = stats(base);
  assert.ok(w.median / r.median < 150, `mediana ${w.median.toFixed(2)} ms contra la referencia ${r.median.toFixed(2)} ms (razón ${(w.median / r.median).toFixed(1)})`);
  if (r.p95 < 5) assert.ok(w.p95 < 50, `equipo libre: p95 ${w.p95.toFixed(2)} ms`);
});

test('ES-387: hostil: rachas largas de controles e invisibles (20 000 caracteres) se evalúan sin retroceso exponencial', () => {
  const start = process.hrtime.bigint();
  for (const text of [c(0x200B).repeat(20000), `me${c(0)}`.repeat(6000), `quiero${c(0x0B)}morir`.repeat(1500), `${c(0x200D)}a`.repeat(10000), `m${c(0xAD)}`.repeat(10000), `me quiero morir${c(0x200B).repeat(15000)}`]) detectRisk(text);
  const ms = Number(process.hrtime.bigint() - start) / 1e6; assert.ok(ms < 8000, `${ms.toFixed(0)} ms`);
});

test('ES-387: cada frase de crisis ALTA se detecta con CUALQUIER control o invisible como separador en CADA hueco (ES/EN)', () => {
  let cases = 0;
  for (const phrase of HIGH_PHRASES) {
    assert.equal(detectRisk(phrase).level, 'high', `la base detecta «${phrase}»`);
    const words = phrase.split(' ');
    for (const [name, separator] of Object.entries(SEPARATORS)) {
      assert.equal(detectRisk(words.join(separator)).level, 'high', `${name} en todos los huecos: «${phrase}»`);
      for (let gap = 0; gap < words.length - 1; gap += 1) {
        cases += 1;
        const text = words.map((w, i) => (i === 0 ? w : `${i === gap + 1 ? separator : ' '}${w}`)).join('');
        assert.equal(detectRisk(text).level, 'high', `${name} en el hueco ${gap}: «${phrase}»`);
      }
    }
  }
  assert.ok(cases > 600, `casos: ${cases}`);
});

test('ES-387: un control o invisible DENTRO de una palabra tampoco la esconde (en cada posición)', () => {
  for (const phrase of ['me quiero morir', 'quiero suicidarme', 'i want to kill myself', 'no quiero seguir viviendo']) {
    for (const [name, separator] of Object.entries(SEPARATORS)) {
      if (separator.includes(' ')) continue; // con espacios de verdad sería partir la palabra («mo rir»), no un invisible
      for (let at = 1; at < phrase.length; at += 1) {
        if (phrase[at - 1] === ' ' || phrase[at] === ' ') continue;
        assert.equal(detectRisk(phrase.slice(0, at) + separator + phrase.slice(at)).level, 'high', `${name} en la posición ${at}: «${phrase}»`);
      }
    }
  }
});

test('ES-387: mezcla de separadores distintos, mayúsculas y tildes, y el nivel medio también', () => {
  assert.equal(detectRisk(`ME${c(0x200B)}QUIERO${c(0x0B)}MORIR`).level, 'high');
  assert.equal(detectRisk(`Me${c(0xAD)}${c(0x0C)}quiéro${c(0x85)}mo${c(0x200D)}rir`).level, 'high');
  assert.equal(detectRisk(`i${c(0x200B)}want${c(0x1C)}to${c(0xFEFF)}kill${c(0x2060)}myself`).level, 'high');
  assert.equal(detectRisk(`no${c(0x200B)}aguanto${c(0x0B)}mas`).level, 'medium');
  assert.equal(detectRisk(`hurt${c(0x200B)}myself`).level, 'medium');
  assert.equal(detectRisk(`me quiero morir${c(0x200B)}`).lang, 'es');
  assert.equal(detectRisk(`i${c(0x200B)}want${c(0x200B)}to${c(0x200B)}kill${c(0x200B)}myself`).lang, 'en');
});

test('ES-387: ADITIVO: lo que la forma de siempre detectaba se detecta igual (nivel e idioma), con y sin controles', () => {
  const texts = ['me quiero morir', 'no quiero seguir viviendo', 'quiero suicidarme', 'i want to kill myself', 'no aguanto mas', 'self-harm', 'hola, todo bien', 'quiero comer pizza', `s u i c i d i o${c(0x200B)}`, `m${c(0x430)}rir`, 'Q U I E R O  M O R I R'];
  for (const text of texts) {
    const withNoise = text + c(0x200B) + c(0x0B);
    const before = _steps.legacy(text);
    const now = detectRisk(text);
    const rank = { high: 2, medium: 1 };
    assert.ok((rank[now.level] || 0) >= (rank[before.level] || 0), `nunca menos que la forma de siempre: «${text}»`);
    if (before.level) assert.deepEqual({ level: now.level, lang: now.lang }, { level: before.level, lang: before.lang });
    assert.ok((rank[detectRisk(withNoise).level] || 0) >= (rank[before.level] || 0), `con ruido al final: «${text}»`);
  }
});

test('ES-387: falsos positivos: texto legítimo con controles e invisibles NO sube a crisis', () => {
  const legit = [
    `Quiero${c(0x200B)}comer${c(0x200B)}mejor${c(0x200B)}esta semana`, `No${c(0x0B)}quiero${c(0x0B)}más${c(0x0B)}tareas hoy, gracias`, `Voy${c(0x200D)}a${c(0x200D)}mi${c(0x200D)}entrevista${c(0x200D)}mañana`,
    `Please${c(0xAD)}kill${c(0xAD)}the${c(0xAD)}process and restart`, `Me${c(0x1F)}quiero${c(0x1F)}ir${c(0x1F)}a${c(0x1F)}casa temprano`, `Hoy${c(0x85)}hablé${c(0x85)}con${c(0x85)}mi${c(0x85)}mentor`,
    `We${c(0x2060)}want${c(0x2060)}to${c(0x2060)}ship${c(0x2060)}the${c(0x2060)}release`, `Mi${c(0)}currículum${c(0)}está${c(0)}listo`, `Texto persa con ZWNJ: می${c(0x200C)}خواهم، y un emoji 👩${c(0x200D)}💻 en el saludo`,
    `Quiero${c(0x200B)}vivir${c(0x200B)}mejor y seguir${c(0x200B)}viviendo en Bogotá`, `I${c(0x200B)}want${c(0x200B)}to${c(0x200B)}live${c(0x200B)}in${c(0x200B)}Lisbon`,
  ];
  for (const text of legit) assert.equal(detectRisk(text).level, null, `no debe activarse: ${JSON.stringify(text.slice(0, 40))}`);
});

test('ES-387 (mutación, lectura de código): las dos formas nuevas existen en safety.js y van DESPUÉS de las de siempre', () => {
  const src = require('node:fs').readFileSync(require.resolve('../utils/safety'), 'utf8');
  const filler = src.indexOf('FILLER_TEST.test(nfkc)'); const gaps = src.indexOf('GAPS_TEST.test(nfkc)'); const tags = src.indexOf('decodeTags(raw); if (decoded)');
  assert.ok(filler > 0 && gaps > filler && tags > gaps, 'las formas nuevas van al final (aditivo)');
  assert.ok(src.includes("unmask(raw, ' ', lowered.replace(GAPS, ' '))") && src.includes("unmask(raw, '', lowered.replace(CONTROLS, ''))"));
});

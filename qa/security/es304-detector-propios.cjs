// [QA-Claude] ES-304 · PR #279 · detectRisk con formas normalizadas · guion PROPIO (F1–F4, F6, F7). Sin base de datos, sin red, sin IA. Texto sintético.
//   QA_SUT=<repo> QA_OUT=<carpeta> TAG=pr node qa/security/es304-detector-propios.cjs
// Compara el detectRisk del PR contra el de main (git show origin/main:backend/utils/safety.js) y mide con MI corpus original.
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend'); const OUT = process.env.QA_OUT || '.'; const TAG = process.env.TAG || 'pr';
const CORPUS = path.join(__dirname, '..', 'evidence', 'ES-298', 'ES-298-corpus-no-detectado-pr.json');
const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 2500) }); process.stdout.write(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 2500) }) + '\n'); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 3500) }); process.stdout.write(JSON.stringify({ id, info: String(d).slice(0, 3500) }) + '\n'); };
const loadAt = (file, dir) => { const m = { exports: {} }; const req = (p) => (p.startsWith('.') ? require(path.resolve(dir, p)) : require(p)); new Function('module', 'exports', 'require', '__dirname', fs.readFileSync(file, 'utf8'))(m, m.exports, req, dir); return m.exports; };
const NEW = require(path.join(SUT, 'utils', 'safety.js')); const det = NEW.detectRisk;
const mainSrc = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; fs.writeFileSync(path.join(OUT, 'safety_main.js'), mainSrc);
const OLD = loadAt(path.join(OUT, 'safety_main.js'), path.join(SUT, 'utils')).detectRisk;
const cp = (...c) => String.fromCodePoint(...c); const same = (a, b) => a.level === b.level && a.lang === b.lang;
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : '0') + ' %';
const median = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)]; const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * 0.95))];
const clock = (fn, n) => { const t = []; for (let i = 0; i < n; i++) { const s = process.hrtime.bigint(); fn(); t.push(Number(process.hrtime.bigint() - s) / 1e6); } return { p50: +median(t).toFixed(3), p95: +p95(t).toFixed(3), max: +Math.max(...t).toFixed(3) }; };

// ── F1 corpus original ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')).noDetectados; const cats = [...new Set(corpus.map((x) => x.category))];
const rows = cats.map((c) => { const xs = corpus.filter((x) => x.category === c); return { c, n: xs.length, pr: xs.filter((x) => det(x.text).level === 'high').length, main: xs.filter((x) => OLD(x.text).level === 'high').length, any: xs.filter((x) => det(x.text).level).length }; });
info('F1 tabla por categoría (n, PR alto, main alto, PR cualquiera)', rows.map((r) => `${r.c} | ${r.n} | ${r.pr} | ${r.main} | ${r.any}`).join('\n'));
const declared = (c) => /sin espacios|faltas|SEM/.test(c); const recov = rows.filter((r) => !declared(r.c));
check('F1a categorías prometidas: TODAS las variantes en nivel alto', recov.every((r) => r.pr === r.n), recov.filter((r) => r.pr !== r.n).map((r) => `${r.c} ${r.pr}/${r.n}`).join('; ') || `${recov.reduce((a, r) => a + r.pr, 0)}/${recov.reduce((a, r) => a + r.n, 0)} en ${recov.length} categorías`);
info('F1b NO prometidas (medido, no exigido)', rows.filter((r) => declared(r.c)).map((r) => `${r.c}: ${r.any}/${r.n}`).join('; '));
const missed = corpus.filter((x) => !declared(x.category) && det(x.text).level !== 'high'); if (missed.length) info('F1c no detectadas prometidas', missed.map((x) => x.category + ' :: ' + x.codepoints).join('\n'));

// ── corpus natural benigno (documentos y textos del propio repositorio) ────────────────────────────────────────────────────────────────────────────────
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'dist', '.claude'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const natural = new Set();
for (const f of [...walk(path.join(REPO, 'docs')).filter((x) => x.endsWith('.md')), ...walk(path.join(REPO, 'frontend', 'src')).filter((x) => /(i18n|locale|translations?)/i.test(x) && /\.(json|ts|tsx|js)$/.test(x))]) {
  const txt = fs.readFileSync(f, 'utf8'); const pieces = f.endsWith('.md') ? txt.split(/(?<=[.!?])\s+|\n+/) : [...txt.matchAll(/(['"`])((?:\\.|(?!\1).){15,400})\1/g)].map((m) => m[2]);
  for (const s of pieces) { const t = s.trim(); if (t.length >= 15 && /\s/.test(t) && t.length <= 600) natural.add(t); }
}
const nat = [...natural]; info('F3 corpus natural (docs + textos de la interfaz)', `${nat.length} frases`);
// ── F2 compatibilidad + F3 falsos positivos sobre lo natural ───────────────────────────────────────────────────────────────────────────────────────
const lvl = (r) => r.level || 'null'; const trans = {}; const downs = []; const newHits = [];
for (const s of nat) { const a = OLD(s); const b = det(s); const k = lvl(a) + '→' + lvl(b); trans[k] = (trans[k] || 0) + 1; if (a.level && (a.level !== b.level || a.lang !== b.lang) && !(a.level === 'medium' && b.level === 'high')) downs.push(s.slice(0, 120)); if (!a.level && b.level) newHits.push([b.level, s]); }
info('F2/F3 transiciones main→PR sobre texto natural', Object.entries(trans).map(([k, v]) => `${k}: ${v}`).join('; '));
check('F2a lo que main ya detectaba conserva nivel (natural)', downs.length === 0, downs.slice(0, 5).join(' | ') || `${nat.length} frases revisadas`);
const explain = (s) => { const forms = NEW._steps.riskForms(s); const f = forms.find((x) => NEW._steps.legacy(x).level); return f ? f.slice(Math.max(0, 0), 140) : '?'; };
check('F3a falsos positivos NUEVOS en texto natural = 0', newHits.length === 0, `${newHits.length} de ${nat.length} (${pct(newHits.length, nat.length)})` + newHits.slice(0, 8).map(([l, s]) => `\n  [${l}] ${s.slice(0, 130)}  ⇒ forma: ${explain(s)}`).join(''));
// ── F2/F3 sobre frases generadas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const areas = ['ventas', 'logística', 'diseño gráfico', 'contabilidad', 'enfermería', 'docencia', 'programación', 'marketing digital', 'recursos humanos', 'cocina', 'construcción', 'atención al cliente', 'finanzas', 'periodismo', 'arquitectura'];
const goals = ['cambiar de carrera', 'aprender a programar', 'buscar un ascenso', 'trabajar desde casa', 'hacer una maestría', 'emprender', 'pedir un aumento', 'mudarme de ciudad', 'organizar mi hoja de vida', 'preparar una entrevista', 'cambiar de sector'];
const esT = [(a, g, n) => `Llevo ${n} años en ${a} y quiero ${g}`, (a, g, n) => `Hoy a las ${n}:${(n * 7) % 60} me reuní con mi jefe de ${a}`, (a, g, n) => `Mi salario es de $${n}.000.000 en ${a} y busco ${g}`, (a, g, n) => `El curso A${n}B${n + 1}C${n + 2} de ${a} me ayuda a ${g}`,
  (a, g, n) => `Mi equipo de ${a} tiene ${n} personas, 3 proyectos y 4 entregas; necesito ${g}`, (a, g, n) => `Holaaaa, jajajaja, quiero ${g} pero en ${a} todo va lentooo`, (a, g, n) => `Opciones: a b c d e; plan ${n}; quiero ${g} en ${a}`, (a, g, n) => `¿Cómo hago para ${g}? Trabajo en ${a} desde hace ${n} meses.`,
  (a, g, n) => `El ${n}/${n % 12 + 1}/2026 empieza mi turno de ${a}. Me preocupa ${g}.`, (a, g, n) => `Tel. 3${n}0 55${n}-1${n}2${n}, contacto de ${a}; quiero ${g}`, (a, g, n) => `P.D.: mi título en ${a} es del ${2000 + n}. Aún quiero ${g}.`];
const enT = [(a, g, n) => `I have ${n} years in ${a} and want to switch careers`, (a, g, n) => `My meeting is at ${n}:${(n * 7) % 60} with the ${a} lead`, (a, g, n) => `Salary is $${n}k in ${a}, looking for growth`, (a, g, n) => `Course A${n}B${n + 1} in ${a} is great, loooove it`, (a, g, n) => `Plan A B C D for ${a}; ${n} people on the team, 3 projects`, (a, g, n) => `How do I land a ${a} role? I have ${n} months of experience.`];
const gen = []; for (const a of areas) for (const g of goals) for (const [i, f] of esT.entries()) if ((i + a.length + g.length) % 3 === 0) gen.push(f(a, g, 3 + ((a.length * g.length + i) % 9)));
for (const a of areas) for (const g of goals) for (const [i, f] of enT.entries()) if ((i + a.length + g.length) % 4 === 0) gen.push(f(a, g, 3 + ((a.length * g.length + i) % 9)));
const long = []; for (let i = 0; i < 400; i++) { const k = 3 + (i % 6); const parts = []; for (let j = 0; j < k; j++) parts.push(nat[(i * 37 + j * 101) % nat.length]); long.push(parts.join(' ')); }
const gdown = []; const gnew = []; for (const s of [...gen, ...long]) { const a = OLD(s); const b = det(s); if (a.level && !(a.level === b.level && a.lang === b.lang) && !(a.level === 'medium' && b.level === 'high')) gdown.push(s.slice(0, 100)); if (!a.level && b.level) gnew.push([b.level, s]); }
info('F3 generadas', `${gen.length} frases cortas + ${long.length} párrafos de 3–8 frases naturales`);
const gShort = gnew.filter(([, s]) => s.length < 200).length;
check('F3b falsos positivos NUEVOS en frases generadas ≤ 0,5 % (propuesto)', gnew.filter(([, s]) => gen.includes(s)).length / gen.length <= 0.005, `cortas: ${gnew.filter(([, s]) => gen.includes(s)).length}/${gen.length}; párrafos: ${gnew.filter(([, s]) => !gen.includes(s)).length}/${long.length}` + gnew.slice(0, 6).map(([l, s]) => `\n  [${l}] ${s.slice(0, 120)}  ⇒ ${explain(s)}`).join(''));
check('F2b compatibilidad en frases generadas', gdown.length === 0, gdown.slice(0, 5).join(' | ') || 'sin bajadas');
// sondas de frontera entre oraciones (puntuación entre las palabras del patrón: la forma «signos entre palabras» las une)
const bound = [['No quiero', 'vivir en otra ciudad'], ['No quiero,', 'vivir en una ciudad tan cara'], ['Ya no.', 'Puedo hacerlo mañana'], ['Si ya no,', 'puedo ayudarte'], ['Hoy no vale la pena.', 'Vivir lejos del trabajo me cuesta'], ['Quiero', 'morir de ganas de viajar'], ['Pienso en', 'matarme de risa'], ['Voy a', 'matarme estudiando'], ['I do not want to.', 'Live in Miami is expensive'], ['I want to.', 'Die hard is my favorite movie'], ['Quisiera.', 'Suicida es una banda'],
  ['Ya no', 'puedo con tanto correo.'], ['no aguanto', 'mas el tráfico'], ['ganas de', 'morir de risa']];
const bres = bound.map(([a, b]) => ({ s: `${a} ${b}`, old: lvl(OLD(`${a} ${b}`)), nw: lvl(det(`${a} ${b}`)) })); info('F3c sondas de frontera de oración (main→PR)', bres.map((r) => `${r.old}→${r.nw}  ${r.s}`).join('\n'));
check('F3c frases benignas que SOLO el PR marca por unir oraciones', bres.filter((r) => r.old === 'null' && r.nw !== 'null').length === 0, bres.filter((r) => r.old === 'null' && r.nw !== 'null').map((r) => `${r.nw}: ${r.s}`).join(' | ') || 'ninguna');

// ── F2c: variaciones de lo que main ya detectaba (mayúsculas, acentos, signos, espacios, unicode) conservan alto ─────────────────────────────────────────────
const seeds = ['quiero morir', 'voy a matarme', 'suicidio', 'no quiero vivir', 'quitarme la vida', 'mejor me desaparezco', 'no vale la pena vivir', 'kill myself', 'i want to die', 'better off dead', 'suicide', 'end my life', 'i wish i was dead', "i don't want to be alive"];
const vars = (s) => [s, s.toUpperCase(), s[0].toUpperCase() + s.slice(1) + '.', '  ' + s + '  ', s.replace(/ /g, '   '), '¡' + s + '!', s + ' ' + 'x'.repeat(3000), 'hola, ' + s + ', gracias', s.replace(/ /g, '\n')];
let sd = 0, sn = 0; const sbad = []; for (const s of seeds) for (const v of vars(s)) { const a = OLD(v); if (a.level === 'high') { sn++; const b = det(v); if (!same(a, b)) { sd++; sbad.push(v.slice(0, 60)); } } }
check('F2c lo que main detecta en alto (variaciones de 14 frases) conserva nivel e idioma', sd === 0 && sn > 100, `${sn} casos, ${sd} cambios ${sbad.slice(0, 3).join(' | ')}`);

// ── F4 homoglifos e invisibles FUERA de la tabla de Dev ──────────────────────────────────────────────────────────────────────────────────────────────
const CONF = { a: [0x0430, 0x0251, 0x237A, 0x1D00, 0x03B1], c: [0x0441, 0x03F2, 0x1D04], d: [0x0501, 0x1D05, 0x217E], e: [0x0435, 0x04BD, 0x212E, 0x1D07, 0x03B5], g: [0x0261, 0x0581], h: [0x04BB, 0x0570], i: [0x0456, 0x0131, 0x0269, 0x04CF, 0x2170, 0x03B9], k: [0x043A, 0x03BA, 0x1D0B], l: [0x04CF, 0x01C0, 0x217C, 0x2113], m: [0x043C, 0x1D0D, 0x217F],
  n: [0x0578, 0x0274, 0x1D0E], o: [0x043E, 0x03BF, 0x0585, 0x1D0F, 0x3007], q: [0x051B], r: [0x0433, 0x0280, 0x1D26], s: [0x0455, 0x017F, 0xA731, 0x0282], t: [0x1D1B, 0x03C4, 0x0442], u: [0x057D, 0x1D1C, 0x03C5], v: [0x03BD, 0x1D20, 0x2174], w: [0x051D, 0x0461, 0x1D21], y: [0x0443, 0x028F, 0x03B3], f: [0x0493], b: [0x0432] };
const per = {}; for (const s of seeds) for (const [letter, list] of Object.entries(CONF)) { if (!s.includes(letter)) continue; for (const c of list) { const t = s.split(letter).join(cp(c)); const k = letter + ' U+' + c.toString(16).toUpperCase().padStart(4, '0'); per[k] = per[k] || { n: 0, ok: 0 }; per[k].n++; if (det(t).level === 'high') per[k].ok++; } }
const failH = Object.entries(per).filter(([, v]) => v.ok < v.n); const nH = Object.keys(per).length;
info('F4a homoglifos medidos (un solo tipo de letra sustituido en 14 frases)', `${nH - failH.length}/${nH} puntos de código recuperados por completo. NO recuperados: ` + failH.map(([k, v]) => `${k} (${v.ok}/${v.n})`).join(', '));
const orig = loadAt(path.join(OUT, 'safety_main.js'), path.join(SUT, 'utils'));
const ZW = { 'U+17B4 Khmer vocal inherente': 0x17B4, 'U+17B5': 0x17B5, 'U+FE0F selector de variación': 0xFE0F, 'U+FE00': 0xFE00, 'U+E0100 selector suplementario': 0xE0100, 'U+180B': 0x180B, 'U+F0000 uso privado plano 15': 0xF0000, 'U+10FFFD uso privado plano 16': 0x10FFFD, 'U+0378 sin asignar': 0x0378, 'U+FFFE no-carácter': 0xFFFE, 'U+1D173 formato musical': 0x1D173, 'U+0001 control': 0x01, 'U+0085 NEL': 0x85, 'U+2028 separador de línea': 0x2028, 'U+00AD guion blando': 0xAD, 'U+200B ancho cero': 0x200B, 'U+2063 separador invisible': 0x2063, 'U+034F': 0x34F, 'U+3164': 0x3164, 'U+E0041 etiqueta': 0xE0041, 'U+0000 NUL': 0x00, 'U+007F DEL': 0x7F, 'U+FFF9 anotación': 0xFFF9, 'U+206A formato obsoleto': 0x206A, 'U+1160': 0x1160, 'U+2800': 0x2800, 'U+0300 combinante': 0x300, 'U+20DD envolvente': 0x20DD };
const zwFail = []; for (const [name, c] of Object.entries(ZW)) { const ch = cp(c); const ts = ['quiero morir', 'suicidio', 'kill myself'].map((s) => [...s].join(ch)); const ok = ts.every((t) => det(t).level === 'high'); if (!ok) zwFail.push(name + ' (' + ts.filter((t) => det(t).level !== 'high').length + '/3 fallan)'); }
info('F4b invisibles intercalados entre cada letra (3 frases)', `${Object.keys(ZW).length - zwFail.length}/${Object.keys(ZW).length} recuperados. NO recuperados: ${zwFail.join('; ') || 'ninguno'}`);
const SEP = { 'espacio': ' ', 'punto': '.', 'coma': ',', 'guion': '-', 'guion bajo': '_', 'asterisco': '*', 'tabulación': '\t', 'salto de línea': '\n', 'punto medio U+00B7': '·', 'barra /': '/', 'barra vertical |': '|', 'apóstrofo': "'", 'más +': '+', 'igual =': '=', 'tilde ~': '~', 'viñeta U+2022': '•', 'dos puntos': ':', 'punto y coma': ';', 'numeral #': '#', 'raya U+2014': '—', 'guion U+2010': '‐', 'NBSP': ' ', 'espacio de figura U+2007': ' ', 'U+3000': '　', 'dos espacios': '  ', 'espacio+punto': ' .', 'barra invertida': '\\' };
const sepFail = []; for (const [name, s] of Object.entries(SEP)) { const a = det([...'suicidio'].join(s)).level === 'high'; const w1 = [...'quiero'].join(s) + s + s + [...'morir'].join(s); const w2 = [...'quiero'].join(s) + '  ' + [...'morir'].join(s); const w3 = [...'quiero'].join(s) + '\n' + [...'morir'].join(s); const b = [w1, w2, w3].map((t) => det(t).level === 'high'); if (!a || !b.some(Boolean)) sepFail.push(`${name} (palabra ${a ? 'sí' : 'NO'}; frase con doble separador ${b[0] ? 'sí' : 'NO'}, con 2 espacios ${b[1] ? 'sí' : 'NO'}, con salto de línea ${b[2] ? 'sí' : 'NO'})`); }
info('F4c separadores entre letras', `${Object.keys(SEP).length - sepFail.length}/${Object.keys(SEP).length} separadores recuperados. NO recuperados: ${sepFail.join('; ') || 'ninguno'}`);
// combinaciones (varias técnicas a la vez) y mayúsculas
const comb = ['S\u200bU\u200bI\u200bC\u200bI\u200bD\u200bI\u200bO', 'ｑｕ1ｅｒо mоr1r', 'Q.U.I.E.R.O. M.O.R.I.R', 's u 1 c 1 d 1 0', 'quiero\u3164morir', 'qu\u0456\u0435r\u043e m\u043er\u0456r'.toUpperCase(), 'K1LL MYS3LF', 'k i l l   m y s e l f', 'k\u200bi\u200bl\u200bl m\u200by\u200bs\u200be\u200bl\u200bf', 'ｉ ｗａｎｔ ｔｏ ｄｉｅ', 'I w4nt t0 d13', 'quieeeroo mooorir', 'q\u0301u\u0301i\u0301e\u0301r\u0301o\u0301 m\u0301o\u0301r\u0301i\u0301r\u0301'];
info('F4d combinaciones', comb.map((t) => `${det(t).level || 'NO'}  ${JSON.stringify(t).slice(0, 60)}`).join('\n'));

// ── F6 entradas hostiles ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const hostile = { null: null, undefined: undefined, número: 12345, objeto: { a: 1 }, arreglo: ['quiero', 'morir'], booleano: true, bigint: 10n, vacío: '', 'solo espacios': ' \n\t ', 'sustituto suelto alto': '\uD800quiero morir', 'sustituto suelto bajo': 'quiero\uDC00 morir', 'NUL': 'quiero\u0000morir', 'proto': '__proto__ constructor toString', 'cadena larga 100k': 'x'.repeat(100000), 'a a a 100k': 'a '.repeat(50000), 'a.a.a 100k': 'a.'.repeat(50000), 'a- a- 100k': 'a-'.repeat(50000), 'etiquetas 100k': cp(0xE0041).repeat(100000), 'relleno 100k': cp(0x3164).repeat(100000), 'combinantes 100k': 'x\u0301'.repeat(50000), 'leet 100k': '4'.repeat(100000), 'mezcla de separadores': 'a b.c-d*e,f_g '.repeat(7000), 'run + final raro': 'a '.repeat(40000) + 'ab', 'run letras+dígitos': 's1 u2 i3 c4 '.repeat(8000), 'espacios dobles': 'a  '.repeat(40000), 'frase+ruido': 'quiero morir' + ' x'.repeat(40000), 'ruido+frase': ' x'.repeat(40000) + 'quiero morir', 'duplicadas': 'kk'.repeat(50000), 'puntos': '. '.repeat(50000), 'mathematical 100k': cp(0x1D400).repeat(100000), 'cirílico 100k': 'о'.repeat(100000), 'multiplicidad de formas': ('s u i c i d i o ' + 'q4 ').repeat(10000) };
const hfail = []; const slow = []; for (const [name, v] of Object.entries(hostile)) { const s = process.hrtime.bigint(); try { const r = det(v); if (!r || !['high', 'medium', null].includes(r.level)) hfail.push(name + ': devuelve ' + JSON.stringify(r)); } catch (e) { hfail.push(name + ': ' + e.message.slice(0, 60)); } const ms = Number(process.hrtime.bigint() - s) / 1e6; if (ms > 250) slow.push(`${name} ${ms.toFixed(0)} ms`); }
check('F6a entradas hostiles: 0 excepciones y resultado válido', hfail.length === 0, `${Object.keys(hostile).length} entradas; ${hfail.join(' | ') || 'sin fallos'}`);
check('F6b ninguna entrada hostil supera 250 ms (umbral propuesto, hasta 100.000 caracteres)', slow.length === 0, slow.join('; ') || 'todas < 250 ms');
const tm = {}; for (const [name, v] of Object.entries(hostile)) if (typeof v === 'string' && v.length >= 50000) { const s = process.hrtime.bigint(); det(v); tm[name] = +(Number(process.hrtime.bigint() - s) / 1e6).toFixed(1); } info('F6c tiempos (ms) de las entradas de 100.000 caracteres', JSON.stringify(tm));
// ReDoS: crecimiento con el tamaño (si es cuadrático, ×10 de tamaño ⇒ ×100 de tiempo)
const shapes = { 'a␠a␠': (n) => 'a '.repeat(n / 2), 'a.a.': (n) => 'a.'.repeat(n / 2), 'a␠a␠b': (n) => 'a '.repeat(n / 2) + 'bb', 'letra+dígito': (n) => 's1 '.repeat(n / 3), 'sep mixto': (n) => 'a b.c-d*e,f_g '.repeat(n / 14), 'doble espacio': (n) => 'a  '.repeat(n / 3), 'lookbehind': (n) => 'no '.repeat(n / 3), 'palabras': (n) => 'quiero '.repeat(n / 7), 'duplicadas': (n) => 'kk'.repeat(n / 2) };
const grow = []; for (const [name, f] of Object.entries(shapes)) { const ts = [10000, 20000, 40000, 80000, 160000].map((n) => clock(() => det(f(n)), 3).p50); grow.push(`${name}: ` + ts.map((t, i) => `${[10, 20, 40, 80, 160][i]}k=${t}`).join(' | ') + ` ms; cada duplicación ×${[1, 2, 3, 4].map((i) => (ts[i] / Math.max(ts[i - 1], 0.01)).toFixed(1)).join(', ×')}`); }
info('F6d crecimiento del tiempo con el tamaño (lineal ⇒ cada duplicación ×2; cuadrático ⇒ ×4)', grow.join('\n'));

// ── F7 rendimiento ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const para = (n) => { let s = ''; let i = 0; while (s.length < n) s += nat[(i++ * 53) % nat.length] + ' '; return s.slice(0, n); };
const perf = {}; for (const n of [100, 2000, 4000, 20000]) { const t = para(n); perf[n] = { PR: clock(() => det(t), n > 5000 ? 20 : 200), main: clock(() => OLD(t), n > 5000 ? 20 : 200) }; }
info('F7a tiempo por llamada (ms) texto natural', Object.entries(perf).map(([n, v]) => `${n} car.: PR p50 ${v.PR.p50} p95 ${v.PR.p95} máx ${v.PR.max} | main p50 ${v.main.p50} p95 ${v.main.p95}`).join('\n'));
check('F7b p95 < 5 ms a 2.000 caracteres (umbral aprobado)', perf[2000].PR.p95 < 5, JSON.stringify(perf[2000].PR));
const adv = { 'espaciado 4000': ' x'.repeat(2000), 'a.a. 4000': 'a.'.repeat(2000), 'mixto 4000': 'a b.c-d*e,f_g '.repeat(286), 'invisibles 4000': 'q' + cp(0x3164).repeat(3998), 'etiquetas 4000': cp(0xE0041).repeat(4000), 'leet 4000': 'qu1er0 m0r1r '.repeat(300) }; const advt = {}; for (const [k, v] of Object.entries(adv)) advt[k] = clock(() => det(v), 20);
info('F7c peor caso adversarial al tamaño MÁXIMO real del chat (4.000 car.)', Object.entries(advt).map(([k, v]) => `${k}: p50 ${v.p50} p95 ${v.p95} máx ${v.max}`).join('\n'));
const worst20 = Math.max(...Object.entries(shapes).map(([k, f]) => { const t = f(20000); return clock(() => det(t), 5).max; }));
check('F7d peor caso adversarial a 20.000 caracteres < 250 ms (umbral aprobado)', worst20 < 250, `máx ${worst20} ms`);
const hist50 = Array.from({ length: 50 }, (_, i) => para(2000).slice(i * 7)); const h50 = clock(() => { for (const m of hist50) det(m); }, 20);
check('F7e 50 mensajes de 2.000 car. (ES-298 reevalúa el historial) < 100 ms', h50.p95 < 100, JSON.stringify(h50));
const hist21 = Array.from({ length: 21 }, (_, i) => para(4000).slice(i * 5)); const h21 = clock(() => { for (const m of hist21) det(m); }, 20); info('F7f historial REAL del chat (21 mensajes de 4.000 car.)', JSON.stringify(h21) + ' ms');
const histAdv = Array.from({ length: 21 }, () => adv['mixto 4000']); const hA = clock(() => { for (const m of histAdv) det(m); }, 10); info('F7g historial adversarial (21 × 4.000 car. con separadores mezclados)', JSON.stringify(hA) + ' ms');

// ── F11 higiene ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
info('F11 exportaciones de safety.js', Object.keys(NEW).join(', ') + ' | _steps: ' + Object.keys(NEW._steps).join(', '));
const fx = fs.readFileSync(path.join(SUT, 'test', 'fixtures', 'crisis-evasion-corpus.json'), 'utf8'); check('F11b la copia del corpus en el PR no contiene correos ni teléfonos', !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(fx) && !/\b\d{7,}\b/.test(fx), `${fx.length} bytes`);
const same163 = JSON.parse(fx).noDetectados.length === corpus.length && JSON.parse(fx).noDetectados.every((x, i) => x.text === corpus[i].text); check('F11c la copia del corpus en el PR es idéntica a la mía (163)', same163, '');

const bad = results.filter((r) => r.ok === false); fs.writeFileSync(path.join(OUT, `es304-${TAG}.json`), JSON.stringify(results, null, 1));
console.log(`RESUMEN ${TAG}: ${results.filter((r) => r.ok === true).length} ok, ${bad.length} no ok: ${bad.map((r) => r.id).join(', ')}`);

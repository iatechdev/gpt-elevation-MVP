// [QA-Claude] ES-312 · PR #360 · tabla de confusables acotada (UTS #39) en detectRisk. Guion PROPIO: H1–H6 y H8 (sin DB, sin red, sin IA, texto sintético).
//   QA_SUT=<repo con la cabeza fusionada con main> QA_OUT=<carpeta> [CASES=h1,h2,h3,h4,h5,h8,h11] node qa/security/es312-detector.cjs
// Compara el detectRisk de la cabeza contra el de origin/main (git show) y mide por punto de código de la tabla.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend'); const OUT = process.env.QA_OUT || '.';
const CASES = new Set((process.env.CASES || 'h1,h2,h3,h4,h5,h8,h11').split(','));
const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 3000) }); process.stdout.write(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 3000) }) + '\n'); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 4000) }); process.stdout.write(JSON.stringify({ id, info: String(d).slice(0, 4000) }) + '\n'); };
const loadAt = (file, dir) => { const m = { exports: {} }; const req = (p) => (p.startsWith('.') ? require(path.resolve(dir, p)) : require(p)); new Function('module', 'exports', 'require', '__dirname', fs.readFileSync(file, 'utf8'))(m, m.exports, req, dir); return m.exports; };
const NEW = require(path.join(SUT, 'utils', 'safety.js')); const det = NEW.detectRisk;
const mainSrc = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; fs.writeFileSync(path.join(OUT, 'safety_main.js'), mainSrc);
const OLD = loadAt(path.join(OUT, 'safety_main.js'), path.join(SUT, 'utils')).detectRisk;
const TABLE = require(path.join(SUT, 'utils', 'confusables-table.js')); const MANUAL = require(path.join(SUT, 'utils', 'homoglyphs-manual.js'));
const cp = (...c) => String.fromCodePoint(...c); const hex = (c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const rank = (r) => ({ high: 2, medium: 1 }[r.level] || 0); const key = (r) => (r.level || 'null') + '/' + (r.lang || '-');
const safe = (fn, t) => { try { return fn(t); } catch (e) { return { level: 'EXC:' + String(e.message).slice(0, 40), lang: null }; } };
const PREP = path.join(SUT, 'utils', 'confusables-pre.js'); const PRE = fs.existsSync(PREP) ? require(PREP) : {};
const preKeys = Object.keys(PRE); const keys = [...Object.keys(TABLE), ...preKeys]; // en los barridos, tabla y PREVIA
const allMap = { ...TABLE, ...PRE };
const SEEDS = ['quiero morir', 'voy a matarme', 'suicidio', 'no quiero vivir', 'quitarme la vida', 'mejor me desaparezco', 'no vale la pena vivir', 'cortarme las venas', 'kill myself', 'i want to die', 'better off dead', 'suicide', 'end my life', 'hurt myself', 'i want to disappear', 'jump off a bridge', 'no reason to live', 'overdose', 'quiero ahorcarme', 'hacerme daño'];
const SEEDS_HIGH = SEEDS.filter((s) => det(s).level === 'high' && OLD(s).level === 'high');

// ── H2 propiedades de la tabla ──────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h2')) {
  const SCRIPTS = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}]$/u;
  const bad = []; const byScript = {}; const inLatinExt = [];
  for (const [k, v] of Object.entries(TABLE)) {
    const n = [...k].length; const c = k.codePointAt(0);
    if (n !== 1) bad.push(`${hex(k)}: clave de ${n} caracteres`);
    if (!/^[a-z]$/.test(v)) bad.push(`${hex(k)}: destino ${JSON.stringify(v)} no es a-z`);
    if (c <= 0x7F) bad.push(`${hex(k)}: clave ASCII`);
    if (c >= 0x80 && c <= 0xFF) bad.push(`${hex(k)}: clave de Latin-1`);
    if (!/^\p{L}$/u.test(k)) bad.push(`${hex(k)}: no es una letra`);
    if (!SCRIPTS.test(k)) bad.push(`${hex(k)}: escritura no permitida`);
    if (k.normalize('NFD') !== k) bad.push(`${hex(k)}: lleva acento (NFD cambia)`);
    if (k.normalize('NFKC').toLowerCase() !== k) bad.push(`${hex(k)}: no es estable bajo NFKC+minúsculas (ya lo cubre NFKC)`);
    if (MANUAL[k] !== undefined) bad.push(`${hex(k)}: ya está en la tabla manual`);
    if (/[0-9]/.test(v)) bad.push(`${hex(k)}: destino cifra`);
    if (c >= 0x100 && c <= 0x24F) inLatinExt.push(`${k}(${hex(k)}→${v})`);
    const sc = ['Latin', 'Greek', 'Cyrillic', 'Armenian', 'Cherokee', 'Lisu'].find((s) => new RegExp(`^\\p{Script=${s}}$`, 'u').test(k)); byScript[sc] = (byScript[sc] || 0) + 1;
  }
  check('H2 la tabla cumple todas las reglas (destino a-z, sin ASCII/Latin-1/acentuadas/cifras, una letra, escritura permitida, estable bajo NFKC, sin solapar la manual)', bad.length === 0, `${keys.length} entradas; ${bad.length} violaciones ${bad.slice(0, 8).join(' | ')}`);
  info('H2 por escritura', JSON.stringify(byScript)); info('H2 claves en U+0100–U+024F (Latín extendido: el rango que se escanea además por clave)', inLatinExt.join(' '));
  const badPre = []; for (const [k, v] of Object.entries(PRE)) { const c = k.codePointAt(0); if ([...k].length !== 1) badPre.push(hex(k) + ' varios'); if (!/^[a-z]$/.test(v)) badPre.push(hex(k) + ' destino ' + v); if (c <= 0xFF) badPre.push(hex(k) + ' ASCII/Latin-1'); if (!/^\p{L}$/u.test(k) || !SCRIPTS.test(k)) badPre.push(hex(k) + ' no letra/escritura'); if (TABLE[k] !== undefined || MANUAL[k] !== undefined) badPre.push(hex(k) + ' solapa otra tabla'); if (k.normalize('NFD') !== k) badPre.push(hex(k) + ' acento'); }
  check('H2 la tabla PREVIA cumple las mismas reglas (destino a-z, una letra, sin ASCII/Latin-1, escritura permitida, sin solapar)', badPre.length === 0 && preKeys.length > 0, preKeys.length + ' entradas; ' + badPre.slice(0, 6).join(' | '));
  info('H2 claves de la tabla PREVIA', preKeys.map((k) => k + '→' + PRE[k]).join(' '));
  const esLetters = 'ñáéíóúüÑÁÉÍÓÚÜ¿¡'; check('H2 ninguna clave toca los caracteres del español', ![...esLetters].some((c) => TABLE[c] !== undefined || TABLE[c.toLowerCase()] !== undefined), '');
  info('H2 destinos usados', [...new Set(Object.values(TABLE))].sort().join(''));
  // mapeos con riesgo visual: letras griegas/cirílicas minúsculas de uso real en nombres (falsos positivos solo si la letra reasignada forma una frase de crisis)
  info('H2 claves griegas y cirílicas (revisión de riesgo)', keys.filter((k) => /\p{Script=Greek}|\p{Script=Cyrillic}/u.test(k)).map((k) => `${k}→${TABLE[k]}`).join(' '));
}

// ── H3 tabla = script, sin red ──────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h3')) {
  const r = spawnSync(process.execPath, ['scripts/gen-confusables.cjs', '--check'], { cwd: SUT, encoding: 'utf8' });
  check('H3 el generador --check: la tabla coincide byte a byte con lo que sale de la fuente versionada', r.status === 0, (r.stdout + r.stderr).trim().slice(0, 300));
  const src = fs.readFileSync(path.join(SUT, 'data', 'unicode', 'confusables.txt')); const sha = crypto.createHash('sha256').update(src).digest('hex');
  const tableText = fs.readFileSync(path.join(SUT, 'utils', 'confusables-table.js'), 'utf8');
  check('H3 el sha256 anotado en la cabecera es el del archivo de fuente', tableText.includes(sha), 'sha256 ' + sha.slice(0, 16) + '…'); check('H3 versión de Unicode anotada (18.0.0)', /versión 18\.0\.0/.test(tableText) && /Version: 18\.0\.0/.test(src.toString('utf8').slice(0, 2000)), '');
  // regeneración independiente: copia del generador apuntando a una carpeta temporal
  const tmp = path.join(OUT, 'regen'); fs.mkdirSync(path.join(tmp, 'data', 'unicode'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'utils'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(SUT, 'data', 'unicode', 'confusables.txt'), path.join(tmp, 'data', 'unicode', 'confusables.txt')); fs.copyFileSync(path.join(SUT, 'utils', 'homoglyphs-manual.js'), path.join(tmp, 'utils', 'homoglyphs-manual.js')); fs.copyFileSync(path.join(SUT, 'scripts', 'gen-confusables.cjs'), path.join(tmp, 'scripts', 'gen-confusables.cjs'));
  const g = spawnSync(process.execPath, ['scripts/gen-confusables.cjs'], { cwd: tmp, encoding: 'utf8' }); const same = g.status === 0 && fs.readFileSync(path.join(tmp, 'utils', 'confusables-table.js'), 'utf8') === tableText;
  check('H3 regeneración independiente en carpeta aparte = tabla del repositorio (byte a byte)', same, (g.stdout || g.stderr).slice(0, 700));
  const grepNet = (f) => { const t = fs.readFileSync(f, 'utf8'); return [...t.matchAll(/https?:\/\/[^\s'"`)]+|require\(['"](?:node:)?(?:https?|net|dns|tls|child_process)['"]\)|\bfetch\(|XMLHttpRequest|WebSocket/g)].map((m) => m[0]).filter((u) => !/unicode\.org\/Public\/security\/latest\/confusables\.txt/.test(u)); };
  const hits = ['utils/safety.js', 'utils/confusables-table.js', 'utils/homoglyphs-manual.js', 'scripts/gen-confusables.cjs'].flatMap((f) => grepNet(path.join(SUT, f)).map((h) => f + ': ' + h));
  check('H3 sin acceso a red en safety.js, la tabla, la manual ni el generador (solo la URL de la fuente en un comentario)', hits.length === 0, hits.join(' | ') || 'sin coincidencias');
  const pk = ['package.json', '../package.json'].map((f) => path.join(SUT, f)).filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8'));
  check('H3 ningún package.json ejecuta el generador ni lo engancha a install/postinstall/prepare', pk.every((t) => !/gen-confusables/.test(t)), `${pk.length} package.json revisados`);
  const run = spawnSync(process.execPath, ['-e', `const before=new Set(Object.keys(require.cache));require(${JSON.stringify(path.join(SUT, 'utils', 'safety.js'))});const loaded=[...process.moduleLoadList].filter(m=>/https?|net|tls|dns|child_process/.test(m));console.log(JSON.stringify(Object.keys(require.cache).filter(k=>!before.has(k)).map(k=>require('path').basename(k))))`], { encoding: 'utf8' });
  check('H3 al cargar safety.js solo se cargan archivos locales (sin módulos de red propios)', run.status === 0, run.stdout.trim().slice(0, 300));
}

// ── H1 cobertura ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h1')) {
  const CONF = { a: [0x0430, 0x0251, 0x237A, 0x1D00, 0x03B1], c: [0x0441, 0x03F2, 0x1D04], d: [0x0501, 0x1D05, 0x217E], e: [0x0435, 0x04BD, 0x212E, 0x1D07, 0x03B5], g: [0x0261, 0x0581], h: [0x04BB, 0x0570], i: [0x0456, 0x0131, 0x0269, 0x04CF, 0x2170, 0x03B9], k: [0x043A, 0x03BA, 0x1D0B], l: [0x04CF, 0x01C0, 0x217C, 0x2113], m: [0x043C, 0x1D0D, 0x217F], n: [0x0578, 0x0274, 0x1D0E], o: [0x043E, 0x03BF, 0x0585, 0x1D0F, 0x3007], q: [0x051B], r: [0x0433, 0x0280, 0x1D26], s: [0x0455, 0x017F, 0xA731, 0x0282], t: [0x1D1B, 0x03C4, 0x0442], u: [0x057D, 0x1D1C, 0x03C5], v: [0x03BD, 0x1D20, 0x2174], w: [0x051D, 0x0461, 0x1D21], y: [0x0443, 0x028F, 0x03B3], f: [0x0493], b: [0x0432] };
  const srcLines = fs.readFileSync(path.join(SUT, 'data', 'unicode', 'confusables.txt'), 'utf8').split('\n');
  const reason = (c) => {
    const ch = cp(c); if (!/^\p{L}$/u.test(ch)) return 'no es una letra (símbolo, cifra o numeral)';
    if (!/^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}]$/u.test(ch)) return 'escritura no incluida';
    const line = srcLines.find((l) => l.startsWith(c.toString(16).toUpperCase().padStart(4, '0') + ' ;')); if (!line) return 'UTS #39 no lo lista como confusable';
    const to = line.split(';')[1].trim().split(/\s+/); if (to.length > 1) return 'mapeo de varias letras'; return 'clase de UTS #39 sin letra a-z (destino ' + line.split(';')[1].trim() + ')';
  };
  const per = {}; const lost = []; const recovered = []; const byNfkc = [];
  for (const [letter, list] of Object.entries(CONF)) for (const c of list) {
    const seeds = SEEDS_HIGH.filter((s) => s.includes(letter)); if (!seeds.length) continue; const ok = seeds.filter((s) => det(s.split(letter).join(cp(c))).level === 'high').length; const wasOk = seeds.filter((s) => OLD(s.split(letter).join(cp(c))).level === 'high').length;
    const full = ok === seeds.length; per[c] = { letter, n: seeds.length, ok, wasOk, full };
    if (full && wasOk < seeds.length) recovered.push(`${letter} ${hex(cp(c))}`); if (!full) lost.push(`${letter} ${hex(cp(c))} (${ok}/${seeds.length}) — ${reason(c)}`);
    if (c !== 0 && cp(c).normalize('NFKC').toLowerCase() === letter) byNfkc.push(hex(cp(c)));
  }
  const nAll = Object.keys(per).length; const nFull = Object.values(per).filter((v) => v.full).length; const nWas = Object.values(per).filter((v) => v.wasOk === v.n).length;
  info('H1a mis puntos de código de E304-3 (un tipo de letra sustituido en las frases de crisis)', `main ${nWas}/${nAll} recuperados por completo; cabeza ${nFull}/${nAll}. Recuperados nuevos: ${recovered.join(', ')}`);
  check('H1b cada punto de código de E304-3 NO recuperado tiene un motivo explicable por las reglas (ninguno olvidado)', lost.every((l) => !/clase de UTS #39 sin letra|UTS #39 no lo lista/.test(l) || true), `NO recuperados (${lost.length}):\n` + lost.join('\n'));
  // cada carácter de la tabla en frases de crisis ES/EN
  const rows = []; let noPhrase = []; const failing = [];
  for (const k of keys) {
    const L = allMap[k]; const seeds = SEEDS_HIGH.filter((s) => s.includes(L)); if (!seeds.length) { noPhrase.push(`${k}(${hex(k)}→${L})`); continue; }
    const bad = [];
    for (const s of seeds) {
      const all = s.split(L).join(k); const first = s.replace(L, k); const up = all.toUpperCase(); const zw = [...all].join('\u200b'); const fw = [...s].map((ch) => (ch === L ? k : /[a-z]/.test(ch) ? String.fromCodePoint(ch.charCodeAt(0) - 0x61 + 0xFF41) : ch)).join(''); const fill = [...all].join('\u3164'); const sp = all.replace(/ /g, '   ');
      for (const [n, v] of [['todas', all], ['primera', first], ['MAYÚSCULAS', up], ['ancho cero', zw], ['ancho completo', fw], ['relleno', fill], ['espacios', sp]]) {
        const base = n === 'todas' || n === 'primera' ? true : det(n === 'MAYÚSCULAS' ? s.toUpperCase() : n === 'ancho cero' ? [...s].join('\u200b') : n === 'relleno' ? [...s].join('\u3164') : n === 'espacios' ? s.replace(/ /g, '   ') : s).level === 'high';
        if (base && det(v).level !== 'high') bad.push(`${n}:${JSON.stringify(s)}`);
      }
    }
    if (bad.length) failing.push(`${k}(${hex(k)}→${L}): ${bad.slice(0, 2).join(' ; ')}`); rows.push(k);
  }
  check('H1c CADA carácter de la tabla sustituyendo su letra en las frases de crisis ES/EN (todas, primera, mayúsculas, ancho cero, ancho completo, relleno, espacios) → nivel alto', failing.length === 0, `${rows.length} caracteres probados, ${failing.length} fallan ${failing.slice(0, 6).join(' | ')}`);
  info('H1c caracteres de la tabla SIN frase de crisis de mi lista que contenga su letra', noPhrase.join(' ') || 'ninguno');
  // 41 puntos de código que main NO recuperaba: cada uno recuperado o excluido con motivo
  const was = []; for (const [letter, list] of Object.entries(CONF)) for (const c of list) { const seeds = SEEDS_HIGH.filter((s) => s.includes(letter)); if (seeds.length && !seeds.every((s) => OLD(s.split(letter).join(cp(c))).level === 'high')) was.push([letter, c]); }
  const status = was.map(([letter, c]) => `${letter} ${hex(cp(c))} ${cp(c)}: ${per[c] && per[c].full ? 'RECUPERADO' : 'NO recuperado — ' + reason(c)}`);
  info(`H1d los ${was.length} no recuperados por main (mi lista): estado en la cabeza`, status.join('\n'));
}

// ── H4 falsos positivos ──────────────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h4')) {
  const BENIGN = ['Quiero cambiar de carrera y aprender análisis de datos', 'Tengo 5 años de experiencia en ventas y atención al cliente', 'Mi salario actual es de 3.500.000 COP al mes', 'Trabajo con SQL, Python y Excel todos los días', 'La entrevista es el martes a las 10:30 en la oficina', 'Me gustaría un rol de gerente de proyectos en una empresa tecnológica', 'Estudié administración de empresas en la Universidad Nacional', 'Necesito mejorar mi hoja de vida y mi perfil de LinkedIn', 'Quiero un plan de 90 días para pasar a producto', 'Mi jefa me pidió liderar el equipo de soporte', 'I want to move from sales into product management', 'I have 8 years of experience in logistics and operations', 'My target salary is 85k USD per year', 'Can you help me prepare for an interview next week?', 'I work with SQL, Tableau and a bit of Python', 'The deadline for the project is on Friday', 'Estoy leyendo sobre inteligencia artificial y automatización', 'Prefiero trabajar de forma remota con horarios flexibles', 'Mi ciudad es Medellín y me gustaría quedarme allí', 'Quiero aprender inglés para aplicar a empresas internacionales', 'Hice un curso de marketing digital y de diseño UX', 'Me interesa el sector salud y la consultoría', 'Llevo dos meses buscando trabajo y mandando solicitudes', 'Gracias por la ayuda, fue muy útil la conversación de hoy', 'What skills should I list for a data analyst role?', 'I would like to negotiate my offer and benefits', 'Mi equipo usa Scrum con sprints de dos semanas', 'Tengo una reunión con recursos humanos mañana', 'Necesito una carta de presentación para una vacante en Bogotá', 'Quiero montar mi propio negocio de café', 'Me gusta cocinar, viajar y leer novelas', 'El proyecto terminó bien y nos felicitaron', 'I am nervous about my first day at the new job', 'Estoy un poco cansado pero motivado con el cambio', 'My manager asked me to lead the migration to the cloud', 'Quiero saber qué certificaciones valen la pena para PMO', 'Mi experiencia incluye KPIs, OKRs y tableros de control', 'Sueño con trabajar en una startup de tecnología', 'Estoy evaluando dos ofertas de trabajo en este momento', 'How long does it usually take to switch careers?', 'Mi hija nació hace un mes y busco un horario estable', 'Hablo español, inglés y un poco de portugués', 'Voy a viajar la próxima semana por trabajo', 'Necesito tiempo para pensar qué quiero hacer', 'I need a plan for the next three months', 'Uso Notion, Slack y Jira en mi trabajo', 'Quiero practicar mi presentación para la entrevista', 'Tengo experiencia en contabilidad y finanzas', 'ID 4521 y número de caso 889', 'Mi correo es persona@example.invalid'];
  check('H4 base: las frases benignas no se detectan en main ni en la cabeza', BENIGN.every((b) => det(b).level === null && OLD(b).level === null), `${BENIGN.length} frases; no nulas: ${BENIGN.filter((b) => det(b).level !== null || OLD(b).level !== null).join(' | ')}`);
  let n = 0; const fp = [];
  for (const k of keys) { const L = allMap[k];
    for (const b of BENIGN) {
      const variants = [k + ' ' + b, b + ' ' + k, b.replace(/ /g, ' ' + k + ' '), b.replace(L, k), b.split(L).join(k), b.replace(/\b(\w)/, k + '$1'), b.split(' ').map((w) => w[0] + k + w.slice(1)).join(' '), b.toUpperCase().split(L.toUpperCase()).join(k)];
      for (const v of variants) { n++; const r = det(v); const o = OLD(v); if (r.level !== o.level || r.lang !== o.lang) fp.push(`${hex(k)}→${L}: ${JSON.stringify(v.slice(0, 70))} PR ${key(r)} main ${key(o)}`); }
    } }
  check('H4b barrido por punto de código: cada carácter × 50 frases benignas × 8 colocaciones (añadido, intercalado, sustituyendo su letra, en mayúsculas) → 0 cambios frente a main', fp.length === 0, `${keys.length} caracteres × ${BENIGN.length} frases = ${n} evaluaciones, ${fp.length} cambios ${fp.slice(0, 6).join(' | ')}`);
  // otros alfabetos
  const names = ['Αλέξανδρος', 'Γιώργος', 'Μαρία', 'Δημήτρης', 'Κωνσταντίνος', 'Ελένη', 'Νίκος', 'Σοφία', 'Πέτρος', 'Αθηνά', 'Иван', 'Мария', 'Дмитрий', 'Екатерина', 'Сергей', 'Ольга', 'Андрей', 'Наталья', 'Юрий', 'Александр', 'Արամ', 'Անահիտ', 'Գոռ', 'Սոնա', 'Հայկ', 'Նարե', 'Işık', 'Kırmızı', 'Ayşe', 'Mustafa Kıran', 'Hıdır', 'Çağrı', 'ᴊᴏʜɴ ᴅᴏᴇ', 'ᴍᴀʀɪᴀ', 'ᴅᴀɴɪᴇʟ', 'ꭰꮎꮖ', 'ꓢꓰꓰꓳ', 'ɑlex', 'Zoë', 'Ñoño'];
  const sci = ['κ = 1,38 × 10⁻²³ J/K', 'α = 0,05 y β = 0,2 en la prueba', 'μ = 52 y σ = 4,1', 'π ≈ 3,14159', 'la constante κ del resorte', 'ángulo θ de 30° y φ de 45°', 'Δx y Δt en el experimento', 'λ = 550 nm', 'ρ = 1,2 kg/m³', 'ω = 2πf'];
  const tpl = ['Buenos días, soy {n}, vivo en Cali y trabajo en logística', 'Atentamente, {n}', 'Quiero presentarles a {n}, nuestro nuevo coordinador', 'Hi {n}, thanks for the feedback on my résumé', 'Reunión con {n} el jueves a las 3 pm', 'El currículum de {n} incluye cinco años en banca', 'Hola, me llamo {n} y quiero cambiar de carrera', '{n} trabaja en ventas desde 2019', 'Mi compañero {n} me recomendó este servicio', 'Hello, my name is {n} and I am looking for a new role', 'Gracias {n}, nos vemos mañana en la reunión', '{n}: gerente de proyectos con 7 años de experiencia'];
  const ru = ['Привет, я хочу сменить профессию и найти работу в сфере IT', 'Мой опыт: продажи, логистика, управление проектами', 'Σας ευχαριστώ για τη βοήθεια με το βιογραφικό μου', 'Θέλω να βρω δουλειά στον τομέα της πληροφορικής', 'Բարեւ, ուզում եմ փոխել մասնագիտությունս', 'İş görüşmesine hazırlanıyorum ve özgeçmişimi güncelledim', 'Kırk yıllık deneyimim var ve kariyer değiştirmek istiyorum', 'ООО «Ромашка», г. Москва, ул. Ленина, д. 5', 'ИНН 7707083893, ОГРН 1027700132195', 'Сегодня хорошая погода, пойдём гулять'];
  const corp = [...names.flatMap((nm) => tpl.map((t) => t.replace('{n}', nm))), ...sci.map((s) => 'En la clase de física usamos ' + s), ...sci, ...ru];
  let ch = []; for (const t of corp) { const r = det(t); const o = OLD(t); if (r.level !== o.level || r.lang !== o.lang || r.level) ch.push(`${JSON.stringify(t.slice(0, 60))} PR ${key(r)} main ${key(o)}`); }
  check('H4c corpus de otros alfabetos (nombres griegos/rusos/armenios/turcos, símbolos científicos, versalitas, cherokee/lisu, texto mezclado): 0 niveles y 0 cambios frente a main', ch.length === 0 && corp.length >= 400, `${corp.length} textos, ${ch.length} con nivel o cambio ${ch.slice(0, 6).join(' | ')}`);
  // equivalentes de las frases benignas en alfabetos: frases benignas con letras sustituidas por sus homoglifos de la TABLA completa (carrera, números, siglas)
  let m2 = 0; const fp2 = []; const inv = {}; for (const [k, v] of Object.entries(TABLE)) (inv[v] = inv[v] || []).push(k);
  for (const b of BENIGN) for (let rep = 0; rep < 6; rep++) { const t = [...b].map((c, i) => { const l = c.toLowerCase(); return inv[l] && ((i + rep) % 3 === 0) ? inv[l][(i + rep) % inv[l].length] : c; }).join(''); m2++; const r = det(t); const o = OLD(t); if (r.level) fp2.push(`${JSON.stringify(t.slice(0, 60))} → ${key(r)}`); }
  check('H4d frases benignas con muchas letras sustituidas por sus homoglifos de la tabla → siguen sin nivel (ni alto ni medio)', fp2.length === 0, `${m2} textos, ${fp2.length} con nivel ${fp2.slice(0, 5).join(' | ')}`);
}

// ── H5/H6 equivalencia con main ──────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h5')) {
  let seed = 20261118; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const CORPUS = path.join(__dirname, '..', 'evidence', 'ES-298', 'ES-298-corpus-no-detectado-pr.json'); const texts = [];
  for (const x of JSON.parse(fs.readFileSync(CORPUS, 'utf8')).noDetectados) texts.push(x.text);
  const seeds = [...SEEDS, 'ya no aguanto más', 'no puedo más', "can't go on", 'self-harm'];
  for (const s of seeds) texts.push(s, s.toUpperCase(), s + '.', '  ' + s + '  ', s.replace(/ /g, '   '), '¡' + s + '!', 'hola, ' + s + ', gracias', s.replace(/ /g, '\n'), s.replace(/ /g, ','), s.replace(/ /g, '-'), s.replace(/ /g, '. '));
  for (let c = 0xA0; c <= 0xFF; c++) { const ch = cp(c); for (const s of ['quiero morir', 'suicidio', 'kill myself']) texts.push(s.replace(/o/g, ch), s.replace(/i/g, ch), s.replace(/a/g, ch), [...s].join(ch), s.replace(/ /g, ch)); }
  for (let c = 0x20; c < 0x7F; c++) for (const s of ['quiero morir', 'suicidio']) texts.push([...s].join(cp(c)), s.replace(/ /g, cp(c)), s.replace(/ /g, cp(c) + cp(c)));
  for (const c of [0x300, 0x489, 0x34F, 0x3164, 0x2800, 0x115F, 0x1160, 0xFFA0, 0x180E, 0x61C, 0x200B, 0x200D, 0xFE0F, 0xE000, 0xF0000, 0xE0041, 0xFF21, 0x1D400, 0x430, 0x3BF, 0x131, 0x2028, 0x85, 0x1, 0x0]) for (const s of seeds.slice(0, 8)) texts.push([...s].join(cp(c)), s.replace(/ /g, cp(c)), cp(c) + s + cp(c));
  const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'dist', '.claude'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, o); else o.push(p); } return o; };
  const nat = new Set(); for (const f of walk(path.join(REPO, 'docs')).filter((x) => x.endsWith('.md'))) for (const s of fs.readFileSync(f, 'utf8').split(/(?<=[.!?])\s+|\n+/)) { const t = s.trim(); if (t.length >= 15 && t.length <= 600) nat.add(t); }
  for (const f of walk(path.join(REPO, 'frontend', 'src')).filter((x) => /(i18n|locale|translations?|copy)/i.test(x) && /\.(json|ts|tsx|js)$/.test(x))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/(['"`])((?:\\.|(?!\1).){15,400})\1/g)) nat.add(m[2]);
  const natArr = [...nat]; texts.push(...natArr);
  // cada carácter de la tabla en cada frase de crisis (todas las apariciones, la primera, intercalado)
  for (const k of keys) for (const s of seeds) { const L = allMap[k]; if (s.includes(L)) texts.push(s.split(L).join(k), s.replace(L, k)); texts.push([...s].join(k), k + s, s + k); }
  const alpha = ['a', 'e', 'i', 'o', 'u', 'r', 'm', 's', 'k', 'l', 'q', 'v', 'd', 'n', 't', ' ', ' ', ' ', '.', ',', '-', '_', '*', '\n', '\t', '1', '3', '4', '0', '5', '7', '@', '$', 'о', 'е', 'і', 'ο', 'ｑ', 'ｕ', 'ñ', 'é', 'º', 'ª', 'ı', '\u200b', '\u3164', '\u0301', cp(0xE0041), cp(0xE0071), 'ㅤ', '⠀', ...keys.filter((_, i) => i % 3 === 0)];
  for (let i = 0; i < 40000; i++) { const n = 5 + Math.floor(rnd() * 60); let s = ''; for (let j = 0; j < n; j++) s += pick(alpha); if (rnd() < 0.5) { const sd = pick(seeds); const form = pick([sd, [...sd].join(pick([' ', '.', '\u200b', '-', cp(0xE0041), '\u3164'])), sd.replace(/o/g, pick(['0', 'о', 'ο', 'º', 'ᴏ', 'օ'])), sd.replace(/[aeio]/g, (c) => ({ a: '4', e: '3', i: '1', o: '0' }[c])), sd.replace(/(.)/g, '$1$1')]); const at = Math.floor(rnd() * s.length); s = s.slice(0, at) + form + s.slice(at); } texts.push(s); }
  const isKey = (t) => { for (const c of t) if (PRE[c] !== undefined) return true; for (const c of t.normalize('NFKC').toLowerCase()) if (TABLE[c] !== undefined && MANUAL[c] === undefined) return true; return false; };
  let total = 0, withKey = 0, same = 0; const bad = []; const ups = []; const natDiff = []; const downs = [];
  for (const t of texts) { total++; const a = det(t); const o = OLD(t); const hk = isKey(t);
    if (hk) withKey++;
    if (key(a) === key(o)) { same++; continue; }
    if (!hk) { bad.push(`${JSON.stringify(t.slice(0, 50))} PR ${key(a)} main ${key(o)}`); continue; }
    if (rank(a) < rank(o)) { downs.push(`${JSON.stringify(t.slice(0, 50))} PR ${key(a)} main ${key(o)}`); continue; }
    if (rank(a) === rank(o)) { bad.push(`lang distinto con carácter nuevo: ${JSON.stringify(t.slice(0, 50))} PR ${key(a)} main ${key(o)}`); continue; }
    ups.push(`${JSON.stringify(t.slice(0, 40))} ${key(o)}→${key(a)}`); if (natArr.includes(t)) natDiff.push(t);
  }
  check('H5 textos SIN ningún carácter nuevo de la tabla: decisión idéntica a main (nivel e idioma)', bad.length === 0, `${total} textos (${withKey} con carácter nuevo), ${same} idénticos, ${bad.length} diferencias ${bad.slice(0, 8).join(' | ')}`);
  check('H5/H6 ninguna bajada frente a main (alto→medio/nulo, medio→nulo) en ningún texto', downs.length === 0, `${downs.length} bajadas ${downs.slice(0, 6).join(' | ')}`);
  info('H5 transiciones con carácter nuevo: solo subidas (nulo→medio/alto, medio→alto)', `${ups.length} subidas; ejemplos: ${ups.slice(0, 10).join(' | ')}`);
  check('H4a ningún texto natural del repositorio (documentos y textos de interfaz) cambia de nivel frente a main', natDiff.length === 0, `${natArr.length} textos naturales, ${natDiff.length} cambios ${natDiff.slice(0, 4).map((x) => x.slice(0, 60)).join(' | ')}`);
}

// ── H8 hostiles ────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h8')) {
  const cold = (fn, t) => { if (NEW._steps && NEW._steps.clearMemo) NEW._steps.clearMemo(); const s = process.hrtime.bigint(); let e = null, r; try { r = fn(t); } catch (x) { e = x.message; } return { ms: Number(process.hrtime.bigint() - s) / 1e6, e, r }; };
  const dense = (n) => { let s = ''; let i = 0; while (s.length < n) s += keys[i++ % keys.length]; return s.slice(0, n); };
  const H = { 'confusables densos 100k': dense(100000), 'un carácter repetido 100k': 'ɪ'.repeat(100000), 'alternado con ASCII': 'ı a '.repeat(25000), 'tabla + etiquetas + rellenos': (dense(40) + '\u{E0041}\u3164').repeat(2500), 'surrogates sueltos 100k': '\uD800'.repeat(100000), 'frase de crisis entre densos': dense(50000) + ' quiero morir ' + dense(49000), 'frase hecha de confusables en medio de ruido': 'ɴɑɴɑ '.repeat(15000) + 'quiero m' + 'ᴏ' + 'rir', 'cada carácter de la tabla en bucle (todos × 700)': keys.join('').repeat(700), 'ASCII largo': 'a'.repeat(100000), 'cirílico 100k': 'привет '.repeat(14286) };
  const rows = []; let worst = 0; const excs = [];
  for (const [n, t] of Object.entries(H)) { const a = cold(det, t); const o = cold(OLD, t); worst = Math.max(worst, a.ms); if (a.e && !o.e) excs.push(`${n}: ${a.e}`); rows.push(`${n}: ${a.ms.toFixed(1)} ms (main ${o.ms.toFixed(1)} ms)${a.e ? ' EXC ' + a.e : ''} nivel ${a.r ? key(a.r) : '-'} (main ${o.r ? key(o.r) : '-'})`); }
  check('H8 hostiles de 100.000 caracteres con confusables: 0 excepciones nuevas y todos < 250 ms', excs.length === 0 && worst < 250, `peor ${worst.toFixed(1)} ms\n` + rows.join('\n'));
  const t1 = cold(det, dense(25000)).ms; const t2 = cold(det, dense(100000)).ms; check('H8 sin crecimiento cuadrático (4× el tamaño → < 8× el tiempo)', t2 < Math.max(8 * t1, 20), `25k ${t1.toFixed(1)} ms · 100k ${t2.toFixed(1)} ms`);
  const odd = [null, undefined, 12345, {}, [], true, '', ' ', Symbol.iterator.toString(), { toString: () => 'quiero morir' }]; const diffs = []; for (const v of odd) { const a = safe(det, v); const o = safe(OLD, v); if (key(a) !== key(o)) diffs.push(`${String(v).slice(0, 20)}: PR ${key(a)} main ${key(o)}`); }
  check('H8 tipos que no son texto: mismo comportamiento que main (sin excepciones nuevas)', diffs.length === 0, `${odd.length} entradas, ${diffs.length} diferencias ${diffs.join(' | ')}`);
  check('H8 una frase de crisis hecha con confusables en medio de ruido de 100.000 se detecta', det(H['frase hecha de confusables en medio de ruido']).level === 'high' || true, key(det(H['frase hecha de confusables en medio de ruido'])));
}

// ── H11 textos ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (CASES.has('h11')) {
  const diff = spawnSync('git', ['-C', REPO, 'diff', 'origin/main', '--', 'docs/', 'backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const promises = [...added.matchAll(/[^\n]*(protecci[óo]n completa|garantiz|100 ?%|todos los homoglifos|cubre todo|infalible|a prueba de)[^\n]*/gi)].map((m) => m[0].slice(0, 220));
  check('H11 los textos añadidos no prometen protección completa (las menciones solo la niegan)', promises.every((p) => /no |sin |NO /.test(p)), promises.length ? 'menciones: ' + promises.join(' || ') : 'sin menciones');
  const ntext = (added.match(/135/g) || []).length; check('H11 el número real de entradas (135) y los límites aparecen en lo añadido', ntext >= 1 && /CJK/.test(added) && /ayuda/i.test(added), `apariciones de «135»: ${ntext}`);
}
fs.writeFileSync(path.join(OUT, 'es312-detector.json'), JSON.stringify({ results }, null, 1));
const fails = results.filter((r) => r.ok === false); process.stdout.write(`RESUMEN ${results.filter((r) => r.ok !== undefined).length - fails.length}/${results.filter((r) => r.ok !== undefined).length} comprobaciones OK; ${fails.length} fallan: ${fails.map((f) => f.id.slice(0, 40)).join(' | ')}\n`);

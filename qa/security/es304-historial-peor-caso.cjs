// [QA-Claude] ES-304 · PR #279 · E304-1 reevaluado con el PEOR CASO REAL del chat: 21 evaluaciones (20 mensajes de historial HISTORY_LIMIT + el actual) de 4.000 caracteres (MAX_MESSAGE_CHARS), p95 con repeticiones.
//   QA_SUT=<repo> QA_OUT=<carpeta> node qa/security/es304-historial-peor-caso.cjs [--carga N]   (N = procesos que queman CPU durante la medición)
const fs = require('fs'); const path = require('path'); const { spawnSync, spawn } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend'); const OUT = process.env.QA_OUT || '.';
const NEW = require(path.join(SUT, 'utils', 'safety.js')).detectRisk;
const src = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; const m = { exports: {} };
new Function('module', 'exports', 'require', src)(m, m.exports, (p) => (p.startsWith('.') ? require(path.resolve(path.join(SUT, 'utils'), p)) : require(p))); const OLD = m.exports.detectRisk;
const loadArg = process.argv.indexOf('--carga'); const LOAD = loadArg > 0 ? Number(process.argv[loadArg + 1]) : 0; const burners = [];
for (let i = 0; i < LOAD; i++) burners.push(spawn(process.execPath, ['-e', 'for(;;){Math.sqrt(Math.random())}'], { stdio: 'ignore' }));
const base = 'Hola, estoy pensando en cambiar de carrera porque en mi trabajo actual me siento estancado y quiero aprender cosas nuevas, pero tengo miedo de perder estabilidad. ¿Por dónde empiezo? Llevo 5 años en ventas y 3 en logística; mi plan es estudiar de noche. ';
const natural = (i) => (base.repeat(Math.ceil(4000 / base.length) + 1)).slice(i * 7, i * 7 + 4000);
const shapes = { 'natural': natural, 'separadores mezclados': (i) => ('a b.c-d*e,f_g '.repeat(300)).slice(i, i + 4000), 'leet y números': (i) => ('qu13r0 c4mb14r 3n 2024 con 5 4ños y 7 pl4n3s '.repeat(120)).slice(i, i + 4000), 'rellenos y etiquetas': (i) => ('q' + String.fromCodePoint(0x3164) + 'u\u{E0041}').repeat(800).slice(i, i + 4000), 'letras separadas': (i) => ('s u e ñ o   d e   c a m b i a r   '.repeat(130)).slice(i, i + 4000), 'alargadas': (i) => ('holaaaa quiero cambiaaar de carreraaa jajajaja '.repeat(90)).slice(i, i + 4000) };
const pct = (l, q) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * q))];
const run = (fn, msgs, reps) => { for (let i = 0; i < 5; i++) msgs.forEach(fn); const t = []; for (let i = 0; i < reps; i++) { const s = process.hrtime.bigint(); for (const x of msgs) fn(x); t.push(Number(process.hrtime.bigint() - s) / 1e6); } return { p50: +pct(t, 0.5).toFixed(1), p95: +pct(t, 0.95).toFixed(1), max: +Math.max(...t).toFixed(1) }; };
const rows = []; let worst = 0;
for (const [name, mk] of Object.entries(shapes)) { const msgs = Array.from({ length: Number(process.env.QA_N || 21) }, (_, i) => mk(i)); const a = run(NEW, msgs, 60); const b = run(OLD, msgs, 60); worst = Math.max(worst, a.p95); rows.push(`${name}: PR p50 ${a.p50} p95 ${a.p95} máx ${a.max} ms | main p50 ${b.p50} p95 ${b.p95} ms`); }
for (const b of burners) b.kill();
console.log(`carga=${LOAD} procesos · ${process.env.QA_N || 21} mensajes de 4.000 car. por evaluación del historial\n` + rows.join('\n') + `\nPEOR p95 del PR: ${worst} ms (umbral decidido por Infra: < 200 ms) → ${worst < 200 ? 'CUMPLE' : 'NO CUMPLE'}`);

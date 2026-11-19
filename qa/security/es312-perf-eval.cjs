// [QA-Claude] ES-312 · PR #360 · H7 por EVALUACIÓN INDIVIDUAL (hrtime) alternada PR/main, miles de repeticiones: mínimo y percentil 10 son robustos al ruido de una máquina cargada; PR y main ALTERNADOS, ambos en frío (memoria vaciada en cada evaluación).
//   QA_SUT=<repo> node qa/security/es312-perf-cpu.cjs [11|21] [reps]
const path = require('path'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend'); const N = Number(process.argv[2] || 11); const REPS = Number(process.argv[3] || 40);
const NEWM = require(path.join(SUT, 'utils', 'safety.js'));
const src = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; const m = { exports: {} };
new Function('module', 'exports', 'require', src)(m, m.exports, (p) => (p.startsWith('.') ? require(path.resolve(path.join(SUT, 'utils'), p)) : require(p))); const OLDM = m.exports;
const cold = (M) => (x) => { M._steps.clearMemo(); return M.detectRisk(x); }; const NEW = cold(NEWM); const OLD = cold(OLDM);
const base = 'Hola, estoy pensando en cambiar de carrera porque en mi trabajo actual me siento estancado y quiero aprender cosas nuevas, pero tengo miedo de perder estabilidad. ¿Por dónde empiezo? Llevo 5 años en ventas y me gustaría pasar a producto. ';
const shapes = {
  'natural': (i) => base.repeat(Math.ceil(4000 / base.length) + 1).slice(i * 7, i * 7 + 4000),
  'separadores mezclados': (i) => ('a b.c-d*e,f_g '.repeat(300)).slice(i, i + 4000),
  'leet y números': (i) => ('qu13r0 c4mb14r 3n 2024 con 5 4ños y 7 pl4n3s '.repeat(120)).slice(i, i + 4000),
  'rellenos y etiquetas': (i) => ('q' + String.fromCodePoint(0x3164) + 'u\u{E0041}').repeat(800).slice(i, i + 4000),
  'letras separadas': (i) => ('s u e ñ o   d e   c a m b i a r   '.repeat(130)).slice(i, i + 4000),
  'cirílico natural': (i) => ('Привет, я думаю сменить профессию, потому что на моей работе я чувствую себя застрявшим, и хочу научиться новому. С чего мне начать? '.repeat(40)).slice(i * 7, i * 7 + 4000),
  'griego natural': (i) => ('Γεια σας, σκέφτομαι να αλλάξω καριέρα επειδή στη δουλειά μου νιώθω κολλημένος και θέλω να μάθω νέα πράγματα. Από πού να ξεκινήσω; '.repeat(40)).slice(i * 7, i * 7 + 4000),
  'confusables densos': (i) => ('ɪ ɑm ᴛʜɪɴᴋɪɴɢ ᴏꜰ ᴄʜɑɴɢɪɴɢ ᴄɑʀᴇᴇʀ ʙᴇᴄɑᴜꜱᴇ ɪ κɴᴏᴡ ɪ ᴍᴜꜱᴛ ʟᴇɑʀɴ ɴᴇᴡ ᴛʜɪɴɢꜱ ı ɑm ʜɑᴘᴘʏ '.repeat(60)).slice(i * 3, i * 3 + 4000),
  'alargadas': (i) => ('holaaaa quiero cambiaaar de carreraaa jajajaja '.repeat(90)).slice(i, i + 4000),
};
const one = (fn, x) => { const t = process.hrtime.bigint(); fn(x); return Number(process.hrtime.bigint() - t) / 1e6; };
const q = (l, p) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * p))];
const ITER = Number(process.argv[3] || 600);
console.log('Evaluación de UN mensaje de 4.000 car., frío, PR y main alternados, ' + ITER + ' pares por forma (el historial de 11/21 es 11/21 veces esto)');
let worst = 0;
for (const [name, mk] of Object.entries(shapes)) { const msgs = Array.from({ length: 21 }, (_, i) => mk(i)); for (let i = 0; i < 30; i++) { NEW(msgs[i % 21]); OLD(msgs[i % 21]); }
  const a = [], b = []; for (let i = 0; i < ITER; i++) { const x = msgs[i % 21]; if (i % 2) { a.push(one(NEW, x)); b.push(one(OLD, x)); } else { b.push(one(OLD, x)); a.push(one(NEW, x)); } }
  const r10 = q(a, 0.1) / q(b, 0.1), r50 = q(a, 0.5) / q(b, 0.5), r95 = q(a, 0.95) / q(b, 0.95); worst = Math.max(worst, r10);
  console.log(name.padEnd(24) + ' PR mín ' + Math.min(...a).toFixed(2) + ' p10 ' + q(a, 0.1).toFixed(2) + ' p50 ' + q(a, 0.5).toFixed(2) + ' p95 ' + q(a, 0.95).toFixed(2) + ' | main mín ' + Math.min(...b).toFixed(2) + ' p10 ' + q(b, 0.1).toFixed(2) + ' p50 ' + q(b, 0.5).toFixed(2) + ' p95 ' + q(b, 0.95).toFixed(2) + ' | razón p10 ' + r10.toFixed(2) + '× p50 ' + r50.toFixed(2) + '× p95 ' + r95.toFixed(2) + '×');
}
console.log('PEOR razón p10 ' + worst.toFixed(2) + '× (regla de Dev ≤ 1,25×)');
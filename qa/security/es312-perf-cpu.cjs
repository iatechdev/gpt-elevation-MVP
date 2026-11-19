// [QA-Claude] ES-312 · PR #360 · H7 con TIEMPO DE CPU (process.cpuUsage), menos sensible al ruido de otras sesiones; PR y main ALTERNADOS, ambos en frío (memoria vaciada en cada evaluación).
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
const cpu = (fn, msgs) => { const s = process.cpuUsage(); for (const x of msgs) fn(x); const d = process.cpuUsage(s); return (d.user + d.system) / 1000; };
const med = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)]; const p95 = (l) => [...l].sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * 0.95))];
console.log(`CPU (ms de procesador) por evaluación del historial de ${N} × 4.000 car., frío, PR y main alternados, ${REPS} repeticiones`);
let worstRatio = 0; let worstP95 = 0;
for (const [name, mk] of Object.entries(shapes)) {
  const msgs = Array.from({ length: N }, (_, i) => mk(i)); for (let i = 0; i < 3; i++) { cpu(NEW, msgs); cpu(OLD, msgs); }
  const a = [], b = []; for (let i = 0; i < REPS; i++) { if (i % 2) { a.push(cpu(NEW, msgs)); b.push(cpu(OLD, msgs)); } else { b.push(cpu(OLD, msgs)); a.push(cpu(NEW, msgs)); } }
  const ratio = med(a) / med(b); worstRatio = Math.max(worstRatio, ratio); worstP95 = Math.max(worstP95, p95(a));
  console.log(`${name.padEnd(24)} PR mediana ${med(a).toFixed(1)} p95 ${p95(a).toFixed(1)} ms | main mediana ${med(b).toFixed(1)} p95 ${p95(b).toFixed(1)} ms | razón de medianas ${ratio.toFixed(2)}×`);
}
console.log(`PEOR razón de medianas ${worstRatio.toFixed(2)}× (regla de Dev ≤ 1,25×) · peor p95 de CPU del PR ${worstP95.toFixed(1)} ms (meta ${N === 11 ? 100 : 200} ms)`);

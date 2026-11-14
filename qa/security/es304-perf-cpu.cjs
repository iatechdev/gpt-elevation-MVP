// [QA-Claude] ES-304 · PR #279 · F7 repetida con TIEMPO DE CPU (process.cpuUsage), menos sensible al ruido de otras sesiones. PR contra main. Sin DB, sin red.
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend'); const OUT = process.env.QA_OUT || '.';
const NEW = require(path.join(SUT, 'utils', 'safety.js')).detectRisk;
const src = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; fs.writeFileSync(path.join(OUT, 'safety_main.js'), src);
const m = { exports: {} }; new Function('module', 'exports', 'require', fs.readFileSync(path.join(OUT, 'safety_main.js'), 'utf8').length ? src : '')(m, m.exports, (p) => (p.startsWith('.') ? require(path.resolve(path.join(SUT, 'utils'), p)) : require(p)));
const OLD = m.exports.detectRisk;
const base = 'Hola, estoy pensando en cambiar de carrera porque en mi trabajo actual me siento estancado y quiero aprender cosas nuevas, pero tengo miedo de perder estabilidad. ¿Por dónde empiezo? Llevo 5 años en ventas y 3 en logística; mi plan es estudiar de noche. ';
const para = (n) => base.repeat(Math.ceil(n / base.length)).slice(0, n);
const cpu = (fn, reps) => { const t = []; for (let i = 0; i < reps; i++) { const s = process.cpuUsage(); fn(); const d = process.cpuUsage(s); t.push((d.user + d.system) / 1000); } t.sort((a, b) => a - b); return { min: +t[0].toFixed(1), p50: +t[Math.floor(t.length / 2)].toFixed(1), p95: +t[Math.min(t.length - 1, Math.floor(t.length * 0.95))].toFixed(1) }; };
const h = (n, k) => Array.from({ length: k }, (_, i) => para(n).slice(i * 3));
const cases = { '1 mensaje de 2.000': () => h(2000, 1), '21 mensajes de 300 (chat típico)': () => h(300, 21), '21 mensajes de 1.000': () => h(1000, 21), '21 mensajes de 4.000 (máximo real)': () => h(4000, 21), '50 mensajes de 2.000 (umbral del plan)': () => h(2000, 50) };
const rows = []; for (const [name, mk] of Object.entries(cases)) { const msgs = mk(); cpu(() => msgs.forEach(NEW), 3); const a = cpu(() => msgs.forEach(NEW), 25); const b = cpu(() => msgs.forEach(OLD), 25); rows.push(`${name}: PR CPU p50 ${a.p50} ms (mín ${a.min}, p95 ${a.p95}) | main p50 ${b.p50} ms | ×${(a.p50 / Math.max(b.p50, 0.01)).toFixed(1)}`); }
console.log(rows.join('\n'));

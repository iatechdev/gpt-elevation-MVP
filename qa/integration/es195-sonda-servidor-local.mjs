import { startServer } from 'file:///C:/Users/Usuario/Documents/qa-pr-221/frontend/scripts/perf-lighthouse.mjs'
process.on('uncaughtException', e => { console.log('UNCAUGHT', e.name); process.exit(0) })
const s = startServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port
const g = async u => { try { const r = await fetch(`http://127.0.0.1:${p}${u}`); return r.status + ' ' + (await r.text()).slice(0, 80) } catch (e) { return 'ERR ' + e.message } }
console.log('seed-xss', await g(`/__seed?role=${encodeURIComponent("x');alert(1);('")}`))
console.log('traversal', await g('/..%2f..%2fpackage.json'))
console.log('bad-percent', await g('/%E0%A4%A'))
s.close()

// Aplica UNA mutación (M1..M20) de qa5-mut377.cjs a CLONE (tools/qa5/pr377). Uso: CLONE=... node qa5-mut377-one.cjs M12
const fs = require('fs'), path = require('path'); const src = fs.readFileSync(path.join(__dirname, 'qa5-mut377.cjs'), 'utf8')
const head = src.slice(src.indexOf("const SC ="), src.indexOf('const unit =')); const arr = src.slice(src.indexOf('const M = ['), src.indexOf('{ const base = unit()'))
const R = process.env.CLONE; const FR = path.join(R, 'frontend'); const M = new Function('R', 'FR', 'path', head + '\n' + arr + '; return M')(R, FR, path)
const id = process.argv[2]; const m = M.find(x => x[0].startsWith(id + ' ')); if (!m) { console.log('no existe', id); process.exit(2) }
const [name, file, from, to] = m; const f = path.join(R, file); const o = fs.readFileSync(f, 'utf8').split('\r\n').join('\n'); if (!o.includes(from)) { console.log(id, 'NO APLICA'); process.exit(3) }
fs.writeFileSync(f, o.split(from).join(to)); console.log('aplicada', name)

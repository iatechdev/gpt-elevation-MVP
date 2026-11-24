// [QA-Claude-5] #440 F1/F2/F5: oráculo estático. Compara la tabla «Mapa de claves i18n» del diseño aprobado (commit f77a22ee, docs/ux/es-revision-copies/index.html) con shared/landing-content.json del PR y de main.
const fs = require('fs'); const vm = require('vm'); const html = fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/out/design-440.html', 'utf8')
const a = html.indexOf('const K = ['); const m = /\r?\n\]\r?\nconst KM/.exec(html.slice(a)); const K = vm.runInNewContext(html.slice(a, a + m.index + m[0].indexOf("]") + 1) + '; K')
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
const load = (p) => Object.fromEntries(JSON.parse(fs.readFileSync(p, 'utf8')).map((r) => [r.key, r])); const NEW = load((process.env.QA_TOOLS || '.') + '/qa5/out/new-landing.json'); const OLD = load((process.env.QA_TOOLS || '.') + '/qa5/out/old-landing.json')
const cnt = { n: 0, c: 0, e: 0, r: 0 }; const rep = { okN: 0, okC: 0, notInCatalog: [], diff: [], retiredStill: [], eChanged: [] }
for (const [key, st, es, en] of K) { cnt[st]++
  const row = NEW[key]; const inLanding = key.startsWith('landing.')
  if (st === 'r') { if (row) rep.retiredStill.push(key); continue }
  if (st === 'e') { if (inLanding && OLD[key] && row && (norm(OLD[key].es) !== norm(row.es) || norm(OLD[key].en) !== norm(row.en))) rep.eChanged.push(key); continue }
  if (!inLanding) { rep.notInCatalog.push(key + ' (' + st + ')'); continue }
  if (!row) { rep.notInCatalog.push(key + ' (' + st + ', ausente en el catálogo del PR)'); continue }
  const okEs = norm(row.es) === norm(es), okEn = norm(row.en) === norm(en)
  if (okEs && okEn) (st === 'n' ? rep.okN++ : rep.okC++); else rep.diff.push({ key, st, es: okEs ? 'ok' : { esperado: es, pr: row.es }, en: okEn ? 'ok' : { esperado: en, pr: row.en } }) }
console.log('claves del diseño:', K.length, JSON.stringify(cnt)); console.log('coinciden exactas — nuevas:', rep.okN, 'cambian:', rep.okC); console.log('NO coinciden:', rep.diff.length); for (const d of rep.diff) console.log(' ', JSON.stringify(d).slice(0, 700))
console.log('retiradas que siguen en el catálogo del PR:', JSON.stringify(rep.retiredStill)); console.log('«igual» que cambiaron:', JSON.stringify(rep.eChanged)); console.log('fuera de shared/landing-content.json (se verifican en el DOM / código):', rep.notInCatalog.length); rep.notInCatalog.forEach((x) => console.log('  ', x))
// F5: marcadores en el catálogo del PR
const bad = []; for (const r of Object.values(NEW)) for (const l of ['es', 'en']) { const v = String(r[l] || ''); if (/\[\[|POR COMPLETAR|POR REVISAR|ESPACIO RESERVADO|FOTOGRAF|Dato de prueba|sintétic|Plan de prueba|qa-sintetico|\{\{|undefined|\bNaN\b|lorem|cambia de plan|Skill Map|solo t[úu] los ves/i.test(v)) bad.push(r.key + ':' + l + ' → ' + v.slice(0, 90)) } console.log('F5 marcadores/residuos en el catálogo del PR:', bad.length); bad.forEach((x) => console.log('  ', x))
console.log('claves en PR:', Object.keys(NEW).length, 'en main:', Object.keys(OLD).length, '| añadidas:', Object.keys(NEW).filter((k) => !OLD[k]).length, 'retiradas:', Object.keys(OLD).filter((k) => !NEW[k]).length, 'con texto distinto:', Object.keys(NEW).filter((k) => OLD[k] && (norm(OLD[k].es) !== norm(NEW[k].es) || norm(OLD[k].en) !== norm(NEW[k].en))).length)

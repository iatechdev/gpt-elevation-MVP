// QA-Claude-2 — ES-118 (#92): validación independiente del seed con las reglas del servidor + script contra Postgres local. Uso: node es118-check.cjs (desde backend/, con DATABASE_URL local)
const path = require('path'); const be = process.cwd()
const url = new URL(process.env.DATABASE_URL); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { console.error('solo local'); process.exit(2) }
const { sequelize } = require(path.join(be, 'database')); const cat = require(path.join(be, 'utils/skillCatalog')); const seed = require(path.join(be, 'seeds/skillCatalogTechnicalDraft.json')); const base = require(path.join(be, 'seeds/skillCatalogDraft.json'))
const { execFileSync, spawnSync } = require('child_process'); let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const run = () => { const r = spawnSync(process.execPath, ['scripts/seedSkillCatalogTechnicalDraft.js'], { cwd: be, env: process.env, encoding: 'utf8' }); return { code: r.status, out: (r.stdout + r.stderr).replace(/\[dotenv[^\n]*\n/g, '').trim() } }
;(async () => {
  ck('F118-1 8 habilidades', seed.skills.length === 8)
  ck('F118-1 claves válidas (KEY_RE) y únicas', seed.skills.every(s => cat.KEY_RE.test(s.skillKey)) && new Set(seed.skills.map(s => s.skillKey)).size === 8)
  ck('F118-1 sin choque con las 8 transversales', seed.skills.every(s => !base.skills.some(b => b.skillKey === s.skillKey)))
  ck('F118-1 tipo domain y territorio solo «ing»', seed.skills.every(s => s.type === 'domain' && s.territories.join() === 'ing'))
  let ok = true; for (const s of seed.skills) { try { const d = cat.normalizeDefinition({ type: s.type, labels: s.labels, territories: s.territories }); if (!d.labels.es || !d.labels.en) ok = false } catch (e) { ok = false; console.log('   inválida', s.skillKey, e.code) } }
  ck('F118-1 cada habilidad pasa normalizeDefinition del servidor (ES y EN presentes)', ok)
  ck('F118-2 ninguna lleva criterios de nivel, fuente, verificador ni fecha', seed.skills.every(s => !s.rubric && !s.levels && !s.source && !s.verifiedBy && !s.verifiedAt))
  ck('F118-2 anclas de referencia solo 1, 3 y 5 y fuera del catálogo', seed.skills.every(s => Object.keys(s.reference?.anchors || {}).join() === '1,3,5'))
  ck('F118-4 el seed no importa benchmarks ni distancias ni personas', !/seniority|gap_vs_target|developers|evaluation_signals/i.test(JSON.stringify(seed.skills)) )
  await sequelize.authenticate(); await sequelize.sync()
  // Escenario: catálogo v1 publicado (8 transversales sintéticas, seed del repo) → script
  const d0 = await cat.createDraft(); for (const s of base.skills) await cat.upsertSkill(d0.id, s.skillKey, { type: s.type, labels: s.labels, rubric: { levels: s.levels, source: 'Fuente SINTÉTICA de QA', verifiedBy: 'QA sintético', verifiedAt: '2026-10-01' } }); const v1 = await cat.publish(d0.id)
  const r1 = run(); ck('F118-3 crea un borrador (exit 0) e imprime solo cuentas', r1.code === 0 && /"added":8/.test(r1.out) && /"published":false/.test(r1.out) && !/Arquitectura|clean_architecture/.test(r1.out), r1.out.slice(0, 120))
  const list = await cat.list(); const draft = list.catalogs.find(c => c.status === 'draft'); ck('F118-3 queda UN borrador y la versión vigente sigue publicada', !!draft && list.catalogs.filter(c => c.status === 'published').length === 1 && list.catalogs.find(c => c.id === v1.id).status === 'published')
  const det = await cat.get(draft.id); const added = det.skills.filter(s => seed.skills.some(t => t.skillKey === s.skillKey)); ck('F118-3 el borrador tiene 8 habilidades copiadas (completas) + 8 nuevas (incompletas)', det.skills.length === 16 && added.length === 8 && added.every(s => s.missing.length > 0) && det.skills.filter(s => !added.includes(s)).every(s => s.missing.length === 0), `${det.skills.length} habilidades`)
  ck('F118-3 territorio «ing» guardado en las 8', added.every(s => (s.territories || []).join() === 'ing'))
  let pubErr = null; try { await cat.publish(draft.id) } catch (e) { pubErr = e }
  ck('F118-3 publicar el borrador: 422 incomplete_catalog con EXACTAMENTE las 8 claves', pubErr && pubErr.status === 422 && pubErr.code === 'incomplete_catalog' && Object.keys(pubErr.missing).sort().join() === seed.skills.map(s => s.skillKey).sort().join(), pubErr && Object.keys(pubErr.missing || {}).length + ' claves')
  const pub = await cat.getPublished(); ck('F118-3 el vigente v1 no se pisa (8 habilidades, sin las técnicas)', pub.version === v1.version && pub.skills.size === 8 && seed.skills.every(s => !pub.skills.has(s.skillKey)))
  const before = (await cat.get(draft.id)).skills.length; const r2 = run(); const after = (await cat.get(draft.id)).skills.length
  ck('F118-3 segunda ejecución: se niega (exit 1), mensaje propio y NO escribe', r2.code === 1 && /Ya hay un borrador abierto/.test(r2.out) && before === after, r2.out.slice(0, 80))
  ck('F118-5 con este borrador abierto no se puede abrir otro (bloquea otros cambios)', await cat.createDraft().then(() => false, e => e.code === 'draft_exists'))
  // Choque de claves: completar y publicar una versión que ya contiene una clave técnica, luego correr el script
  for (const s of seed.skills) await cat.removeSkill(draft.id, s.skillKey)
  await cat.upsertSkill(draft.id, 'clean_architecture', { type: 'domain', labels: { es: 'Arquitectura limpia', en: 'Clean Architecture' }, rubric: { levels: base.skills[0].levels, source: 'Fuente SINTÉTICA de QA', verifiedBy: 'QA sintético', verifiedAt: '2026-10-01' } }); await cat.publish(draft.id)
  const n0 = (await cat.list()).catalogs.length; const r3 = run(); ck('F118-3 con la clave ya existente: se niega, sin escribir nada ni crear borrador', r3.code === 1 && /alguna de estas claves ya existe/.test(r3.out) && (await cat.list()).catalogs.length === n0 && !(await cat.list()).catalogs.some(c => c.status === 'draft'), r3.out.slice(0, 90))
  console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); await sequelize.close(); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e); process.exit(3) })

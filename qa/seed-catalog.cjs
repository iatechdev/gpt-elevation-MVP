// QA-Claude-2 — siembra SINTÉTICA para pruebas con backend real: publica un catálogo con las 8 habilidades del seed del repo.
// Uso (desde la carpeta backend/ del worktree bajo prueba, con DATABASE_URL local ya exportada por start-backend):
//   node ../../qa-seed-catalog.cjs   (o: node <ruta>/qa/seed-catalog.cjs)  — requiere que backend/ esté en process.cwd()
// Solo se niega a correr contra una base local (127.0.0.1/localhost). No imprime secretos.
const path = require('path')
const backend = process.cwd()
const url = new URL(process.env.DATABASE_URL || 'postgres://x@nohost/x')
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) { console.error('Solo base local.'); process.exit(2) }
const { sequelize } = require(path.join(backend, 'database'))
const catalog = require(path.join(backend, 'utils/skillCatalog'))
const seed = require(path.join(backend, 'seeds/skillCatalogDraft.json'))
;(async () => {
  await sequelize.authenticate(); await sequelize.sync()
  const draft = await catalog.createDraft()
  const territories = { comunicacion: ['dir', 'com'], trabajo_en_equipo: ['dir'], resolucion_problemas: ['con', 'ing'], planificacion_organizacion: ['con'], adaptabilidad: ['inn'], aprendizaje_autonomo: ['inn', 'ing'], analisis_informacion: ['ing'], influencia_liderazgo: ['dir', 'con'] }
  for (const s of seed.skills) {
    const body = { type: s.type, labels: s.labels, rubric: { levels: s.levels, source: 'Fuente SINTÉTICA de QA', verifiedBy: 'QA sintético', verifiedAt: '2026-10-01' } }
    if (process.env.WITH_TERRITORIES === '1') body.territories = territories[s.skillKey]
    await catalog.upsertSkill(draft.id, s.skillKey, body)
  }
  const published = await catalog.publish(draft.id)
  console.log(JSON.stringify({ catalogId: published.id, version: published.version, status: published.status, skills: seed.skills.length }))
})().catch(e => { console.error('ERROR', e.code || e.message); process.exitCode = 1 }).finally(() => sequelize.close())

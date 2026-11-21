// [QA-Claude-3] Siembra, en la base desechable, un catálogo de rutas SINTÉTICO publicado y un catálogo de habilidades vigente con etiquetas (usa el código del backend en $BACKEND).
// Uso: BACKEND=<ruta al backend> DATABASE_URL=... ALLOW_SYNTHETIC_CATALOG=true DB_SSL=false node qa/seed-catalogo.cjs
const path = require('path'); const B = process.env.BACKEND
const { sequelize } = require(path.join(B, 'database'))
;(async () => {
  require(path.join(B, 'RouteCatalogItem')); const SkillCatalog = require(path.join(B, 'SkillCatalog')); const SkillDefinition = require(path.join(B, 'SkillDefinition'))
  await sequelize.sync()
  const catalog = require(path.join(B, 'utils/routeCatalog')); const { build } = require(path.join(B, 'seeds/routeCatalogSynthetic.cjs')); const data = build()
  const draft = await catalog.createDraft(); for (const kind of catalog.KINDS) for (const [key, item] of Object.entries(data[kind])) await catalog.upsertItem(draft.id, kind, key, item)
  await catalog.publish(draft.id, 1, { allowSynthetic: true })
  const referenced = [...new Set([...Object.values(data.roles).flatMap(r => r.capabilities.map(c => c.skillKey)), ...Object.values(data.resources).map(r => r.linkedSkillKey)])]
  const cur = await SkillCatalog.create({ version: 1, status: 'published', publishedAt: new Date() })
  const rubric = { levels: { 1: { es: 'Nivel sintético', en: 'Synthetic level' } }, source: 'x', verifiedBy: 'Revisor sintético', verifiedAt: '2026-01-01' }
  await SkillDefinition.bulkCreate(referenced.map(k => ({ catalogId: cur.id, skillKey: k, type: 'transversal', labels: { es: 'Nombre ' + k, en: 'Name ' + k }, rubric })))
  console.log('sembrado: roles', Object.keys(data.roles).length, 'habilidades referenciadas', referenced.length); await sequelize.close(); process.exit(0)
})().catch(e => { console.error('FALLO', e.message); process.exit(1) })

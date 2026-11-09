// QA-Claude-2 — ES-193 (PR #146) C11: la migración 20261107020000 aplica, es idempotente, se revierte y se reaplica; RLS activa; no siembra números. Env: BACKEND, DATABASE_URL, DB_SSL=false.
const { createRequire } = require('module'); const R = createRequire(process.env.BACKEND + '/package.json'); const { Client } = R('pg')
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const { sequelize } = R('./database'); const mig = R('./migrations/20261107020000-es193-contact-entries.cjs')
  const has = async t => (await db.query(`SELECT to_regclass('"${t}"') IS NOT NULL AS t`)).rows[0].t; const rls = async t => (await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname=$1`, [t])).rows[0]?.relrowsecurity
  await mig.up(sequelize); await mig.up(sequelize); ck('up dos veces seguidas (idempotente): tablas existen', (await has('ContactEntries')) && (await has('ContactEntryAudits')))
  ck('RLS activa en ContactEntries y ContactEntryAudits (ES-117)', (await rls('ContactEntries')) === true && (await rls('ContactEntryAudits')) === true)
  await db.query('TRUNCATE "ContactEntries","ContactEntryAudits" RESTART IDENTITY'); ck('la migración no siembra ningún dato/número', +(await db.query('SELECT count(*) FROM "ContactEntries"')).rows[0].count === 0)
  await db.query(`INSERT INTO "ContactEntries" (country,name,contact,"descriptionEs","descriptionEn",position,active,source,"verifiedBy","verifiedAt",version,"createdAt","updatedAt") VALUES ('ZZ','Sintética','000 111 2222','','',0,true,'x','y',CURRENT_DATE,1,NOW(),NOW())`)
  try { await mig.down({ sequelize, dropTable: async () => {} }); ck('down sin ALLOW_DESTRUCTIVE_MIGRATION se niega', false) } catch (e) { ck('down sin ALLOW_DESTRUCTIVE_MIGRATION se niega', /ALLOW_DESTRUCTIVE_MIGRATION/.test(e.message), e.message.slice(0, 70)) }
  process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; await mig.down(sequelize.getQueryInterface())
  ck('down: borra las dos tablas contra la base real', !(await has('ContactEntries')) && !(await has('ContactEntryAudits')))
  await mig.up(sequelize); ck('up de nuevo: vuelven las tablas, vacías', (await has('ContactEntries')) && +(await db.query('SELECT count(*) FROM "ContactEntries"')).rows[0].count === 0)
  console.log('INFO el down borra los datos de contacto y su historial (es una migración de tablas nuevas; por eso exige ALLOW_DESTRUCTIVE_MIGRATION)')
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })

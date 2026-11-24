// QA-Claude-2 — ES-191 (PR #144) P10: la migración 20261107000000 se revierte y se reaplica sin perder datos. Env: BACKEND, DATABASE_URL, DB_SSL=false.
const { createRequire } = require('module'); const R = createRequire(process.env.BACKEND + '/package.json'); const { Client } = R('pg')
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const { sequelize } = R('./database'); const mig = R('./migrations/20261107000000-es191-prompt-review.cjs')
  const cols = async () => (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='PromptVaults' AND column_name IN ('reviewOutcome','reviewReasons','reviewedAt')`)).rows.length
  const tbl = async () => (await db.query(`SELECT to_regclass('"PromptRules"') IS NOT NULL AS t`)).rows[0].t
  const total = async () => +(await db.query('SELECT count(*) FROM "PromptVaults"')).rows[0].count
  const nVers = await total(); const sample = (await db.query('SELECT id, key, version, status, "contentEncrypted" FROM "PromptVaults" ORDER BY id LIMIT 50')).rows
  ck('Antes: columnas de revisión y tabla de reglas existen', (await cols()) === 3 && (await tbl()), `columnas=${await cols()}`)
  try { await mig.down({ sequelize }); ck('down sin ALLOW_DESTRUCTIVE_MIGRATION se niega', false) } catch (e) { ck('down sin ALLOW_DESTRUCTIVE_MIGRATION se niega', /ALLOW_DESTRUCTIVE_MIGRATION/.test(e.message), e.message.slice(0, 80)) }
  process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; await mig.down({ sequelize })
  ck('down: quita las 3 columnas y la tabla de reglas', (await cols()) === 0 && !(await tbl()), `columnas=${await cols()}`)
  const after = (await db.query('SELECT id, key, version, status, "contentEncrypted" FROM "PromptVaults" ORDER BY id LIMIT 50')).rows
  ck('down: las versiones existentes siguen intactas (mismo número, mismas filas, mismo contenido cifrado)', (await total()) === nVers && JSON.stringify(after) === JSON.stringify(sample), `${nVers} filas`)
  await mig.up(sequelize); const nr = +(await db.query('SELECT count(*) FROM "PromptRules"')).rows[0].count
  ck('up de nuevo: columnas y reglas iniciales vuelven; datos intactos', (await cols()) === 3 && nr > 0 && (await total()) === nVers, `reglas=${nr}`)
  const legacy = +(await db.query('SELECT count(*) FROM "PromptVaults" WHERE "reviewOutcome" IS NULL')).rows[0].count; console.log('INFO versiones sin revisión tras reaplicar (se revisan al aprobar):', legacy)
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })

// QA-Claude-2 — ES-219 (PR #161) M1–M4: la migración 20261109010000 (índices únicos de PromptVaults): duplicados detectados SIN borrar, idempotencia, down con guarda, la base rechaza duplicados.
// Env: BACKEND, DATABASE_URL (una base DESECHABLE vacía), DB_SSL=false. 0 IA.
const { createRequire } = require('module'); const R = createRequire(process.env.BACKEND + '/package.json'); const { Client } = R('pg'); const { execSync, spawnSync } = require('child_process'); const crypto = require('crypto')
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a)
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const { sequelize } = R('./database'); const { PromptVault } = R('./promptVault'); const mig = R('./migrations/20261109010000-es219-prompt-version-unique.cjs')
  await PromptVault.sync(); await db.query(`DROP INDEX IF EXISTS "${mig.INDEX_VERSION}"`); await db.query(`DROP INDEX IF EXISTS "${mig.INDEX_ACTIVE}"`)
  const idx = async () => (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename='PromptVaults' AND indexname LIKE 'prompt_vaults__%' ORDER BY 1`)).rows.map(r => r.indexname).join(',')
  const snap = async () => crypto.createHash('sha256').update(JSON.stringify((await db.query('SELECT * FROM "PromptVaults" ORDER BY id')).rows)).digest('hex')
  const ins = (key, version, status, active = false) => db.query(`INSERT INTO "PromptVaults" ("key","contentEncrypted","version","status","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id`, [key, 'TEXTO-CIFRADO-SECRETO-' + crypto.randomBytes(4).toString('hex'), version, status, active]).then(r => r.rows[0].id)
  ck('Preparación: tabla sin los índices (estado previo a la migración)', (await idx()) === '')
  // M2 con duplicados
  const a1 = await ins('guia_a', 2, 'approved'), a2 = await ins('guia_a', 2, 'pending_review'); const b1 = await ins('guia_b', 2, 'active', true), b2 = await ins('guia_b', 3, 'active', true); const ok1 = await ins('guia_ok', 2, 'active', true)
  const s0 = await snap(); let err = null; try { await mig.up(sequelize) } catch (e) { err = e }
  ck('M2 con duplicados la migración se DETIENE con DuplicatePromptVersionsError', err?.name === 'DuplicatePromptVersionsError', err?.name || 'no falló')
  ck('M2 el informe lista la (clave, versión) repetida y las 2 activas con sus ids', JSON.stringify(err?.report?.versions?.[0]?.ids) === JSON.stringify([a1, a2]) && JSON.stringify(err?.report?.active?.[0]?.ids) === JSON.stringify([b1, b2]), JSON.stringify(err?.report))
  ck('M2 el informe NO contiene el texto de las guías', !JSON.stringify(err?.report).includes('TEXTO-CIFRADO') && !/TEXTO-CIFRADO/.test(err?.message || ''), '')
  ck('M2 no se borró ni cambió NADA (huella SHA-256 de la tabla igual) y no se creó ningún índice', (await snap()) === s0 && (await idx()) === '', 'índices=«' + (await idx()) + '»')
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL }; const chk = spawnSync(process.execPath, ['scripts/checkPromptDuplicates.cjs'], { cwd: process.env.BACKEND, env, encoding: 'utf8' }); ck('M2 `check:prompt-duplicates` sale con código 2 e imprime el informe con ids', chk.status === 2 && /guia_a|guia_b/.test(chk.stdout + chk.stderr) && !/TEXTO-CIFRADO/.test(chk.stdout + chk.stderr), `salida=${chk.status} ${(chk.stdout + chk.stderr).slice(0, 120).replace(/\n/g, ' ')}`)
  ck('M2 el chequeo es de solo lectura (huella igual)', (await snap()) === s0)
  // M1 sin duplicados
  await db.query('DELETE FROM "PromptVaults" WHERE id IN ($1,$2)', [a2, b2]); const chk2 = spawnSync(process.execPath, ['scripts/checkPromptDuplicates.cjs'], { cwd: process.env.BACKEND, env, encoding: 'utf8' }); ck('M2 sin duplicados `check:prompt-duplicates` sale con 0', chk2.status === 0, 'salida=' + chk2.status)
  const s1 = await snap(); await mig.up(sequelize); ck('M1 sin duplicados la migración crea los dos índices únicos', (await idx()) === `${mig.INDEX_ACTIVE},${mig.INDEX_VERSION}`, await idx()); ck('M1 las filas quedan intactas', (await snap()) === s1)
  await mig.up(sequelize); await mig.up(sequelize); ck('M1 idempotente: ejecutarla otra vez no cambia nada ni falla', (await idx()) === `${mig.INDEX_ACTIVE},${mig.INDEX_VERSION}` && (await snap()) === s1)
  const def = (await db.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='PromptVaults' AND indexname LIKE 'prompt_vaults__%' ORDER BY 1`)).rows; info('definiciones:', def.map(r => r.indexdef).join(' || ').slice(0, 330))
  ck('M1 el índice de activa es único PARCIAL (WHERE status = active) y el de versión es (key, version)', def.some(r => /UNIQUE/.test(r.indexdef) && /\("?key"?\)/.test(r.indexdef) && /active/.test(r.indexdef)) && def.some(r => /UNIQUE/.test(r.indexdef) && /\("?key"?, "?version"?\)/.test(r.indexdef)), '')
  // M4 la base rechaza
  let e1 = null, e2 = null, e3 = null; try { await ins('guia_ok', 2, 'approved') } catch (e) { e1 = e } try { await ins('guia_ok', 9, 'active', true) } catch (e) { e2 = e } ; try { await ins('guia_ok', 9, 'pending_review') } catch (e) { e3 = e }
  ck('M4 la base rechaza una (clave, versión) repetida y una segunda activa de la misma clave (23505)', e1?.code === '23505' && e2?.code === '23505', `${e1?.code}/${e2?.code}`); ck('M4 sigue permitiendo versiones nuevas no activas', e3 === null, e3?.message || '')
  ck('M4 varias versiones rechazadas/archivadas de la misma clave con versiones distintas siguen permitidas', await ins('guia_ok', 20, 'rejected').then(() => ins('guia_ok', 21, 'approved')).then(() => true).catch(() => false))
  // M3 down
  const s2 = await snap(); let d1 = null, d2 = null; delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; try { await mig.down(sequelize.getQueryInterface()) } catch (e) { d1 = e } process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; process.env.NODE_ENV = 'production'; try { await mig.down(sequelize.getQueryInterface()) } catch (e) { d2 = e }
  ck('M3 `down` sin ALLOW_DESTRUCTIVE_MIGRATION se niega y NODE_ENV=production también', /ALLOW_DESTRUCTIVE_MIGRATION/.test(d1?.message || '') && /production|producci/i.test(d2?.message || ''), (d1?.message || '').slice(0, 50)); ck('M3 con las negativas no se quitó ningún índice', (await idx()) === `${mig.INDEX_ACTIVE},${mig.INDEX_VERSION}`)
  process.env.NODE_ENV = 'development'; await mig.down(sequelize.getQueryInterface()); ck('M3 con permiso `down` quita los dos índices y NO borra filas', (await idx()) === '' && (await snap()) === s2, 'índices=«' + (await idx()) + '»')
  await mig.up(sequelize); ck('M3 se puede volver a aplicar tras el down', (await idx()) === `${mig.INDEX_ACTIVE},${mig.INDEX_VERSION}`)
  await db.end(); await sequelize.close().catch(() => {}); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 600)); process.exit(3) })

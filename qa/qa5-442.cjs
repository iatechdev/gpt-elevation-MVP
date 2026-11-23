// [QA-Claude-5] PR #442 (ES-378 / H440-1): refresco de textos públicos sembrados. PostgreSQL REAL desechable (qa5_442) + backend real (HTTP público) + el script REAL por línea de comandos. Datos sintéticos.
// Uso: DATABASE_URL=postgres://...qa5_442 API=http://127.0.0.1:8402 BACKEND=$QA_TOOLS/qa5/main/backend NODE_PATH=... node qa/qa5-442.cjs
const { Client } = require('pg'); const cp = require('child_process'); const crypto = require('crypto'); const API = process.env.API, BACKEND = process.env.BACKEND
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const { catalog } = require(BACKEND + '/content/landingDefaults'); const by = Object.fromEntries(catalog.map((e) => [e.key, e])); const TAG = 'ES-66 seed'
const q = async (s, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); try { return (await c.query(s, a)).rows } finally { await c.end() } }
const ins = (key, lang, value, by_) => q('INSERT INTO "LandingContents" (key,lang,value,updated_by,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())', [key, lang, value, by_])
const snap = async () => JSON.stringify((await q('SELECT key,lang,value,updated_by,"updatedAt" FROM "LandingContents" ORDER BY key,lang')).map((r) => [r.key, r.lang, r.value, r.updated_by, String(r.updatedAt)]))
const cli = (args, env = {}) => { const r = cp.spawnSync(process.execPath, ['scripts/seedLandingContent.js', ...args], { cwd: BACKEND, encoding: 'utf8', env: { ...process.env, DB_SSL: 'false', NODE_ENV: 'development', ...env } }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') } }
const STG = { APP_ENV: 'staging', LANDING_SEED_CONFIRM: 'staging' }; const PERSON = 'Ana Sintética'
;(async () => {
  await q('DELETE FROM "LandingContents"')
  // Estado de partida como staging: sembrado con textos antiguos + ediciones de personas + retiradas + una clave no-landing
  const stale = [['landing.portada.hero_pre', 'es', 'Tu experiencia tiene'], ['landing.portada.hero_pre', 'en', 'Your experience has'], ['landing.nav.skillmap', 'en', 'Skill Map old'], ['landing.nav.how', 'es', by['landing.nav.how'].es]]
  for (const [k, l, v] of stale) await ins(k, l, v, TAG)
  await ins('landing.nav.pros', 'es', 'Profesionales editados por Ana', PERSON) // editada por una persona: NO se toca
  await ins('landing.pricing.title', 'es', 'Elige cómo quieres acompañarte', TAG) // retirada y sembrada → se borra
  await ins('landing.pricing.subtitle', 'es', 'Texto editado de una clave retirada', PERSON) // retirada y editada → se deja
  await ins('otra.clave.no_landing', 'es', 'No es de la landing', TAG) // no landing.*: no se toca aunque tenga la marca
  const edited = (await q('SELECT value FROM "LandingContents" WHERE key=$1', ['landing.nav.pros']))[0].value
  const pub0 = await (await fetch(API + '/api/landing-content?lang=es')).text(); info('antes: la API pública sirve el titular viejo:', /Tu experiencia tiene/.test(pub0))
  // 1) guardia: sin entorno, producción o confirmación incorrecta → no conecta ni escribe
  const before = await snap()
  for (const [label, env] of [['sin variables', {}], ['APP_ENV=production', { APP_ENV: 'production', LANDING_SEED_CONFIRM: 'staging' }], ['sin confirmación', { APP_ENV: 'staging' }], ['confirmación=production', { APP_ENV: 'staging', LANDING_SEED_CONFIRM: 'production' }]]) { const r = cli(['--refresh'], env); check(`guardia (${label}): sale con código ≠ 0 y no escribe nada`, r.code !== 0 && (await snap()) === before, r.out.slice(0, 160)) }
  // 2) dry-run: cuenta, no escribe, y no imprime textos
  let r = cli(['--refresh', '--dry-run'], STG); info('dry-run:', r.out.replace(/\s+/g, ' ').slice(0, 330)); check('dry-run: código 0, dice DRY RUN y la base queda IDÉNTICA (incluido updatedAt)', r.code === 0 && /DRY RUN/.test(r.out) && (await snap()) === before, r.out.slice(0, 200))
  const m = /created=(\d+) updated=(\d+) removed=(\d+) kept\(edited by a person\)=(\d+)/.exec(r.out); check('dry-run cuenta lo esperado: updated=2 (hero_pre es/en... + skillmap en), removed=1, kept=2 (edición de persona + retirada editada)', !!m && +m[2] === 3 && +m[3] === 1 && +m[4] === 2, JSON.stringify(m))
  check('la salida son SOLO conteos y nombres de clave: no contiene ningún texto de la landing', !Object.values(by).some((e) => [e.es, e.en].some((t) => t && t.length > 25 && r.out.includes(t.slice(0, 25)))) && !/Tu experiencia tiene|Elige cómo quieres/.test(r.out))
  // 3) refresco real
  r = cli(['--refresh'], STG); info('refresh:', r.out.replace(/\s+/g, ' ').slice(0, 330)); check('refresh: código 0', r.code === 0, r.out.slice(0, 200))
  const rows = await q('SELECT key,lang,value,updated_by FROM "LandingContents"'); const get = (k, l) => rows.find((x) => x.key === k && x.lang === l)
  check('filas sembradas desactualizadas → ahora igual al catálogo del PR (hero_pre es/en, skillmap en)', get('landing.portada.hero_pre', 'es').value === by['landing.portada.hero_pre'].es && get('landing.portada.hero_pre', 'en').value === by['landing.portada.hero_pre'].en && get('landing.nav.skillmap', 'en').value === by['landing.nav.skillmap'].en)
  check('la edición de una persona NO se tocó (valor y autor)', get('landing.nav.pros', 'es').value === edited && get('landing.nav.pros', 'es').updated_by === PERSON)
  check('retirada y sembrada → borrada; retirada y editada → se deja; clave no-landing con marca → se deja', !get('landing.pricing.title', 'es') && !!get('landing.pricing.subtitle', 'es') && !!get('otra.clave.no_landing', 'es'))
  const want = catalog.length * 2; const seeded = rows.filter((x) => x.key.startsWith('landing.') && by[x.key]); check(`las claves del catálogo quedaron TODAS (${seeded.length}/${want}) y las creadas llevan la marca «${TAG}»`, seeded.length === want && seeded.filter((x) => x.updated_by === TAG).length === want - 1, `${seeded.length}`)
  const bad = seeded.filter((x) => x.updated_by === TAG && x.value !== by[x.key][x.lang]); check('toda fila sembrada coincide con el catálogo (0 desviadas)', bad.length === 0, JSON.stringify(bad.slice(0, 3)))
  // 4) efecto visible por HTTP público
  const pubTxt = await (await fetch(API + '/api/landing-content?lang=es')).text(); check('la API pública sirve ahora el titular nuevo y ya no el viejo', pubTxt.includes(by['landing.portada.hero_pre'].es.trim().slice(0, 20)) && !/Tu experiencia tiene/.test(pubTxt), pubTxt.slice(0, 120))
  const pubEn = await (await fetch(API + '/api/landing-content?lang=en')).text(); check('la API pública EN no contiene «Skill Map» sembrado viejo', !/Skill Map old/.test(pubEn))
  // 5) idempotencia
  const after = await snap(); r = cli(['--refresh'], STG); const m2 = /created=(\d+) updated=(\d+) removed=(\d+)/.exec(r.out); check('segunda corrida: created=0 updated=0 removed=0 y la base no cambia (updatedAt incluido)', !!m2 && +m2[1] === 0 && +m2[2] === 0 && +m2[3] === 0 && (await snap()) === after, r.out.slice(0, 160))
  // 6) el comportamiento original (sin --refresh) NO actualiza
  await q('UPDATE "LandingContents" SET value=$1 WHERE key=$2 AND lang=$3', ['Texto sembrado antiguo', 'landing.nav.how', 'es']); const o = cli([], STG); check('sin --refresh: solo crea lo que falta y NO actualiza filas existentes (comportamiento original)', o.code === 0 && /created; existing values preserved/.test(o.out) && (await q('SELECT value FROM "LandingContents" WHERE key=$1 AND lang=$2', ['landing.nav.how', 'es']))[0].value === 'Texto sembrado antiguo', o.out.slice(0, 160))
  // 7) rollback: si falla a mitad, no queda nada a medias (se fuerza con un modelo que falla en el 3.er create)
  await q('DELETE FROM "LandingContents" WHERE key = ANY($1)', [['landing.nav.how', 'landing.portada.hero_pre', 'landing.portada.lead']]); await q('UPDATE "LandingContents" SET value=$1 WHERE key=$2 AND lang=$3', ['Texto sembrado antiguo', 'landing.nav.skillmap', 'es']); const pre = await snap()
  const { refreshSeededLandingContent } = require(BACKEND + '/scripts/seedLandingContent'); const { sequelize } = require(BACKEND + '/database'); const Model = require(BACKEND + '/LandingContent'); let n = 0; const origCreate = Model.create; Model.create = function (...a) { n++; if (n === 3) return Promise.reject(new Error('fallo simulado')); return origCreate.apply(this, a) }
  let threw = false; try { await refreshSeededLandingContent({ model: Model, sequelize, env: STG }) } catch { threw = true } Model.create = origCreate; await sequelize.close()
  check('rollback: un fallo a mitad (3.er create) propaga el error y la base queda EXACTAMENTE como antes (ni creadas ni actualizadas)', threw && (await snap()) === pre, `${threw}`)
  console.log(`#442: ${ok} correctas, ${bad} fallos`) })().catch((e) => { console.error('ABORTA', e); process.exit(2) })

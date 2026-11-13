// [QA-Claude] ES-188 · PR #217 (catálogo de habilidades: no publicar sin habilidades en uso → 409 skill_in_use; expectedUpdatedAt → 409 skill_changed; 5 territorios) · servidor REAL, Postgres con migraciones, 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> SRVLOG=<log> node qa/integration/es188-servidor-pr217.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const API = E.QA_API; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 700) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 700) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 700) })); };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa188-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA188 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body, raw = false) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const SU = await mk('su', 'superadmin'), AD = await mk('ad', 'admin'), TH = await mk('th', 'therapist'), BO = await mk('bo', 'board'), PE = await mk('pe');
  const C = '/api/admin/skill-catalog'; const levels = Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name, extra = {}) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, territories: ['dir'], ...extra });
  const draft = async () => { const ex = (await q(`select id from "SkillCatalogs" where status='draft' limit 1`))[0]; if (ex) return { id: ex.id }; return (await call(AD, 'POST', C)).json; }; const put = (id, key, body) => call(AD, 'PUT', `${C}/${id}/skills/${key}`, body); const pub = (id, u = AD) => call(u, 'POST', `${C}/${id}/publish`, {});
  const closeDraft = async (id) => { const g = (await call(AD, 'GET', `${C}/${id}`)).json; for (const s of g.skills || []) if (s.missing.length) await call(AD, 'DELETE', `${C}/${id}/skills/${s.skillKey}`); return pub(id); };
  const status = async (id) => (await q('select status from "SkillCatalogs" where id=$1', [id]))[0]?.status;
  const mkU = async (n) => (await mk('p' + n)).id;
  let seq = 0; const assess = (uid, key, over = {}) => { const o = { track: 'self', level: 2, state: 'initial', status: 'current', ...over }; return q(`insert into "SkillAssessments"("UserId","skillKey",track,level,state,"catalogVersion","rubricHash","evidenceRefs",confidence,"confidenceReasonCode","confidenceRuleVersion",authoring,status,"requestId","createdAt","updatedAt") values ($1,$2,$3,$4,$5,1,$6,'[]','low','x',1,'person',$7,$8,now(),now())`, [uid, key, o.track, o.level, o.state, 'a'.repeat(64), o.status, 'qa-' + stamp + '-' + (seq++)]); };
  let jobSeq = 0; const mkJob = async (uid) => (await q(`insert into "AiJobs"("UserId",kind,"contextVersion","contextHash","requestId",status,"createdAt","updatedAt") values ($1,'competency_extraction',1,$2,$3,'PENDING',now(),now()) returning id`, [uid, 'b'.repeat(64), 'qa-job-' + stamp + '-' + (jobSeq++)]))[0].id;
  const cand = async (uid, key, st = 'REVIEW_REQUIRED') => { const jid = await mkJob(uid); return q(`insert into "SkillCandidates"("jobId","UserId","skillKey",level,citations,status,"catalogVersion","createdAt","updatedAt") values ($1,$2,$3,2,'[]',$4,1,now(),now())`, [jid, uid, key, st]); };

  // v1 publicada con tres habilidades
  const d1 = await draft(); for (const k of ['comunicacion', 'planificacion', 'liderazgo']) await put(d1.id, k, def(k)); const p1 = await pub(d1.id);
  check('PRE catálogo v1 publicado con 3 habilidades por la ruta real', p1.status === 200 && p1.json.skillCount === 3, `${p1.status} ${JSON.stringify(p1.json)}`);
  const [u1, u2, u3, u4] = [await mkU(1), await mkU(2), await mkU(3), await mkU(4)];
  await assess(u1, 'planificacion'); await assess(u2, 'planificacion'); await assess(u1, 'planificacion', { track: 'review', state: 'reviewed' }); await assess(u3, 'liderazgo', { status: 'superseded' });
  let seedErr = ''; try { await cand(u3, 'comunicacion'); await cand(u2, 'liderazgo', 'REJECTED'); await cand(u4, 'comunicacion', 'ACCEPTED'); await cand(u1, 'liderazgo', 'INVALIDATED'); } catch (e) { seedErr = e.message.slice(0, 120); }
  info('siembra', 'evaluaciones: planificacion(u1×2 filas,u2)=2 personas/3 filas; liderazgo superseded(u3); propuestas: comunicacion REVIEW_REQUIRED(u3), liderazgo REJECTED(u2), comunicacion ACCEPTED(u4), liderazgo INVALIDATED(u1). Error de siembra de propuestas: ' + (seedErr || 'ninguno'));

  // ---------- H1
  const dr = await draft(); await call(AD, 'DELETE', `${C}/${dr.id}/skills/planificacion`); await call(AD, 'DELETE', `${C}/${dr.id}/skills/comunicacion`); await call(AD, 'DELETE', `${C}/${dr.id}/skills/liderazgo`); await put(dr.id, 'otra_habilidad', def('otra_habilidad'));
  const b1 = await pub(dr.id);
  check('H1a publicar sin habilidades en uso: 409 `skill_in_use` con `inUse` por habilidad y PERSONAS DISTINTAS (planificacion=2 aunque u1 tiene 2 filas; comunicacion=1 por la propuesta REVIEW_REQUIRED; liderazgo no estorba: superseded, REJECTED, ACCEPTED e INVALIDATED no cuentan)', b1.status === 409 && b1.json.code === 'skill_in_use' && JSON.stringify(b1.json.inUse) === JSON.stringify([{ skillKey: 'comunicacion', people: 1 }, { skillKey: 'planificacion', people: 2 }]), `${b1.status} ${JSON.stringify(b1.json)}`);
  check('H1b el 409 no identifica personas (ids, correos, nombres) y es bilingüe; no cambia nada: sigue borrador y la v1 sigue publicada', !new RegExp(`qa188-|QA188|UserId|@example|${u1}\\b.*people`).test(JSON.stringify(b1.json)) && /No se puede publicar/.test(b1.json.error) && /Cannot publish/.test(b1.json.error || b1.text), b1.text.slice(0, 300));
  check('H1c estado intacto tras el 409', (await status(dr.id)) === 'draft' && (await status(d1.id)) === 'published', `${await status(dr.id)}/${await status(d1.id)}`);
  const b2 = await pub(dr.id, SU);
  check('H1d el superadmin recibe el mismo 409 (no hay forma de forzar la publicación)', b2.status === 409 && b2.json.code === 'skill_in_use', b2.status);
  await put(dr.id, 'planificacion', def('planificacion')); const b3 = await pub(dr.id);
  check('H1e con `planificacion` incluida pero `comunicacion` aún faltando: sigue 409 y lista SOLO `comunicacion`', b3.status === 409 && JSON.stringify(b3.json.inUse) === JSON.stringify([{ skillKey: 'comunicacion', people: 1 }]), JSON.stringify(b3.json.inUse));
  await put(dr.id, 'comunicacion', def('comunicacion')); const b4 = await pub(dr.id);
  check('H1f al incluir las habilidades en uso, publica (200) y la vigente anterior pasa a archivada', b4.status === 200 && (await status(dr.id)) === 'published' && (await status(d1.id)) === 'archived', `${b4.status} ${await status(dr.id)}/${await status(d1.id)}`);
  const d3 = await draft(); await call(AD, 'DELETE', `${C}/${d3.id}/skills/planificacion`); await call(AD, 'DELETE', `${C}/${d3.id}/skills/comunicacion`); await call(AD, 'DELETE', `${C}/${d3.id}/skills/otra_habilidad`);
  const empty = await pub(d3.id);
  check('H1g borrador VACÍO con habilidades en uso: no publica (409 `skill_in_use` con las 2 habilidades; o 422 si exige habilidades)', [409, 422].includes(empty.status) && (empty.status === 422 || empty.json.inUse.length === 2), `${empty.status} ${empty.json?.code} ${JSON.stringify(empty.json?.inUse)}`);
  // 422 antes que 409
  await put(d3.id, 'incompleta', { type: 'transversal', labels: { es: 'solo es' } }); const inc = await pub(d3.id);
  check('H1h orden de validaciones: borrador con una habilidad INCOMPLETA y habilidades en uso omitidas → 422 `incomplete_catalog` antes que el 409', inc.status === 422 && inc.json.code === 'incomplete_catalog', `${inc.status} ${inc.json?.code}`);
  await call(AD, 'DELETE', `${C}/${d3.id}/skills/incompleta`);
  // evaluaciones superseded/rejected no estorban: limpiar y publicar sin habilidades
  await q('delete from "SkillCandidates"'); await q('delete from "SkillAssessments"'); await q('delete from "AiJobs"');
  await put(d3.id, 'solo_una', def('solo_una')); const free = await pub(d3.id);
  check('H1i sin evaluaciones ni propuestas, quitar habilidades sí se puede publicar', free.status === 200, `${free.status} ${JSON.stringify(free.json)}`);
  // primera publicación sin vigente
  info('H1j primera publicación', 'cubierta por PRE (no había catálogo vigente y publicó)');

  // ---------- H2 expectedUpdatedAt
  const d4 = await draft(); const created = await put(d4.id, 'solo_una', def('uno', { territories: ['con'] })); const read = (await call(AD, 'GET', `${C}/${d4.id}`)).json.skills.find(s => s.skillKey === 'solo_una');
  check('H2a PUT devuelve `updatedAt` y el GET trae la MISMA `updatedAt` por habilidad', created.status === 200 && !!created.json.updatedAt && read.updatedAt === created.json.updatedAt, `${created.json?.updatedAt} / ${read?.updatedAt}`);
  const ok = await put(d4.id, 'solo_una', { ...def('dos'), expectedUpdatedAt: read.updatedAt });
  check('H2b con `expectedUpdatedAt` = la leída → 200 y `updatedAt` nueva (distinta)', ok.status === 200 && ok.json.updatedAt !== read.updatedAt && new Date(ok.json.updatedAt) > new Date(read.updatedAt), `${ok.status} ${ok.json?.updatedAt}`);
  const stale = await put(d4.id, 'solo_una', { ...def('tres'), expectedUpdatedAt: read.updatedAt }); const row = (await q(`select labels,"updatedAt" from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='solo_una'`, [d4.id]))[0];
  check('H2c con la versión VIEJA → 409 `skill_changed` con la versión vigente (`current` con etiquetas y `updatedAt`) y SIN pisar (en base sigue «dos»)', stale.status === 409 && stale.json.code === 'skill_changed' && stale.json.current.labels.es === 'dos' && stale.json.current.updatedAt === ok.json.updatedAt && row.labels.es === 'dos', `${stale.status} ${stale.json?.code} ${stale.json?.current?.labels?.es}`);
  check('H2d el 409 es bilingüe y `current` no incluye identidades', /otra persona|Someone else/i.test(stale.text) && !/qa188-|@example/.test(stale.text), stale.json?.error);
  const legacy = await put(d4.id, 'solo_una', def('heredado'));
  check('H2e sin `expectedUpdatedAt` (clientes anteriores) gana el último: 200', legacy.status === 200 && (await q(`select labels from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='solo_una'`, [d4.id]))[0].labels.es === 'heredado', legacy.status);
  const before = JSON.stringify(await q(`select labels,rubric,territories,"updatedAt" from "SkillDefinitions" where "catalogId"=$1 order by "skillKey"`, [d4.id]));
  const badV = [['no-es-fecha', 'no-es-fecha'], ['número', 12345], ['null', null], ['objeto', {}], ['arreglo', ['2026-01-01T00:00:00Z']], ['vacío', ''], ['10k caracteres', '2026'.repeat(2500)], ['booleano', true], ['fecha imposible', '2026-13-45T99:99:99Z']]; const bv = [];
  for (const [n, v] of badV) { const r = await put(d4.id, 'solo_una', { ...def('x'), expectedUpdatedAt: v }); bv.push(n + '→' + r.status + ':' + (r.json?.code || '')); }
  check('H2f `expectedUpdatedAt` inválido (basura, número, null, objeto, arreglo, vacío, 10k caracteres, booleano, fecha imposible) → 400 `invalid_expected` y NO cambia nada', bv.every(x => /→400:invalid_expected$/.test(x)) && JSON.stringify(await q(`select labels,rubric,territories,"updatedAt" from "SkillDefinitions" where "catalogId"=$1 order by "skillKey"`, [d4.id])) === before, bv.filter(x => !/→400:invalid_expected$/.test(x)).join(' | ') || bv.join(' ; '));
  const cur = (await call(AD, 'GET', `${C}/${d4.id}`)).json.skills.find(s => s.skillKey === 'solo_una').updatedAt;
  const forms = [['ISO exacto del GET', x => x], ['con +00:00', x => x.replace('Z', '+00:00')], ['zona -05:00 equivalente', x => { const d = new Date(new Date(x).getTime() - 5 * 3600e3); return d.toISOString().replace('Z', '-05:00'); }], ['sin milisegundos (trunca)', x => x.replace(/.d+Z$/, 'Z')]];
  const fr = []; for (const [n, f] of forms) { const g = (await call(AD, 'GET', `${C}/${d4.id}`)).json.skills.find(s => s.skillKey === 'solo_una').updatedAt; const r = await put(d4.id, 'solo_una', { ...def('f ' + n), expectedUpdatedAt: f(g) }); fr.push(n + '→' + r.status); }
  info('H2g formas de fecha', fr.join(' ; ') + ' (cada forma sobre lectura fresca; la que trunca los milisegundos da 409 por diseño: comparación exacta al milisegundo)');
  check('H2h el ida y vuelta exacto de la `updatedAt` del GET nunca da 409 falso (10 guardados seguidos leyendo y devolviendo la fecha)', await (async () => { for (let i = 0; i < 10; i++) { const g = (await call(AD, 'GET', `${C}/${d4.id}`)).json.skills.find(s => s.skillKey === 'solo_una').updatedAt; const r = await put(d4.id, 'solo_una', { ...def('rt' + i), expectedUpdatedAt: g }); if (r.status !== 200) return false; } return true; })(), '');
  const meta = await put(d4.id, 'meta_x', { ...def('meta'), updatedAt: '2020-01-01T00:00:00.000Z' }); const mrow = (await q(`select labels,rubric from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='meta_x'`, [d4.id]))[0];
  check('H2i `updatedAt` y `expectedUpdatedAt` del cuerpo no se validan como contenido ni se guardan (200; sin esas claves en etiquetas ni rúbrica)', meta.status === 200 && mrow.rubric.updatedAt === undefined && mrow.labels.updatedAt === undefined && !JSON.stringify(mrow).includes('expected'), `${meta.status}`);
  const rem = await call(AD, 'DELETE', `${C}/${d4.id}/skills/solo_una`); const gone = await put(d4.id, 'solo_una', { ...def('y'), expectedUpdatedAt: cur });
  check('H2j habilidad QUITADA entretanto + versión → 409 `skill_changed` con `current: null`', rem.status === 200 && gone.status === 409 && gone.json.code === 'skill_changed' && gone.json.current === null, `${gone.status} ${JSON.stringify(gone.json?.current)}`);
  const nw = await put(d4.id, 'recien_creada', { ...def('nueva'), expectedUpdatedAt: new Date().toISOString() });
  info('H3-nueva', `crear una habilidad NUEVA enviando expectedUpdatedAt → ${nw.status} ${nw.json?.code || ''} (current=${JSON.stringify(nw.json?.current)}): el cliente no puede crear con versión; documentar para la pantalla`);

  const cd4 = await closeDraft(d4.id); info('cierre', 'borrador de H2 publicado para abrir el siguiente: ' + cd4.status);
  // ---------- H3 concurrencia
  const d5 = await draft(); await put(d5.id, 'carrera', def('base')); const base = (await call(AD, 'GET', `${C}/${d5.id}`)).json.skills.find(s => s.skillKey === 'carrera').updatedAt;
  for (const N of [2, 8]) {
    const g = (await call(AD, 'GET', `${C}/${d5.id}`)).json.skills.find(s => s.skillKey === 'carrera').updatedAt; const rs = await Promise.all(Array.from({ length: N }, (_, i) => put(d5.id, 'carrera', { ...def(`c${N}-${i}`), expectedUpdatedAt: g })));
    const w = rs.filter(r => r.status === 200), l = rs.filter(r => r.status === 409 && r.json?.code === 'skill_changed'); const final = (await q(`select labels from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='carrera'`, [d5.id]))[0].labels.es;
    check(`H3a ${N} guardados simultáneos con el MISMO expectedUpdatedAt: 1×200 + ${N - 1}×409 \`skill_changed\`, 0 5xx, el contenido final es el del ganador`, w.length === 1 && l.length === N - 1 && rs.every(r => r.status < 500) && final === w[0].json.labels.es, rs.map(r => r.status).join() + ` final=${final}`);
  }
  const gg = (await call(AD, 'GET', `${C}/${d5.id}`)).json.skills.find(s => s.skillKey === 'carrera').updatedAt; const mix = await Promise.all([put(d5.id, 'carrera', { ...def('mezcla'), expectedUpdatedAt: gg }), call(AD, 'DELETE', `${C}/${d5.id}/skills/carrera`), put(d5.id, 'carrera', { ...def('mezcla2'), expectedUpdatedAt: gg }), call(AD, 'DELETE', `${C}/${d5.id}/skills/carrera`)]);
  check('H3b guardar vs quitar a la vez (con y sin versión): sin 5xx ni deadlock; el estado final es coherente (la habilidad existe o no, sin filas duplicadas)', mix.every(r => r.status < 500) && (await q(`select count(*)::int n from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='carrera'`, [d5.id]))[0].n <= 1, mix.map(r => r.status).join());
  await put(d5.id, 'carrera', def('final'));
  const sv = await Promise.all([pub(d5.id), put(d5.id, 'carrera', def('durante')), put(d5.id, 'otra_nueva', def('durante2')), pub(d5.id)]);
  const pubd = (await q(`select id,status from "SkillCatalogs" where id=$1`, [d5.id]))[0]; const defsN = (await q(`select count(*)::int n from "SkillDefinitions" where "catalogId"=$1`, [d5.id]))[0].n; const pubFromRoute = sv.filter(r => r.status === 200 && r.json?.skillCount !== undefined);
  check('H3c publicar vs guardar a la vez (pool 5): sin 5xx ni deadlock; un solo publicado vigente; lo publicado coincide con lo contado en la respuesta; ediciones tardías → 409 `catalog_not_editable`/similar, no se pierde en silencio', sv.every(r => r.status < 500) && (await q(`select count(*)::int n from "SkillCatalogs" where status='published'`))[0].n === 1 && (pubFromRoute.length !== 1 || pubFromRoute[0].json.skillCount === defsN), sv.map(r => r.status + ':' + (r.json?.code || '')).join(' ') + ` publicado=${pubd.status} habilidades=${defsN}`);
  const idle = (await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%'`))[0].n; check('H3d no quedan transacciones colgadas', idle === 0, 'idle in tx=' + idle);

  // ---------- H4 territorios y validación
  const d6 = (await call(AD, 'POST', C)); const id6 = d6.json?.id ?? d6.json?.draftId; await put(id6, 'terr', def('terr', { territories: ['dir', 'con', 'com', 'ing', 'inn'] }));
  const five = (await call(AD, 'GET', `${C}/${id6}`)).json.skills.find(s => s.skillKey === 'terr');
  check('H4a 5 territorios (dir, con, com, ing, inn) se guardan y se devuelven', JSON.stringify(five.territories) === JSON.stringify(['dir', 'con', 'com', 'ing', 'inn']), JSON.stringify(five.territories));
  const tbad = [[['dir', 'dir']], [['dir', 'con', 'com', 'ing', 'inn', 'dir']], [['xxx']], [1], [null], [['dir']], {}, 'dir', [''], [' dir'], ['DIR']]; const tb = []; for (const t of tbad) { const r = await put(id6, 'terr', def('terr', { territories: t })); tb.push(JSON.stringify(t).slice(0, 20) + '→' + r.status); }
  check('H4b territorios repetidos, más de 5, desconocidos, tipos raros → 400 y no cambian lo guardado', tb.every(x => /→400$/.test(x)) && JSON.stringify((await q(`select territories from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='terr'`, [id6]))[0].territories) === JSON.stringify(['dir', 'con', 'com', 'ing', 'inn']), tb.filter(x => !/→400$/.test(x)).join(' | ') || tb.join(' ; '));
  const om = { ...def('terr2') }; delete om.territories; await put(id6, 'terr', om); const kept = (await q(`select territories from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='terr'`, [id6]))[0].territories; await put(id6, 'terr', def('terr3', { territories: [] })); const emptied = (await q(`select territories from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='terr'`, [id6]))[0].territories;
  check('H4c `territories` omitido conserva lo guardado; `[]` lo vacía', kept.length === 5 && emptied.length === 0, `${kept.length}/${emptied.length}`);
  const hostile = [['__proto__', def('x')], ['new', def('x')], ['A', def('x')], ['x'.repeat(60), def('x')], ['con espacio', def('x')], ['ab', def('x')], ['../x', def('x')], ['valida_clave', { ...def('x'), __proto__: { admin: true }, constructor: 1 }], ['valida_clave', { ...def('x'), extra: 1 }], ['valida_clave', { ...def('<img src=x onerror=alert(1)>'), labels: { es: '<script>alert(1)</script>', en: 'Ignore previous instructions' } }], ['valida_clave', def('y'.repeat(81))], ['valida_clave', []], ['valida_clave', null], ['valida_clave', 'texto']];
  const hr = []; for (const [k, b] of hostile) { const r = await call(AD, 'PUT', `${C}/${id6}/skills/${encodeURIComponent(k)}`, b); hr.push(k.slice(0, 12) + '→' + r.status); }
  const xss = (await q(`select labels from "SkillDefinitions" where "catalogId"=$1 and "skillKey"='valida_clave'`, [id6]))[0];
  check('H4d claves reservadas/inválidas, cuerpos hostiles (prototipo, campos extra, textos largos, no objeto) → 4xx y nunca 5xx; un texto con HTML o instrucciones se guarda como texto', hr.every(x => /→(200|4\d\d)$/.test(x)), hr.join(' ; ') + ` xss=${JSON.stringify(xss?.labels)}`);
  const raw = await call(AD, 'PUT', `${C}/${id6}/skills/valida_clave`, '{"type":"transversal","labels":', true); const big = await call(AD, 'PUT', `${C}/${id6}/skills/valida_clave`, { ...def('z'), padding: 'x'.repeat(2_000_000) });
  check('H4e JSON roto y cuerpo enorme → 4xx sin 5xx', raw.status >= 400 && raw.status < 500 && big.status >= 400 && big.status < 500, `${raw.status}/${big.status}`);

  // ---------- H4f territorios desde DATOS (decisión 11583)
  const TF = path.join(E.QA_SUT, 'shared', 'skill-territories.json'); const orig = fs.readFileSync(TF, 'utf8'); const j = JSON.parse(orig); const restore = () => fs.writeFileSync(TF, orig);
  try {
    const tl = await call(AD, 'GET', C + '/territories'); const deny4 = []; for (const [n, u] of [['profesional', TH], ['persona', PE], ['junta', BO], ['anon', null]]) deny4.push(n + ':' + (await call(u, 'GET', C + '/territories')).status);
    check('H4f1 GET /territories: admin y superadmin → 200 con los 5 actuales (id + estado `defined`); profesional, persona, junta y sin sesión → 401/403', tl.status === 200 && tl.json.territories.length === 5 && tl.json.territories.every(t => t.status === 'defined') && (await call(SU, 'GET', C + '/territories')).status === 200 && deny4.every(x => /:(401|403)$/.test(x)), tl.status + ' ' + JSON.stringify(tl.json).slice(0, 160) + ' ' + deny4.join());
    const sk = def('terr_datos'); const before = await put(id6, 'terr_datos', { ...sk, territories: ['nuevo1'] });
    j.territories.push({ id: 'nuevo1', status: 'in_definition' }, { id: 'nuevo2', status: 'in_definition' }, { id: 'nuevo3', status: 'in_definition' }); fs.writeFileSync(TF, JSON.stringify(j, null, 2));
    const t8 = await call(AD, 'GET', C + '/territories'); const okNew = await put(id6, 'terr_datos', { ...sk, territories: ['dir', 'nuevo1', 'nuevo2', 'nuevo3'] }); const all8 = await put(id6, 'terr_datos', { ...sk, territories: t8.json?.territories?.map(t => t.id) ?? [] }); const nine = await put(id6, 'terr_datos', { ...sk, territories: [...(t8.json?.territories?.map(t => t.id) ?? []), 'extra9'] });
    check('H4f2 añadir 3 territorios «in_definition» SOLO editando el archivo de datos (sin reiniciar ni tocar código): antes `nuevo1` → ' + before.status + '; después GET los lista 8 (3 `in_definition`), una habilidad puede usar los nuevos (200) y los 8 a la vez (200); un noveno desconocido → 400', before.status === 400 && t8.json.territories.length === 8 && t8.json.territories.filter(t => t.status === 'in_definition').length === 3 && okNew.status === 200 && all8.status === 200 && nine.status === 400, `antes=${before.status} lista=${t8.json?.territories?.length} nuevos=${okNew.status} los8=${all8.status} noveno=${nine.status}`);
    const lv = (await call(AD, 'GET', C + '/' + id6)).json.skills.find(x => x.skillKey === 'terr_datos'); const meta = JSON.stringify(t8.json.territories);
    check('H4f3 los territorios nuevos son SOLO id + estado: no traen niveles, nombres, habilidades ni roles inventados; la habilidad que los usa guarda solo lo que se le envió', !/level|nivel|label|name|rubric|skill/i.test(meta) && JSON.stringify(lv.territories) === JSON.stringify(t8.json.territories.map(t => t.id)), meta.slice(0, 200));
    restore(); const back = await call(AD, 'GET', C + '/territories'); const rd = await put(id6, 'terr_datos2', { ...sk, territories: ['nuevo1'] }); const stored = await call(AD, 'GET', C + '/' + id6);
    check('H4f4 al quitar los 3 del archivo vuelve a leer 5 (relectura por cambio de fecha del archivo) y `nuevo1` vuelve a dar 400; la habilidad guardada con territorios que ya no existen sigue siendo legible (GET 200)', back.json.territories.length === 5 && rd.status === 400 && stored.status === 200, `${back.json?.territories?.length} ${rd.status} ${stored.status}`);
    const broken = { 'JSON ilegible': '{ no es json', 'lista vacía': JSON.stringify({ territories: [] }), 'sin lista': JSON.stringify({ x: 1 }), 'ids repetidos': JSON.stringify({ territories: [{ id: 'dir', status: 'defined' }, { id: 'dir', status: 'defined' }] }), 'estado inválido': JSON.stringify({ territories: [{ id: 'dir', status: 'listo' }] }), 'id mal formado': JSON.stringify({ territories: [{ id: '../x', status: 'defined' }] }), 'entrada nula': JSON.stringify({ territories: [null] }), 'archivo vacío': '' }; const bk = [];
    for (const [n, c] of Object.entries(broken)) { fs.writeFileSync(TF, c); const g = await call(AD, 'GET', C + '/territories'); const pdir = await put(id6, 'terr_datos', { ...sk, territories: ['dir'] }); const punk = await put(id6, 'terr_datos', { ...sk, territories: ['cualquier_cosa'] }); const nt = def('sin_territorios'); delete nt.territories; const pnone = await put(id6, 'terr_datos', nt); const leak = /skill-territories|ENOENT|SyntaxError|at (Object|Module)|[A-Z]:[\\/]|\/Users\//.test(g.text + pdir.text + punk.text); bk.push({ n, g: g.status, pdir: pdir.status, punk: punk.status, pnone: pnone.status, leak }); }
    restore();
    check('H4f5 archivo ROTO (8 variantes: JSON ilegible, vacío, sin lista, repetidos, estado inválido, id mal formado, entrada nula, lista vacía): FALLA CERRADO — ni la lectura ni guardar territorios devuelven 200 (ni aceptan ids cualquiera), sin filtrar rutas ni pilas; guardar una habilidad SIN territorios sigue funcionando', bk.every(x => x.g >= 400 && x.pdir >= 400 && x.punk >= 400 && !x.leak && x.pnone === 200), bk.map(x => `${x.n}: get=${x.g} dir=${x.pdir} cualquiera=${x.punk} sin=${x.pnone}${x.leak ? ' FUGA' : ''}`).join(' | '));
    info('H4f6 códigos con el archivo roto', 'lectura y guardado devuelven: ' + [...new Set(bk.flatMap(x => [x.g, x.pdir, x.punk]))].join('/') + ' (5xx controlado = el servidor no acepta territorios; ver cuerpo para fuga)');
    const ok5 = await put(id6, 'terr_datos', { ...sk, territories: ['dir', 'con', 'com', 'ing', 'inn'] }); const hist = await put(id6, 'terr_datos', { ...sk, territories: ['dir', 'dir'] });
    check('H4f7 tras restaurar el archivo, los 5 actuales funcionan como antes (200) y los repetidos siguen dando 400', ok5.status === 200 && hist.status === 400, `${ok5.status}/${hist.status}`);
  } finally { restore(); }
  const cd6 = await closeDraft(id6); info('cierre', 'borrador de H4 publicado: ' + cd6.status);
  // ---------- H5 permisos
  const A5 = [['GET', C], ['POST', C], ['GET', `${C}/${id6}`], ['PUT', `${C}/${id6}/skills/terr`, def('z')], ['DELETE', `${C}/${id6}/skills/terr`], ['POST', `${C}/${id6}/publish`, {}]]; const deny = {};
  for (const [n, u] of [['profesional', TH], ['persona', PE], ['junta', BO], ['anon', null]]) { deny[n] = []; for (const [m, p, b] of A5) deny[n].push((await call(u, m, p, b)).status); }
  const expired = { token: jwt.sign({ id: AD.id, name: AD.name, role: 'admin', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '-10s' }) }; const ex = []; for (const [m, p, b] of A5) ex.push((await call(expired, m, p, b)).status);
  check('H5a profesional, persona, junta, sin sesión y token vencido → 401/403 en las 6 rutas; el catálogo no cambia', Object.values(deny).every(a => a.every(s => [401, 403].includes(s))) && ex.every(s => [401, 403].includes(s)) && (await status(id6)) === 'published', JSON.stringify(deny) + ' vencido=' + ex.join());
  const adm = await call(AD, 'GET', C), sup = await call(SU, 'GET', C); check('H5b admin y superadmin leen el catálogo (200)', adm.status === 200 && sup.status === 200, `${adm.status}/${sup.status}`);
  const smap = await call(PE, 'GET', '/api/skill-map'); info('H5c lectura de personas', `GET /api/skill-map → ${smap.status}; contiene «updatedAt»=${/updatedAt/.test(smap.text)} «inUse»=${/inUse|skill_in_use/.test(smap.text)} «expected»=${/expectedUpdatedAt/.test(smap.text)}`);
  check('H5d la lectura de personas (skill-map) no trae `inUse` ni versiones de borradores', !/inUse|skill_in_use|expectedUpdatedAt/.test(smap.text), smap.status);

  // ---------- H6 TOCTOU: evaluación nueva mientras se publica
  let leaked = 0, runs = 0, errs = 0; const pu = await mkU('h6');
  for (let i = 0; i < 25; i++) {
    const dd = await draft(); if (!dd?.id) { errs++; continue; } await call(AD, 'DELETE', `${C}/${dd.id}/skills/h6skill`); await put(dd.id, 'base_h6', def('base_h6'));
    await q('delete from "SkillAssessments" where "UserId"=$1', [pu]); const ensure = await q(`select id from "SkillDefinitions" where "skillKey"='h6skill' limit 1`);
    const [r] = await Promise.all([pub(dd.id), assess(pu, 'h6skill', { track: i % 2 ? 'self' : 'review' }).catch(() => null)]); runs++;
    if (r.status === 200) { const inPublished = (await q(`select count(*)::int n from "SkillDefinitions" d join "SkillCatalogs" c on c.id=d."catalogId" where c.status='published' and d."skillKey"='h6skill'`))[0].n; const hasCur = (await q(`select count(*)::int n from "SkillAssessments" where "UserId"=$1 and "skillKey"='h6skill' and status='current'`, [pu]))[0].n; if (hasCur && !inPublished) leaked++; }
    await q('delete from "SkillAssessments" where "UserId"=$1', [pu]);
  }
  info('H6 TOCTOU', `${runs} publicaciones con una evaluación de una habilidad AUSENTE del borrador creada en paralelo: ${leaked} dejaron una habilidad con nivel registrado fuera del vigente (errores de preparación: ${errs}). La comprobación y la publicación ocurren en una transacción que bloquea el catálogo, pero no bloquea evaluaciones: la ventana existe por diseño aunque sea corta`);

  const srvLog = (() => { try { return fs.readFileSync(E.SRVLOG, 'utf8'); } catch { return ''; } })(); const emails = [SU, AD, TH, BO, PE].map(u => u.email);
  check('LOG el registro del servidor no contiene correos ni contenido de habilidades', !emails.some(e => srvLog.includes(e)) && !/Revisor sintético|alert\(1\)/.test(srvLog), 'log ' + srvLog.length + ' bytes');
  const fails = results.filter(r => r.ok === false); console.log(`\nRESUMEN ${results.filter(r => r.ok).length}/${results.filter(r => 'ok' in r).length} ok; fallos: ${fails.map(f => f.id.slice(0, 4)).join(', ') || 'ninguno'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-188-servidor-pr217.json'), JSON.stringify({ pr: 217, head: E.QA_HEAD || null, results }, null, 2)); await db.end(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

// [QA-Claude] ES-281 (PR #239) · Contrato crisis / diario / no compartir con canarios PROPIOS (otra forma, otro idioma, otras rutas que las del PR) + revocación concurrente + E281-1.
//   QA_SUT=<carpeta del repo> QA_OUT=<carpeta> QA239_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es281-canarios-propios.cjs
// Solo loopback, base desechable propia, datos sintéticos, 0 IA (el proveedor es un doble que registra lo que recibe).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
process.chdir(SUT);
process.env.DATA_RIGHTS_ENABLED = 'true';
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(JSON.stringify({ id, ok, detail: String(detail).slice(0, 1200) })); };
const info = (id, detail) => { results.push({ id, info: detail }); console.log(JSON.stringify({ id, info: String(detail).slice(0, 1200) })); };

(async () => {
  const { MOUNTS, routesOf, api, base, mkUser, q, http, provider } = await startRealApi(t, { envVar: 'QA239_DB', prefix: 'qa239c' });
  const stamp = crypto.randomBytes(3).toString('hex').toUpperCase();
  const therapist = await mkUser('therapist'); const other = await mkUser('therapist'); const sup = await mkUser('superadmin'); const adm = await mkUser('admin'); const board = await mkUser('board');
  const kinds = { con: 'autoriza', sin: 'nunca autoriza', rev: 'autoriza y retira' };
  const people = {};
  for (const key of Object.keys(kinds)) {
    const p = await mkUser('user', { therapistId: therapist.id });
    const c = { diary: `ÑANDÚ-DIARIO-${key}-${stamp}-` + 'relato largo '.repeat(120), crisisEs: `me quiero matar CRISISES${key}${stamp}`, crisisEn: `I want to end my life CRISISEN${key}${stamp}`, chat: `CHATCANARIO${key}${stamp}`, name: `ÁngelaCanario${key}${stamp}`, email: `canario.${key}.${stamp}@example.test`.toLowerCase(), evidence: `EVIDENCIACANARIO${key}${stamp}` };
    await q('UPDATE "Users" SET name=$2, email=$3 WHERE id=$1', [p.id, c.name, c.email]);
    people[key] = { ...p, c };
  }
  const logs = []; const orig = {}; for (const lv of ['log', 'info', 'warn', 'error', 'debug']) { orig[lv] = console[lv]; console[lv] = (...a) => { logs.push(a.map((x) => (x instanceof Error ? x.message + '\n' + x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }; }
  const restoreLogs = () => { for (const lv of Object.keys(orig)) console[lv] = orig[lv]; };
  try {
    for (const key of ['con', 'rev']) await http(people[key], 'PUT', '/api/consents/therapist_sharing', { status: 'granted' });
    for (const [key, p] of Object.entries(people)) {
      const c = p.c;
      await http(p, 'POST', '/api/diary', { date: '2026-10-02', content: c.diary });
      await http(p, 'POST', '/api/mood/checkin', { mood: 2 });
      const before = provider.calls;
      const r1 = await http(p, 'POST', '/api/chat', { message: c.crisisEs, requestId: crypto.randomUUID() });
      const r2 = await http(p, 'POST', '/api/chat', { message: c.crisisEn, requestId: crypto.randomUUID() });
      if (!(r1.body && r1.body.interrupted && r2.body && r2.body.interrupted)) info('crisis-no-interrumpe', `${key}: ${r1.status} ${JSON.stringify(r1.body).slice(0, 80)} / ${r2.status} ${JSON.stringify(r2.body).slice(0, 80)}`);
      if (provider.calls !== before) info('crisis-llama-IA', `${key}: llamadas ${provider.calls - before}`);
      await http(p, 'POST', '/api/evidence', { payload: { title: c.evidence, situation: 'x' }, status: 'draft', requestId: crypto.randomUUID() }); // solo informativo: puede no existir como POST
    }
    // Revocación a mitad con lecturas ESCALONADAS: ninguna que EMPIECE después de la respuesta de la revocación puede ver datos.
    const readPath = `/api/therapist/pacientes/${people.rev.id}/historial`;
    const reads = []; let revokeStart = 0; let revokeEnd = 0;
    const startedAt = Date.now();
    let stop = false; const inflight = [];
    const spawn = async () => { for (let i = 0; !stop; i += 1) { const s = Date.now() - startedAt; inflight.push(http(therapist, 'GET', readPath).then((out) => reads.push({ s, e: Date.now() - startedAt, status: out.status }))); await new Promise((r) => setTimeout(r, 15)); } };
    const spawner = spawn();
    const revoker = (async () => { await new Promise((r) => setTimeout(r, 150)); revokeStart = Date.now() - startedAt; const out = await http(people.rev, 'PUT', '/api/consents/therapist_sharing', { status: 'revoked' }); revokeEnd = Date.now() - startedAt; await new Promise((r) => setTimeout(r, 500)); stop = true; return out; })();
    await Promise.all([spawner, revoker]); await Promise.all(inflight);
    const late = reads.filter((r) => r.s > revokeEnd); const lateBad = late.filter((r) => r.status !== 403);
    const err5 = reads.filter((r) => r.status >= 500);
    check('C9 revocación concurrente: ninguna lectura que empieza tras la revocación recibe datos; sin 5xx', lateBad.length === 0 && err5.length === 0 && late.length >= 5, `lecturas ${reads.length}; empiezan tras la revocación (${late.length}); fuera de 403: ${lateBad.length}; 5xx: ${err5.length}; revocación ${revokeStart}-${revokeEnd} ms; estados ${JSON.stringify(reads.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}))}`);

    // Barrido: TODAS las rutas GET (sin y con parámetro) para profesional, profesional ajeno, administración, superadministración y junta, con los ids de las 3 personas
    const { routes } = routesOf(MOUNTS, api);
    const gets = routes.filter(([m, p]) => m === 'GET' && p.startsWith('/api') && !/\/(logout)/.test(p));
    const canaries = Object.values(people).flatMap((p) => [p.c.diary.slice(0, 40), p.c.crisisEs, p.c.crisisEn, p.c.chat, p.c.evidence]);
    const crisisWords = /(me quiero matar|end my life)/i;
    const actors = { terapeuta: therapist, 'terapeuta-ajeno': other, admin: adm, superadmin: sup, junta: board };
    const found = []; let probes = 0; const idsToUse = [...Object.values(people).map((p) => String(p.id)), '2147483000'];
    for (const [, p] of gets) {
      const urls = p.includes(':') ? [...new Set(idsToUse)].map((id) => p.replace(/:[A-Za-z]+/g, id)) : [p];
      for (const url of urls) for (const [who, actor] of Object.entries(actors)) {
        const res = await fetch(base + url, { headers: { Authorization: 'Bearer ' + actor.token } }); const text = await res.text(); probes += 1;
        for (const cn of canaries) if (text.includes(cn)) found.push(`${who} GET ${url}: canario ${cn.slice(0, 30)}`);
        if (crisisWords.test(text)) found.push(`${who} GET ${url}: frase de crisis`);
        for (const k of ['sin', 'rev']) { const c = people[k].c; if (!/^(admin|superadmin)$/.test(who) && (text.includes(c.email) || text.includes(c.name))) found.push(`${who} GET ${url}: identidad de «${k}»`); }
      }
    }
    check('C8 ningún canario de diario, crisis, chat ni evidencia (ni identidad de quien no autorizó o retiró) en ninguna lectura GET de profesional, profesional ajeno, administración, superadministración ni junta', found.length === 0, `${probes} solicitudes sobre ${gets.length} rutas GET; hallazgos: ${found.slice(0, 8).join(' | ') || 'ninguno'}`);
    // C4b A/B en LISTADOS y lecturas sin id: cada persona recorre todas las rutas GET con los ids de las otras y no ve nada de las otras
    const ab = []; let abProbes = 0;
    for (const [mine, me] of Object.entries(people)) {
      const others = Object.entries(people).filter(([k]) => k !== mine).map(([, o]) => o);
      for (const [, p] of gets) {
        const urls = p.includes(':') ? [...new Set([...others.map((o) => String(o.id)), '2147483000'])].map((id) => p.replace(/:[A-Za-z]+/g, id)) : [p];
        for (const url of urls) {
          const res = await fetch(base + url, { headers: { Authorization: 'Bearer ' + me.token } }); const text = await res.text(); abProbes += 1;
          for (const o of others) for (const cn of [o.c.diary.slice(0, 40), o.c.crisisEs, o.c.crisisEn, o.c.chat, o.c.evidence, o.c.email, o.c.name]) if (text.includes(cn)) ab.push(mine + ' GET ' + url + ' ve datos de otra persona');
        }
      }
    }
    check('C4b ninguna persona ve datos de otra en ningún GET (listados y rutas con id ajeno)', ab.length === 0, abProbes + ' solicitudes; ' + (ab.slice(0, 6).join(' | ') || 'ninguna fuga'));
    // La identidad (nombre/correo) de quien autoriza SÍ puede verla su profesional; la administración ve usuarios por rol. Se reporta lo que ve cada quien de «con»:
    const adminSees = []; for (const [who, actor] of Object.entries({ admin: adm, superadmin: sup })) { const r = await fetch(base + '/api/admin/usuarios', { headers: { Authorization: 'Bearer ' + actor.token } }); const tx = await r.text(); adminSees.push(`${who}: nombre ${tx.includes(people.sin.c.name)} correo ${tx.includes(people.sin.c.email)}`); }
    info('administración y datos de identidad', adminSees.join(' ; ') + ' (del rol; no es fuga si es solo identidad)');

    // Exportación propia: contiene lo propio y NADA de otras personas
    const expProblems = []; const expInfo = [];
    for (const [key, p] of Object.entries(people)) for (const type of ['personal', 'professional']) {
      const exp = await http(p, 'POST', '/api/exports/preview', { type, locale: 'es' }); const expText = JSON.stringify(exp.body);
      if (type === 'professional' && exp.status === 503 && /professional_contract_pending/.test(expText)) { expInfo.push(key + '/professional: 503 professional_contract_pending (no existe aún: no verificado)'); continue; }
      if (exp.status >= 300) { expProblems.push(key + ' ' + type + ': estado ' + exp.status + ' ' + expText.slice(0, 80)); continue; }
      for (const [ok, o] of Object.entries(people)) if (ok !== key) for (const x of [o.c.diary.slice(0, 40), o.c.crisisEs, o.c.crisisEn, o.c.chat, o.c.evidence, o.c.email]) if (expText.includes(x)) expProblems.push(key + ' ' + type + ': contiene datos de ' + ok);
      if (type === 'professional') for (const x of [p.c.diary.slice(0, 40), p.c.crisisEs, p.c.crisisEn, p.c.chat]) if (expText.includes(x)) expProblems.push(key + ' professional: contiene su propio diario/crisis/chat');
      expInfo.push(key + '/' + type + ': ' + exp.status + (type === 'personal' ? ' propio diario ' + expText.includes(p.c.diary.slice(0, 40)) : ''));
    }
    check('C8b las exportaciones (personal y profesional) no contienen datos de otras personas, y la profesional no lleva diario, crisis ni chat', expProblems.length === 0, expProblems.slice(0, 6).join(' | ') || expInfo.join(' ; '));

    // Lo que se envía a la IA: diario nunca, correo nunca; la frase de crisis solo por el historial del siguiente mensaje ordinario (E281-1)
    const ai = provider.requests.join('\n');
    const diaryInAi = Object.values(people).filter((p) => ai.includes(p.c.diary.slice(0, 40)));
    check('C8c el diario nunca viaja al proveedor de IA sin elegirlo la persona', diaryInAi.length === 0, `llamadas al proveedor: ${provider.calls}; diarios encontrados: ${diaryInAi.length}`);
    const emailInAi = Object.values(people).filter((p) => ai.includes(p.c.email) || ai.includes(p.c.name));
    check('C8d nombre y correo nunca viajan al proveedor de IA', emailInAi.length === 0, `encontrados: ${emailInAi.length}`);

    // E281-1: cuántos mensajes ordinarios posteriores arrastran la frase
    const p = people.con; const carried = [];
    for (let i = 1; i <= 14; i += 1) { const before = provider.requests.length; await http(p, 'POST', '/api/chat', { message: `Hoy hablo de mi semana, parte ${i}`, requestId: crypto.randomUUID() }); const body = provider.requests.slice(before).join(''); carried.push(/CRISISES|CRISISEN/.test(body) ? 1 : 0); }
    info('E281-1 cuántos mensajes ordinarios posteriores llevan la frase de crisis al proveedor', `secuencia (1 = la lleva): ${carried.join('')} → ${carried.reduce((a, b) => a + b, 0)} de 14 (HISTORY_LIMIT=20 mensajes)`);
    // ¿llega a otra función de IA (resumen del profesional, recomendaciones)?
    const lastReqs = provider.requests.map((x) => JSON.parse(x));
    const nonChat = lastReqs.filter((j) => !String(j.system).startsWith('You are Elevation') && /CRISISES|CRISISEN/.test(JSON.stringify(j)));
    check('E281-1b la frase de crisis solo viaja en solicitudes de chat (ni resumen, ni recomendaciones, ni puente)', nonChat.length === 0, `solicitudes no-chat con la frase: ${nonChat.length}`);
    const row = (await q('SELECT count(*)::int n FROM "Messages" WHERE "UserId"=$1', [p.id]))[0];
    info('E281-1 persistencia', `mensajes guardados de la persona: ${row.n} (la frase queda cifrada en Messages; el borrado de datos la purga con la persona)`);

    // Logs
    const logText = logs.join('\n');
    const inLogs = canaries.filter((cn) => logText.includes(cn)).concat(crisisWords.test(logText) ? ['frase de crisis'] : []);
    check('C8e los logs del servidor no contienen canarios ni la frase de crisis', inLogs.length === 0, `líneas de log: ${logs.length}; coincidencias: ${inLogs.join(',') || 'ninguna'}`);
  } finally { restoreLogs(); }
  fs.writeFileSync(path.join(OUT, `ES-281-canarios-propios-${process.env.TAG || 'pr'}.json`), JSON.stringify(results, null, 1));
  console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length);
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });

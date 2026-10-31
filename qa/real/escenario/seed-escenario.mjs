// [QA-Claude] ESCENARIO DE PRUEBAS COMPLETO para el barrido de aceptación (ES-45): personas, terapeutas y administración, TODO SINTÉTICO.
// Crea cuentas con contraseñas aleatorias (solo se guardan en un archivo LOCAL que no se versiona) y carga datos de ejemplo por la API pública y la API de administración.
// Uso:  QA_API=<url del entorno> QA_ENV=local|staging [QA_DB_URL=<base local, solo para ascender al admin>] [QA_SEED_AI=1] node qa/real/escenario/seed-escenario.mjs
//  - QA_SEED_AI=1 sube una hoja de vida y escribe un chat (llaman al modelo; en un entorno real gastan tokens). Por defecto se omite fuera de local.
//  - Solo contra entornos de PRUEBA (local o staging). Nunca producción. No imprime contraseñas: las deja en qa/real/escenario/credenciales-<QA_ENV>.json.
import { randomBytes, randomUUID } from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const E = process.env; const API = (E.QA_API || '').replace(/\/$/, ''); const ENV = E.QA_ENV || 'local'; const here = path.dirname(fileURLToPath(import.meta.url));
if (!API) { console.error('Falta QA_API'); process.exit(2); }
if (/prod|www\./i.test(API) && !/staging|localhost|127\.0\.0\.1/i.test(API)) { console.error('Este script no se ejecuta contra producción.'); process.exit(2); }
const SEED_AI = E.QA_SEED_AI === '1' || ENV === 'local'; const stamp = Date.now().toString(36);
const pw = () => { const b = randomBytes(24).toString('base64url'); return b.slice(0, 14) + 'aA1!' + b.slice(14, 18); };
const j = async (m, u, { t, body } = {}) => { const h = {}; if (t) h.Authorization = 'Bearer ' + t; let b = body; if (body !== undefined && !(body instanceof FormData)) { h['content-type'] = 'application/json'; b = JSON.stringify(body); } const r = await fetch(API + u, { method: m, headers: h, body: b }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
const out = []; const log = (id, ok, d = '') => { out.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 200) })); };

// ── cuentas del escenario (rol, perfil y para qué sirven en el barrido)
const PEOPLE = [
  { key: 'P1', slug: 'lucia', name: 'Lucía Prueba (docente → datos)', lang: 'es', rich: true },
  { key: 'P2', slug: 'andres', name: 'Andrés Prueba (contador, poco contenido)', lang: 'es', rich: false },
  { key: 'P3', slug: 'sam', name: 'Sam Test (EN, coordinator)', lang: 'en', rich: true },
  { key: 'P4', slug: 'nuevo', name: 'Nora Nueva (sin nada: estados vacíos)', lang: 'es', rich: false, empty: true },
  { key: 'P5', slug: 'borrar', name: 'Beto Borrar (exportar y eliminar)', lang: 'es', rich: false },
  { key: 'P6', slug: 'camila', name: 'Camila Prueba (aislamiento frente a Lucía)', lang: 'es', rich: true },
];
const STAFF = [{ key: 'T1', slug: 'terapeuta1', name: 'Teo Terapeuta (vinculado a Lucía)', role: 'therapist' }, { key: 'T2', slug: 'terapeuta2', name: 'Tania Terapeuta (sin vínculos)', role: 'therapist' }];
const ADMIN = { key: 'ADM', slug: 'admin', name: 'Ada Administradora', role: 'admin' };
const PHASE2 = E.QA_PHASE2 === '1'; const credFile = path.join(here, `credenciales-${ENV}.json`); const accounts = {}; const mkEmail = slug => `qa-${slug}-${stamp}@example.test`;
if (PHASE2) { const saved = JSON.parse(fs.readFileSync(credFile, 'utf8')).cuentas; for (const [k, v] of Object.entries(saved)) accounts[k] = { key: k, name: v.nombre, email: v.email, password: v.password, role: v.rol === 'persona' ? undefined : v.rol }; }
if (!PHASE2) for (const p of [...PEOPLE, ADMIN]) { const a = { ...p, email: mkEmail(p.slug), password: pw() }; const r = await j('POST', '/api/register', { body: { name: a.name, email: a.email, password: a.password } }); log(`registro ${p.key}`, r.status === 201, 'status ' + r.status); accounts[p.key] = a; }
const login = async a => { let r = await j('POST', '/api/login', { body: { email: a.email, password: a.password } }); for (let i = 0; i < 3 && r.status === 429; i++) { await new Promise(x => setTimeout(x, 62000)); r = await j('POST', '/api/login', { body: { email: a.email, password: a.password } }); } a.token = r.json?.token ?? r.json?.accessToken ?? null; try { a.id = r.json?.user?.id ?? r.json?.id ?? JSON.parse(Buffer.from(a.token.split('.')[1], 'base64url').toString()).id ?? null; } catch { a.id = null; } return !!a.token; };

// ── el administrador: ascenso (local por SQL; en staging lo hace Infra con una sola sentencia)
let adminOk = false;
if (E.QA_DB_URL) { const req = createRequire(path.join(E.QA_SUT || '.', 'backend', 'package.json')); const { Client } = req('pg'); const c = new Client({ connectionString: E.QA_DB_URL, ssl: false }); await c.connect(); await c.query('update "Users" set role=$1 where email=$2', ['admin', accounts.ADM.email]); await c.end(); }
for (const a of Object.values(accounts)) await login(a);
const probe = await j('GET', '/api/admin/usuarios', { t: accounts.ADM.token }); adminOk = probe.status === 200;
if (!adminOk) { const s = `update "Users" set role='admin' where email='${accounts.ADM.email}';`; fs.writeFileSync(path.join(here, `PEDIR-A-INFRA-${ENV}.sql`), `-- [QA-Claude] Una sola sentencia para ascender al administrador sintético de QA (${ENV}). No contiene contraseñas.\n${s}\n`); console.log('PENDIENTE: el administrador necesita rol admin. SQL para Infra en qa/real/escenario/PEDIR-A-INFRA-' + ENV + '.sql'); }
log('administrador con rol admin', adminOk, adminOk ? '' : 'pendiente de Infra');

// ── terapeutas y vínculo (por la API de administración)
if (adminOk) {
  for (const s of STAFF) { if (accounts[s.key]) continue; const a = { ...s, email: mkEmail(s.slug), password: pw() }; const r = await j('POST', '/api/admin/usuarios', { t: accounts.ADM.token, body: { name: a.name, email: a.email, password: a.password, role: 'therapist' } }); log(`alta ${s.key}`, r.status === 201 || r.status === 200, 'status ' + r.status); accounts[s.key] = a; await login(a); }
}

// ── catálogo de habilidades sintético (solo si el entorno no tiene uno publicado)
if (adminOk) {
  const sm = await j('GET', '/api/skill-map', { t: accounts.P1.token });
  if (sm.status === 503 || sm.status === 404) {
    const lv = p => Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `${p} nivel ${n}`, en: `${p} level ${n}` }]));
    const SK = { liderazgo: ['Liderazgo', 'Leadership'], comunicacion: ['Comunicación', 'Communication'], analisis_datos: ['Análisis de datos', 'Data analysis'], ensenanza: ['Enseñanza', 'Teaching'], gestion_proyectos: ['Gestión de proyectos', 'Project management'], planificacion: ['Planificación', 'Planning'] };
    const cd = await j('POST', '/api/admin/skill-catalog', { t: accounts.ADM.token }); let ok = cd.status < 300;
    for (const [k, [es, en]] of Object.entries(SK)) { const r = await j('PUT', `/api/admin/skill-catalog/${cd.json?.id}/skills/${k}`, { t: accounts.ADM.token, body: { type: 'transversal', labels: { es, en }, rubric: { levels: lv(es), source: 'Rúbrica sintética de QA', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } } }); ok = ok && r.status < 300; }
    const pub = await j('POST', `/api/admin/skill-catalog/${cd.json?.id}/publish`, { t: accounts.ADM.token }); log('catálogo de habilidades sintético publicado', ok && pub.status < 300, `crear=${cd.status} publicar=${pub.status}`);
  } else info('catálogo', 'el entorno ya tiene catálogo publicado: no se toca');
}

// ── datos de las personas (con su propia sesión)
const ctxFor = (p) => p.empty ? null : ({ preferredLanguage: p.lang, residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: p.key === 'P3' ? 'Project coordinator' : p.key === 'P2' ? 'Contador' : 'Docente de matemáticas', interests: p.key === 'P3' ? 'Planning, mentoring, team leadership' : 'Estadística, tableros, enseñar a otros', availabilityMinutesPerWeek: p.rich ? 480 : 240, careerGoal: p.key === 'P3' ? 'Lead a team formally' : 'Pasar a un trabajo con datos de forma gradual', careerConstraints: p.rich ? 'Poco tiempo entre semana' : '', sector: p.key === 'P3' ? 'Logistics' : 'Educación', totalYearsExperience: p.rich ? 12 : 8, experience: [], education: [], declaredSkills: [], languages: [] });
for (const p of (PHASE2 ? [] : PEOPLE)) {
  const a = accounts[p.key]; if (!a.token) continue; const c = ctxFor(p);
  if (c) { const g = await j('GET', '/api/user/context', { t: a.token }); const v = g.json?.version ?? g.json?.context?.version ?? 0; const r = await j('PUT', '/api/user/context', { t: a.token, body: { schemaVersion: 2, expectedVersion: Number.isInteger(v) ? v : 0, action: 'continue', context: c } }); log(`contexto ${p.key}`, r.status === 200, `status ${r.status} ${r.json?.error ?? ''} ${(r.json?.fields ?? []).join(',')}`); }
  if (p.rich) {
    for (const purpose of ['insights_chat', 'insights_diary', 'professional_bridge']) await j('PUT', '/api/consents/' + purpose, { t: a.token, body: { status: 'granted' } });
    const d1 = await j('POST', '/api/diary', { t: a.token, body: { date: '2026-10-20', content: p.lang === 'en' ? 'Today I coordinated the schedule for three projects. I like planning and keeping the team calm.' : 'Hoy ayudé a una compañera con las hojas de cálculo. Me di cuenta de que disfruto enseñar y valoro trabajar con claridad.' } });
    const d2 = await j('POST', '/api/diary', { t: a.token, body: { date: '2026-10-22', content: p.lang === 'en' ? 'I want to move gradually into people management. I worry a little about time.' : 'Quiero cambiar de a poco hacia un trabajo con datos. Me preocupa un poco el tiempo entre semana.' } });
    log(`diario ${p.key}`, d1.status < 300 && d2.status < 300, `${d1.status}/${d2.status}`);
    const ev = await j('POST', '/api/evidence', { t: a.token, body: { payload: { title: p.lang === 'en' ? 'Coordinated a logistics project' : 'Tablero de notas para mi colegio', situation: p.lang === 'en' ? 'A 6-person team had to ship on time.' : 'Los profesores no veían el avance de los cursos.', responsibility: { text: p.lang === 'en' ? 'I planned the work.' : 'Armé el tablero.' }, actions: [{ text: p.lang === 'en' ? 'Set weekly checkpoints' : 'Recogí datos y los ordené' }], delivered: { text: p.lang === 'en' ? 'On-time delivery' : 'Un tablero que se usa cada mes' }, observedEffect: { known: false }, autonomy: 'assisted' }, status: 'confirmed', requestId: randomUUID() } });
    log(`evidencia ${p.key}`, ev.status < 300, 'status ' + ev.status);
  }
  if (p.key === 'P2') { const d = await j('POST', '/api/diary', { t: a.token, body: { date: '2026-10-21', content: 'Hoy cerré el mes contable sin retrasos.' } }); log('diario P2', d.status < 300, '' + d.status); }
}
// consentimiento para que el terapeuta vinculado vea lo permitido de Lucía
if (accounts.T1?.id && accounts.P1.token) { const l = await j('PUT', `/api/admin/usuarios/${accounts.P1.id}/asignar-terapeuta`, { t: accounts.ADM.token, body: { therapistId: accounts.T1.id } }); const c = await j('PUT', '/api/consents/therapist_sharing', { t: accounts.P1.token, body: { status: 'granted' } }); log('vínculo T1 ↔ P1 y permiso therapist_sharing', l.status < 300 && c.status < 300, `${l.status}/${c.status}`); }
// IA (solo local o con QA_SEED_AI=1): hoja de vida y un chat para Lucía
if (!PHASE2 && SEED_AI && accounts.P1.token && E.QA_SUT) {
  const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const fx = req(path.join(E.QA_SUT, 'backend', 'test', 'support', 'pdfFixtures.cjs')); await j('PUT', '/api/consents/resume_ai_reading', { t: accounts.P1.token, body: { status: 'granted' } });
  const fd = new FormData(); fd.append('requestId', randomUUID()); fd.append('cv', new Blob([fx.makeTextPdf(['Lucía Prueba - Docente de matemáticas', 'Correo: lucia.prueba@example.test', 'Doce años de docencia en secundaria.', 'Preparé tableros mensuales con notas de los cursos.', 'Habilidades: Excel, estadística básica, comunicación'])], { type: 'application/pdf' }), 'cv.pdf'); const up = await j('POST', '/api/user/resumes/analyze', { t: accounts.P1.token, body: fd }); log('hoja de vida P1 (IA)', up.status === 200, '' + up.status);
  const ch = await j('POST', '/api/chat', { t: accounts.P1.token, body: { message: 'Quiero pasar de dar clases a trabajar con datos, pero tengo poco tiempo entre semana.', requestId: 'q' + randomBytes(5).toString('hex') } }); log('chat P1 (IA)', ch.status === 200, '' + ch.status);
} else info('IA omitida', 'QA_SEED_AI no activo: hoja de vida y chat los crea la persona durante el barrido');
function info(id, d) { console.log(JSON.stringify({ id, info: d })); }

// ── credenciales (archivo local, no versionado) y descripción del escenario (sin contraseñas)
const creds = Object.fromEntries(Object.entries(accounts).map(([k, a]) => [k, { rol: a.role ?? 'persona', nombre: a.name, email: a.email, password: a.password }]));
fs.writeFileSync(path.join(here, `credenciales-${ENV}.json`), JSON.stringify({ entorno: ENV, api: API, creado: new Date().toISOString(), cuentas: creds }, null, 2));
const bad = out.filter(o => !o.ok); console.log(JSON.stringify({ resumen: `${out.length - bad.length}/${out.length} pasos correctos`, fallidos: bad.map(b => b.id), credenciales: `qa/real/escenario/credenciales-${ENV}.json (local, no versionado)` }));

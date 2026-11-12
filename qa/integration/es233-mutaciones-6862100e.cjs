// [QA-Claude] Mutaciones del permiso de la fuente — cabeza 6862100e (PR #253). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/'; const m = process.argv[2];
const file = (n) => fs.readFileSync(B + n, 'utf8'); const save = (n, s) => fs.writeFileSync(B + n, s);
const edit = (n, a, b) => { const s = file(n); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 60)); save(n, s.replace(a, () => b)); };
const editNth = (n, a, b, k) => { const s = file(n); const parts = s.split(a); if (parts.length - 1 < k) throw new Error('faltan ocurrencias ' + m); let i = -1; for (let j = 0; j < k; j += 1) i = s.indexOf(a, i + 1); save(n, s.slice(0, i) + b + s.slice(i + a.length)); };
const CC = 'careerContext.js', CO = 'consent.js', EV = 'evidence.js', EP = 'evidenceProposal.js';
const PREV = "  for (const purpose of sourcePurposes(clean)) if (!await consent.hasConsent(userId, purpose)) throw sourceConsentError('source_consent_required');\n";
const CONF = "    for (const purpose of sourcePurposes(clean).sort()) if (!await consent.isGrantedIn(userId, purpose, transaction)) throw sourceConsentError('source_consent_revoked');\n";
const LOCK = "    const rows = await CareerContextVersion.findAll({ where: { UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });\n";
const fn = (name, repl) => { const s = file(CO); const i = s.indexOf('async function isGrantedIn'); const j = s.indexOf('}\n', i); save(CO, s.slice(0, i) + repl(s.slice(i, j)) + s.slice(j)); };
if (m === 'M1') edit(CC, PREV, '');
if (m === 'M2') edit(CC, CONF, '');
if (m === 'M3') edit(CC, 'await consent.isGrantedIn(userId, purpose, transaction)', 'await consent.hasConsent(userId, purpose)');
if (m === 'M4') fn('', (b) => { if (!b.includes(', lock: Transaction.LOCK.SHARE')) throw new Error('M4'); return b.replace(', lock: Transaction.LOCK.SHARE', ''); });
if (m === 'M5') fn('', (b) => { if (!b.includes('return isEffective(row, purpose);')) throw new Error('M5'); return b.replace('return isEffective(row, purpose);', 'return true;'); });
if (m === 'M6') edit(CC, "diary_entry: 'insights_diary', chat_turn: 'insights_chat', resume_version: 'insights_resume'", "diary_entry: 'insights_chat', chat_turn: 'insights_diary', resume_version: 'insights_resume'");
if (m === 'M7') edit(CC, ", resume_version: 'insights_resume' });\nconst sourcePurposes", " });\nconst sourcePurposes");
if (m === 'M8') edit(CC, CONF, CONF.replace('.sort())', '.sort().slice(0, 1))'));
if (m === 'M8b') edit(CC, PREV, PREV.replace('sourcePurposes(clean))', 'sourcePurposes(clean).slice(0, 1))'));
if (m === 'M9') { const o = "    const origins = await resolveOrigins(userId, clean, transaction);\n"; const s = file(CC); const i = s.indexOf(CONF); const j = s.indexOf(o); if (i < 0 || j < 0) throw new Error('M9'); /* poner el origen ANTES de la comprobación si ya lo está: se mueve el origen después */ save(CC, s.replace(o, '').replace(CONF, CONF + o)); }
if (m === 'M10') edit(CC, "throw sourceConsentError('source_consent_revoked');", "throw sourceConsentError('consent_required');");
if (m === 'R1') { edit(CC, CONF, ''); edit(CC, LOCK, LOCK + CONF); } // ORDEN INVERSO: versiones primero, permiso después (el interbloqueo de E253-1)
const EVCHK = "    if (needsConsent && !await consent.isGrantedIn(userId, SOURCE_PURPOSE, transaction)) throw sourceConsentError();\n";
if (m === 'E1') editNth(EV, EVCHK, '', 1);
if (m === 'E2') editNth(EV, EVCHK, '', 2);
if (m === 'E3') edit(EP, "if (!await consent.hasConsent(userId, 'insights_chat')) {", "if (false) {");
if (m === 'E4') { editNth(EV, 'consent.isGrantedIn(userId, SOURCE_PURPOSE, transaction)', 'consent.hasConsent(userId, SOURCE_PURPOSE)', 1); editNth(EV, 'consent.isGrantedIn(userId, SOURCE_PURPOSE, transaction)', 'consent.hasConsent(userId, SOURCE_PURPOSE)', 1); }
console.log('M apl ' + m);

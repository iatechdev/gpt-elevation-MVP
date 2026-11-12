// [QA-Claude] Mutaciones del permiso de la fuente (PR #253) sobre careerContext.js y consent.js
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-221/backend/utils/'; const m = process.argv[2];
const edit = (file, a, b) => { const s = fs.readFileSync(B + file, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 60)); fs.writeFileSync(B + file, s.replace(a, () => b)); };
const CC = 'careerContext.js', CO = 'consent.js';
const PREV = "  for (const purpose of sourcePurposes(clean)) if (!await consent.hasConsent(userId, purpose)) throw sourceConsentError('source_consent_required');\n";
const CONF = "    for (const purpose of sourcePurposes(clean)) if (!await consent.isGrantedIn(userId, purpose, transaction)) throw sourceConsentError('source_consent_revoked');\n";
if (m === 'M1') edit(CC, PREV, '');
if (m === 'M2') edit(CC, CONF, '');
if (m === 'M3') edit(CC, 'await consent.isGrantedIn(userId, purpose, transaction)', 'await consent.hasConsent(userId, purpose)');
if (m === 'M4') { const s = fs.readFileSync(B + CO, 'utf8'); const i = s.indexOf('async function isGrantedIn'); const j = s.indexOf('}\n', i); const body = s.slice(i, j); if (!body.includes(', lock: Transaction.LOCK.SHARE')) throw new Error('M4 no encontrada'); fs.writeFileSync(B + CO, s.slice(0, i) + body.replace(', lock: Transaction.LOCK.SHARE', '') + s.slice(j)); }
if (m === 'M5') { const s = fs.readFileSync(B + CO, 'utf8'); const i = s.indexOf('async function isGrantedIn'); const j = s.indexOf('}\n', i); const body = s.slice(i, j); if (!body.includes('return isEffective(row, purpose);')) throw new Error('M5 no encontrada'); fs.writeFileSync(B + CO, s.slice(0, i) + body.replace('return isEffective(row, purpose);', 'return true;') + s.slice(j)); }
if (m === 'M6') edit(CC, "diary_entry: 'insights_diary', chat_turn: 'insights_chat', resume_version: 'insights_resume'", "diary_entry: 'insights_chat', chat_turn: 'insights_diary', resume_version: 'insights_resume'");
if (m === 'M7') edit(CC, ", resume_version: 'insights_resume' });\nconst sourcePurposes", " });\nconst sourcePurposes");
if (m === 'M8') edit(CC, CONF, CONF.replace('sourcePurposes(clean))', 'sourcePurposes(clean).slice(0, 1))'));
if (m === 'M9') { const o = "    const origins = await resolveOrigins(userId, clean, transaction);\n"; edit(CC, o + CONF, CONF + o); }
if (m === 'M10') edit(CC, "throw sourceConsentError('source_consent_revoked');\n    for (const previous", "throw sourceConsentError('consent_required');\n    for (const previous");
console.log('M apl ' + m);

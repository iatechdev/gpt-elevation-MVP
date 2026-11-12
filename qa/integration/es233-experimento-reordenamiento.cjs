// EXPERIMENTO de QA (no se sube): mover la comprobación del permiso de la fuente ANTES del bloqueo de las versiones, para igualar el orden de bloqueos de la retirada (consentimiento → versiones).
const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-221/backend/utils/careerContext.js';
let s = fs.readFileSync(F, 'utf8');
const check = "    for (const purpose of sourcePurposes(clean)) if (!await consent.isGrantedIn(userId, purpose, transaction)) throw sourceConsentError('source_consent_revoked');\n";
const lock = "    const rows = await CareerContextVersion.findAll({ where: { UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });\n";
if (s.split(check).length !== 2 || s.split(lock).length !== 2) throw new Error('no encontrado');
s = s.replace(check, '').replace(lock, check + lock);
fs.writeFileSync(F, s); console.log('experimento aplicado');

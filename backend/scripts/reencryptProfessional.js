// ES-86 · Migración de DATOS, reversible, del payload de CareerContextVersions entre las dos claves (comando de operador).
//   node scripts/reencryptProfessional.js --to=professional            simulacro (no escribe)
//   node scripts/reencryptProfessional.js --to=professional --apply    v2: (clave de datos) -> v2p: (clave profesional); también rota v2p con otro kid
//   node scripts/reencryptProfessional.js --to=data --apply            REVERSA: v2p: -> v2: (vuelve a la clave de datos)
// Necesita DATABASE_URL del entorno destino y las claves (DATA_ENCRYPTION_KEY y PROFESSIONAL_ENCRYPTION_KEY[_PREVIOUS]) en el entorno del proceso.
// Es un comando aparte y no una migración de esquema porque depende de secretos y de que el código nuevo (que lee ambos formatos) ya esté
// desplegado: si corriera antes del despliegue, el código viejo no entendería v2p:. Es idempotente y atómico (una transacción; todo o nada).
// Verifica cada fila (descifra lo cifrado y compara) antes de escribir. Solo imprime conteos: nunca texto, claves ni identificadores.
// Los jobs vivos del worker (ES-84, si existe AiJobs) que apuntan a una versión re-cifrada quedan INVALIDATED: su contextHash ya no coincide.
const professional = require('../utils/professionalCrypto');

const TARGETS = ['professional', 'data'];

async function reencrypt(sequelize, { to, apply = false, dataCrypto = require('../utils/crypto') } = {}) {
  if (!TARGETS.includes(to)) throw new Error('Se espera --to=professional o --to=data.');
  const { desencriptar, encriptarV2 } = dataCrypto;
  const encryptTarget = to === 'professional' ? (text) => professional.encrypt(text) : (text) => encriptarV2(text);
  if (to === 'professional' && !professional.configured()) {
    throw new professional.ProfessionalKeyError('professional_key_missing', 'Falta PROFESSIONAL_ENCRYPTION_KEY: no se puede cifrar con la clave profesional.');
  }

  return sequelize.transaction(async (transaction) => {
    const [rows] = await sequelize.query('SELECT "id", "UserId", "version", "payload" FROM "CareerContextVersions" ORDER BY "id" FOR UPDATE', { transaction });
    const summary = { to, apply, total: rows.length, alreadyTarget: 0, converted: 0, rotated: 0, jobsInvalidated: 0 };
    const changed = [];
    for (const row of rows) {
      const { payload } = row;
      const isProf = professional.isProfessional(payload);
      const isData = typeof payload === 'string' && payload.startsWith('v2:');
      if (!isProf && !isData) throw new Error('Formato de payload desconocido: se cancela todo sin escribir.'); // sin identificadores ni contenido
      if (to === 'professional' && isProf && professional.keyIdOf(payload) === professional.currentKeyId()) { summary.alreadyTarget += 1; continue; }
      if (to === 'data' && isData) { summary.alreadyTarget += 1; continue; }
      const plain = isProf ? professional.decrypt(payload) : desencriptar(payload); // falla si falta una clave: no se escribe nada
      const sealed = encryptTarget(plain);
      const check = to === 'professional' ? professional.decrypt(sealed) : desencriptar(sealed);
      if (check !== plain) throw new Error('La verificación de ida y vuelta falló: se cancela todo sin escribir.');
      if (isProf && to === 'professional') summary.rotated += 1; else summary.converted += 1;
      changed.push({ id: row.id, UserId: row.UserId, version: row.version, sealed });
    }
    if (!apply || changed.length === 0) return summary;
    for (const item of changed) {
      await sequelize.query('UPDATE "CareerContextVersions" SET "payload" = :sealed WHERE "id" = :id', { replacements: { sealed: item.sealed, id: item.id }, transaction });
    }
    const [[{ exists }]] = await sequelize.query(`SELECT to_regclass('"AiJobs"') IS NOT NULL AS exists`, { transaction });
    if (exists) {
      for (const item of changed) {
        const [, meta] = await sequelize.query(
          `UPDATE "AiJobs" SET "status" = 'INVALIDATED', "errorCode" = 'context_reencrypted', "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "finishedAt" = now(), "updatedAt" = now()
           WHERE "UserId" = :userId AND "contextVersion" = :version AND "status" IN ('PENDING', 'RUNNING')`,
          { replacements: { userId: item.UserId, version: item.version }, transaction });
        summary.jobsInvalidated += meta.rowCount || 0;
      }
    }
    return summary;
  });
}

module.exports = { reencrypt };

if (require.main === module) {
  const args = process.argv.slice(2);
  const to = (args.find((a) => a.startsWith('--to=')) || '').slice(5);
  const apply = args.includes('--apply');
  const { sequelize } = require('../database');
  reencrypt(sequelize, { to, apply })
    .then((summary) => { console.log(JSON.stringify(summary)); })
    .catch((error) => { console.error(`No se re-cifró nada: ${error.code || error.message}`); process.exitCode = 1; })
    .finally(() => sequelize.close());
}

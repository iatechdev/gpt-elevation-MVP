// backend/utils/applicationMinimize.js
// ES-293 (E249-1) · Decisión de Mauricio (12-nov-2026), opción C — MINIMIZAR: al purgar a una persona (ES-274), su SOLICITUD de profesional conserva SOLO estado y fechas;
// se borran nombre, correo, país, profesión, licencia, perfil, mensaje, quién la revisó, la nota de revisión y la hoja de vida (archivo cifrado de la tabla; este código no guarda
// hojas de vida de solicitudes en Supabase Storage). Nunca se afirma que la fila quede «anonimizada»: conserva `status`, `createdAt`, `reviewedAt`, `consentAt` y el enlace a la lápida.
// Se ejecuta DENTRO de la transacción de la purga (todo o nada) y es idempotente: una fila ya minimizada no se vuelve a tocar.
const { Op, Transaction, fn, col, where } = require('sequelize');
const ProfessionalApplication = require('../ProfessionalApplication');
const ProfessionalApplicationFile = require('../ProfessionalApplicationFile');

const PLACEHOLDER = 'Solicitud eliminada / Deleted application';

// Solicitudes de ESTA persona: las ligadas a su cuenta (`userId`) y las hechas con su correo ORIGINAL antes de crear la cuenta (se pasa el correo previo a la lápida).
async function minimizeForPerson(userId, originalEmail, transaction) {
  const byEmail = typeof originalEmail === 'string' && originalEmail.trim()
    ? [where(fn('lower', col('email')), originalEmail.trim().toLowerCase())] : [];
  const rows = await ProfessionalApplication.findAll({ where: { minimizedAt: null, [Op.or]: [{ userId }, ...byEmail] }, attributes: ['id', 'status'], transaction, lock: Transaction.LOCK.UPDATE });
  for (const row of rows) {
    await ProfessionalApplicationFile.destroy({ where: { ApplicationId: row.id }, transaction });
    const now = new Date();
    await ProfessionalApplication.update({
      name: PLACEHOLDER, email: `app-${row.id}@deleted.invalid`, country: '-', profession: '-',
      licenseNumber: null, profileUrl: null, message: null, reviewedBy: null, reviewNote: null,
      // Una solicitud pendiente sin datos no es accionable: se cierra (libera el cupo de pendientes y el correo). Aprobadas y rechazadas conservan su estado.
      ...(row.status === 'pending' ? { status: 'rejected', reviewedAt: now } : {}),
      userId, minimizedAt: now,
    }, { where: { id: row.id }, transaction });
  }
  return rows.length;
}

const hasMinimized = async (userId, transaction) => Boolean(await ProfessionalApplication.findOne({ where: { userId, minimizedAt: { [Op.ne]: null } }, attributes: ['id'], transaction }));

module.exports = { minimizeForPerson, hasMinimized, PLACEHOLDER };

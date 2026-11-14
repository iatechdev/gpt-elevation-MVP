// ES-306 · Un solo criterio para el correo de una cuenta: sin espacios a los lados y en minúsculas.
// Motivo: «Ana@x.co» y «ana@x.co» son la misma persona; antes el registro comparaba el texto exacto y creaba una cuenta duplicada.
const { fn, col, where: sqlWhere } = require('sequelize');

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

// Busca la cuenta de un correo SIN importar mayúsculas. Orden: 1) el texto exacto que llegó, sin espacios a los lados (camino rápido, por el único
// exacto; además conserva el acceso de cuentas antiguas duplicadas por casing) y 2) lower(email) = correo normalizado (cubre lo que se guarda desde
// ES-306 y las cuentas antiguas guardadas con mayúsculas; si hubiera varias, la más antigua). Solo lee: nunca crea, fusiona ni modifica cuentas.
async function findUserByEmail(User, rawEmail, options = {}) {
  const normalized = normalizeEmail(rawEmail);
  if (typeof normalized !== 'string' || !normalized) return null;
  const found = await User.findOne({ ...options, where: { email: rawEmail.trim() } });
  if (found) return found;
  return User.findOne({ ...options, where: sqlWhere(fn('lower', col('email')), normalized), order: [['id', 'ASC']] });
}

module.exports = { normalizeEmail, findUserByEmail };

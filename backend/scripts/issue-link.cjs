// ES-376 · Emite un enlace de restablecimiento de contraseña de UN SOLO USO y lo imprime en la terminal de quien opera (sin correo).
// Para cuando aún no hay proveedor de correo (ES-371). Nada de esto es una ruta ni una pantalla de la aplicación.
//
// Uso (en backend/, con las variables del entorno cargadas por el operador; ninguna se imprime):
//   ALLOW_OPERATOR_LINK=true node scripts/issue-link.cjs --email persona@dominio.co
//   (en Railway:  railway run -s <servicio> -- node scripts/issue-link.cjs --email …, con ALLOW_OPERATOR_LINK=true)
// Variables: DATABASE_URL (y DB_SSL…), APP_BASE_URL o FRONTEND_URL (https), ALLOW_OPERATOR_LINK=true, OPERATOR_LINK_TTL_MINUTES (opcional, 5–60, por defecto 15).
//
// Protecciones:
//  - exige ALLOW_OPERATOR_LINK=true (no se define por defecto en ningún entorno) y una base https (o localhost);
//  - se niega si la salida NO es una terminal (redirigida a un archivo, a un log o a CI), salvo --stdout-ok, para que el enlace no acabe escrito donde no debe;
//  - solo cuentas existentes y activas con rol persona o profesional; administración y superadmin se rechazan (y se audita el intento);
//  - el token no se guarda (solo su hash), el enlace sirve una vez y vence pronto; el último enlace invalida el anterior;
//  - la auditoría (quién = operador, a quién = id, cuándo) se escribe sin token ni correo.
// NUNCA pegues el enlace impreso en un PR, en Jira, en un chat ni en un log: se lo das a la persona por un canal privado.
process.env.DOTENV_CONFIG_QUIET = 'true'; // dotenv 17 escribe un aviso en stdout: aquí stdout lleva SOLO el enlace
const { sequelize } = require('../database');
const { issueOperatorLink, OperatorLinkError } = require('../utils/operatorLink');

const MESSAGES = {
  config: 'Se niega: define APP_BASE_URL (o FRONTEND_URL) con una dirección https.',
  not_found: 'No se emitió ningún enlace: la cuenta no existe.',
  role_not_allowed: 'No se emitió ningún enlace: solo se permite para personas y profesionales (el intento quedó auditado).',
  inactive: 'No se emitió ningún enlace: la cuenta no está activa.',
  deletion_pending: 'No se emitió ningún enlace: la cuenta tiene una baja pendiente.',
  rate_limited: 'No se emitió ningún enlace: ya se emitieron 3 en la última hora para esa cuenta. Espera un rato.',
  failed: 'No se pudo emitir el enlace. No se imprimió nada.',
};

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (process.env.ALLOW_OPERATOR_LINK !== 'true') { console.error('Se niega: define ALLOW_OPERATOR_LINK=true en el entorno de quien opera.'); process.exitCode = 1; return; }
  if (!process.stdout.isTTY && !process.argv.includes('--stdout-ok')) { console.error('Se niega: la salida no es una terminal; el enlace no debe escribirse en un archivo ni en un log.'); process.exitCode = 1; return; }
  const email = argValue('--email');
  if (!email) { console.error('Uso: node scripts/issue-link.cjs --email persona@dominio.co'); process.exitCode = 1; return; }
  await sequelize.authenticate();
  const { link, expiresAt, minutes } = await issueOperatorLink({ email });
  console.log(link);
  console.error(`Enlace de un solo uso. Vence en ${minutes} minutos (${expiresAt.toISOString()}). Entrégalo por un canal privado; no lo pegues en PR, Jira, chat ni logs.`);
}

main().catch((error) => {
  console.error(error instanceof OperatorLinkError ? (MESSAGES[error.code] || MESSAGES.failed) : MESSAGES.failed);
  process.exitCode = 1;
}).finally(() => sequelize.close());

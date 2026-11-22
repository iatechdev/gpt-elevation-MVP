// backend/utils/mailSmtp.js
// ES-371: proveedor de correo `smtp` (MAIL_PROVIDER=smtp) sobre nodemailer, para el correo de staging con un buzón del equipo.
// Variables: MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS (+ SMTP_TIMEOUT_MS opcional). Los secretos viven solo en Railway.
// Reglas: TLS obligatorio salvo en la propia máquina; certificado verificado; tiempos acotados; un envío = un intento (sin reintentos);
// los errores que salen de aquí NO llevan destinatario, enlace, servidor ni credenciales (solo un código fijo).
const { isValidEmail } = require('./emailGuard');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;
const MIN_TIMEOUT_MS = 500;
const POOL_SIZE = 2;
const CRLF = new RegExp('[' + String.fromCharCode(13, 10, 0x2028, 0x2029) + ']'); // CR, LF, LS, PS

class SmtpMailError extends Error {
  // `code` es de una lista cerrada: nunca se copia texto del servidor, del cliente ni de nodemailer.
  constructor(code) {
    super(`No se pudo enviar el correo (${code}).`);
    this.name = 'SmtpMailError';
    this.code = code;
  }
}

const isLocalHost = host => LOCAL_HOSTS.has(String(host || '').trim().toLowerCase());
const asBool = value => /^(1|true|yes|si|sí)$/i.test(String(value || '').trim());

function timeoutMs(env) {
  const raw = Number(env.SMTP_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(raw)));
}

// Opciones del transporte a partir del entorno. Lanza SmtpMailError('config') si falta lo imprescindible.
function smtpOptions(env = process.env) {
  const host = String(env.SMTP_HOST || '').trim();
  if (!host || CRLF.test(host)) throw new SmtpMailError('config');
  const secure = asBool(env.SMTP_SECURE);
  const local = isLocalHost(host);
  const rawPort = Number(env.SMTP_PORT);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : (secure ? 465 : 587);
  const user = String(env.SMTP_USER || '');
  const pass = String(env.SMTP_PASS || '');
  if ((user && !pass) || (!user && pass)) throw new SmtpMailError('config');
  const timeout = timeoutMs(env);
  return {
    host,
    port,
    secure, // true = TLS desde el primer byte (puerto 465)
    requireTLS: !secure && !local, // false + host remoto = STARTTLS obligatorio: si el servidor no lo ofrece, no se envía
    ignoreTLS: false,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: !local }, // certificado verificado salvo en la propia máquina (pruebas y desarrollo)
    ...(user ? { auth: { user, pass } } : {}),
    pool: true,
    maxConnections: POOL_SIZE,
    maxMessages: 50,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    dnsTimeout: timeout,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}

let cached = null; // { key, transport }

function closeSmtp() {
  if (cached) { try { cached.transport.close(); } catch { /* ya cerrado */ } }
  cached = null;
}

function getTransport(env) {
  const options = smtpOptions(env);
  const key = JSON.stringify(options);
  if (cached && cached.key === key) return cached.transport;
  closeSmtp();
  const nodemailer = require('nodemailer'); // se carga solo cuando se usa SMTP
  cached = { key, transport: nodemailer.createTransport(options) };
  return cached.transport;
}

// Remitente: «correo» o «Nombre <correo>». Sin saltos de línea y con una dirección válida.
function checkFrom(from) {
  const value = String(from || '').trim();
  if (!value || CRLF.test(value)) return false;
  const match = value.match(/<([^<>]+)>\s*$/);
  return isValidEmail(match ? match[1].trim() : value);
}

function failureCode(error) {
  const code = String((error && error.code) || '');
  if (code === 'EAUTH') return 'auth';
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code === 'ECONNECTIONTIMEOUT') return 'timeout';
  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'EDNS') return 'connection';
  if (code === 'ETLS' || /^ERR_TLS|^ERR_SSL|^CERT_|^UNABLE_TO|^DEPTH_ZERO|^SELF_SIGNED/.test(code)) return 'tls';
  if (code === 'EENVELOPE') return 'rejected';
  return 'send';
}

// Contrato de `providers`: recibe { to, from, subject, text } y resuelve si el servidor aceptó el mensaje; si no, lanza SmtpMailError.
async function sendSmtp({ to, from, subject, text }, env = process.env) {
  if (!isValidEmail(to)) throw new SmtpMailError('recipient');
  if (!checkFrom(from)) throw new SmtpMailError('config');
  if (typeof subject !== 'string' || !subject || CRLF.test(subject) || typeof text !== 'string') throw new SmtpMailError('message');
  const transport = getTransport(env);
  let info;
  try {
    info = await transport.sendMail({ from, to, subject, text, envelope: { from: String(from).match(/<([^<>]+)>\s*$/)?.[1].trim() || String(from).trim(), to: [to] } });
  } catch (error) {
    throw new SmtpMailError(failureCode(error));
  }
  const accepted = Array.isArray(info && info.accepted) ? info.accepted.length : 0;
  const rejected = Array.isArray(info && info.rejected) ? info.rejected.length : 0;
  if (accepted !== 1 || rejected !== 0) throw new SmtpMailError('rejected');
}

module.exports = { sendSmtp, smtpOptions, closeSmtp, isLocalHost, SmtpMailError, checkFrom };

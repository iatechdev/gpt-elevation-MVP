// backend/utils/professionalCrypto.js
// Cifrado del DOMINIO PROFESIONAL (ES-86, ADR-002/003): el contexto profesional que la persona aprobó (CareerContextVersions.payload) se cifra
// con una clave PROPIA, distinta de DATA_ENCRYPTION_KEY (chats y diario). Así el worker de análisis (ES-84) puede leer ese contexto sin poder
// descifrar nada privado, y un compromiso del worker no abre el espacio de la persona.
//
// Formato:  v2p:<kid>:<iv 24 hex>:<etiqueta 32 hex>:<contenido hex>   (AES-256-GCM; la clave sale de HKDF con un contexto propio).
// `kid` identifica la clave y se autentica como AAD: cambiar el `kid` de un dato cifrado hace fallar el descifrado.
//
// Este módulo NO importa utils/crypto.js ni lee DATA_ENCRYPTION_KEY como clave: el proceso del worker lo usa solo.
// Sin clave configurada NO hay clave por defecto: falla (ProfessionalKeyError). Los mensajes de error nunca incluyen material de clave.
//
// Variables (los valores los carga Mauricio; ver docs/elevation-skillmap/44-ES-86-CLAVE-PROFESIONAL.md):
//   PROFESSIONAL_ENCRYPTION_KEY           clave vigente (mínimo 32 caracteres; se recomienda 64 hex = 32 bytes aleatorios)
//   PROFESSIONAL_KEY_ID                   identificador de la vigente (a-z0-9, 1–8; por defecto «p1»)
//   PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS  clave anterior, solo para DESCIFRAR durante una rotación
//   PROFESSIONAL_KEY_ID_PREVIOUS          identificador de la anterior (obligatorio si se define la clave anterior)

const crypto = require('crypto');

const PREFIX = 'v2p:';
const MIN_KEY_LENGTH = 32;
const KID_PATTERN = /^[a-z0-9]{1,8}$/;
const HKDF_SALT = 'elevation-professional-domain';
const HKDF_INFO = 'elevation-professional-v2';

class ProfessionalKeyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // professional_key_missing | professional_key_invalid | unknown_key_id
  }
}

class ProfessionalDecryptionError extends Error {
  constructor() {
    super('No se pudo descifrar el dato profesional (clave incorrecta o dato alterado).');
    this.code = 'decryption_failed';
  }
}

const deriveKey = (secret) => Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, HKDF_INFO, 32));

let cache = null;
// Lee el entorno en cada llamada (barato) y rehace el conjunto de claves solo si cambió. Nunca guarda ni registra el secreto en texto.
function keyring() {
  const env = process.env;
  const signature = [env.PROFESSIONAL_ENCRYPTION_KEY, env.PROFESSIONAL_KEY_ID, env.PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS, env.PROFESSIONAL_KEY_ID_PREVIOUS, env.DATA_ENCRYPTION_KEY].join('\u0000');
  if (cache && cache.signature === signature) return cache.value;
  const value = build(env);
  cache = { signature, value };
  return value;
}

function build(env) {
  const current = env.PROFESSIONAL_ENCRYPTION_KEY;
  if (!current) {
    return { configured: false, currentId: null, keys: new Map() };
  }
  const entries = [[env.PROFESSIONAL_KEY_ID || 'p1', current, 'PROFESSIONAL_ENCRYPTION_KEY']];
  if (env.PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS) {
    entries.push([env.PROFESSIONAL_KEY_ID_PREVIOUS || '', env.PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS, 'PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS']);
  }
  const keys = new Map();
  for (const [kid, secret, name] of entries) {
    if (!KID_PATTERN.test(kid)) throw new ProfessionalKeyError('professional_key_invalid', `El identificador de ${name} no es válido (a-z0-9, 1 a 8 caracteres).`);
    if (secret.length < MIN_KEY_LENGTH) throw new ProfessionalKeyError('professional_key_invalid', `${name} debe tener al menos ${MIN_KEY_LENGTH} caracteres.`);
    // La razón de ser de la clave propia: no puede ser la de los datos privados.
    if (env.DATA_ENCRYPTION_KEY && secret === env.DATA_ENCRYPTION_KEY) throw new ProfessionalKeyError('professional_key_invalid', `${name} no puede ser igual a DATA_ENCRYPTION_KEY.`);
    if (keys.has(kid)) throw new ProfessionalKeyError('professional_key_invalid', 'Los identificadores de clave profesional deben ser distintos.');
    keys.set(kid, deriveKey(secret));
  }
  return { configured: true, currentId: entries[0][0], keys };
}

const configured = () => keyring().configured;

function currentKey() {
  const ring = keyring();
  if (!ring.configured) throw new ProfessionalKeyError('professional_key_missing', 'Falta PROFESSIONAL_ENCRYPTION_KEY (clave de cifrado del dominio profesional).');
  return { kid: ring.currentId, key: ring.keys.get(ring.currentId) };
}

const isProfessional = (text) => typeof text === 'string' && text.startsWith(PREFIX);
const keyIdOf = (text) => (isProfessional(text) ? text.slice(PREFIX.length).split(':')[0] : null);
const currentKeyId = () => keyring().currentId;

function encrypt(text) {
  const { kid, key } = currentKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(kid, 'utf8'));
  const sealed = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `${PREFIX}${kid}:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${sealed.toString('hex')}`;
}

function decrypt(text) {
  if (!isProfessional(text)) throw new ProfessionalDecryptionError();
  const ring = keyring();
  if (!ring.configured) throw new ProfessionalKeyError('professional_key_missing', 'Falta PROFESSIONAL_ENCRYPTION_KEY (clave de cifrado del dominio profesional).');
  const [kid, iv, tag, body, ...rest] = text.slice(PREFIX.length).split(':');
  if (rest.length || !iv || !tag || body === undefined) throw new ProfessionalDecryptionError();
  const key = ring.keys.get(kid);
  if (!key) throw new ProfessionalKeyError('unknown_key_id', 'El dato profesional está cifrado con una clave que este proceso no tiene.');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAAD(Buffer.from(kid, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    throw new ProfessionalDecryptionError();
  }
}

module.exports = {
  PREFIX, ProfessionalKeyError, ProfessionalDecryptionError,
  configured, currentKeyId, isProfessional, keyIdOf, encrypt, decrypt,
};

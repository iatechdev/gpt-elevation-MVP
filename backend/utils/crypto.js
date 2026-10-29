// backend/utils/crypto.js
// Fuente única de verdad para el cifrado de datos.
//  - Formato heredado (encriptar): AES-256-CBC, "iv:contenido". Sin autenticación; se conserva para los datos existentes.
//  - Formato v2 (encriptarV2): AES-256-GCM autenticado, "v2:iv:etiqueta:contenido", clave derivada con HKDF. ES-20.
// desencriptar lee ambos. Un dato v2 alterado o con otra clave FALLA (DecryptionError) en lugar de devolver el texto cifrado.

const crypto = require('crypto');

const ALGORITMO = 'aes-256-cbc';
// Clave propia (DATA_ENCRYPTION_KEY); DB_PASS queda solo por compatibilidad con datos ya cifrados.
// En producción no hay clave por defecto: sin variable, el proceso no arranca.
const keySource = process.env.DATA_ENCRYPTION_KEY || process.env.DB_PASS;
if (!keySource && process.env.NODE_ENV === 'production') {
  throw new Error('Falta DATA_ENCRYPTION_KEY (clave de cifrado de datos).');
}
const KEY = Buffer.from(
  (keySource || 'default_password_2026').padEnd(32).slice(0, 32)
);
const KEY_V2 = Buffer.from(crypto.hkdfSync(
  'sha256', Buffer.from(keySource || 'default_password_2026'), 'elevation-data-v2', 'aes-256-gcm', 32,
));
const PREFIJO_V2 = 'v2:';

class DecryptionError extends Error {
  constructor() {
    super('No se pudo descifrar el dato (clave incorrecta o dato alterado).');
    this.code = 'decryption_failed';
  }
}

const encriptar = (texto) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, iv);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const encriptarV2 = (texto) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_V2, iv);
  const encrypted = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return PREFIJO_V2 + iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + encrypted.toString('hex');
};

const descifrarV2 = (texto) => {
  try {
    const [iv, tag, contenido] = texto.slice(PREFIJO_V2.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_V2, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(contenido, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
};

const desencriptar = (texto) => {
  // ES-86: el contexto profesional va cifrado con su propia clave (v2p:). Falla (no devuelve texto cifrado) si no hay clave o el dato se alteró.
  if (typeof texto === 'string' && texto.startsWith('v2p:')) return require('./professionalCrypto').decrypt(texto);
  if (typeof texto === 'string' && texto.startsWith(PREFIJO_V2)) return descifrarV2(texto);
  try {
    const partes = texto.split(':');
    const iv = Buffer.from(partes.shift(), 'hex');
    const contenidoEncrypted = partes.join(':');
    const decipher = crypto.createDecipheriv(ALGORITMO, KEY, iv);
    let decrypted = decipher.update(contenidoEncrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('⚠️ Error desencriptando:', error.message);
    return texto;
  }
};

module.exports = { encriptar, encriptarV2, desencriptar, DecryptionError };

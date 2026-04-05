// backend/utils/crypto.js
// Fuente única de verdad para encriptación AES-256-CBC
// Todos los routers que necesiten encriptar/desencriptar importan desde aquí

const crypto = require('crypto');

const ALGORITMO = 'aes-256-cbc';
const KEY = Buffer.from(
  (process.env.DB_PASS || 'default_password_2026').padEnd(32).slice(0, 32)
);

const encriptar = (texto) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, iv);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const desencriptar = (texto) => {
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

module.exports = { encriptar, desencriptar };
// backend/utils/storage.js
// ES-268 · Almacenamiento de documentos en Supabase Storage (bucket PRIVADO, subida desde el servidor con la clave de servicio).
// Reemplaza a Google Cloud Storage (la nube anterior venció) SIN cambiar el contrato para quien llama:
//   uploadFile(buffer, destination, mimeType) → destination      getSignedUrl(path) → URL firmada de corta vida      deleteFile(path)
// Variables (solo en Railway; nunca en Git, logs ni chat): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET.
// La clave de servicio es solo del servidor: nunca va al cliente ni a un mensaje de error.
// Los errores que salen de aquí son GENÉRICOS (`code` + estado HTTP): los de Supabase pueden traer la URL del proyecto o rutas de objetos.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, igual que ES-99 en la ruta (defensa en profundidad)
const DEFAULT_TTL_SECONDS = 900;    // 15 minutos (antes 1 hora)
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;

class StorageError extends Error {
  constructor(code, status) {
    super('Storage operation failed.'); // mensaje fijo: nada de rutas, claves ni URLs
    this.name = 'StorageError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

let factory = null; // sustituible en pruebas
let client = null;
let clientKey = null;

function config() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !key || !bucket) throw new StorageError('storage_unavailable'); // sin valor por defecto de bucket: nunca se «adivina» el de producción
  return { url, key, bucket };
}

// Cliente perezoso: el servidor arranca aunque falten las variables; fallará solo quien intente usar el almacenamiento.
function bucketApi() {
  const { url, key, bucket } = config();
  const id = `${url}|${bucket}`;
  if (!client || clientKey !== id) {
    const create = factory || require('@supabase/supabase-js').createClient;
    client = create(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    clientKey = id;
  }
  return client.storage.from(bucket);
}

const statusOf = (error) => { const n = Number(error && (error.statusCode ?? error.status)); return Number.isInteger(n) ? n : undefined; };
const fail = (error) => new StorageError('storage_failed', statusOf(error));

function ttlSeconds() {
  const raw = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(raw)));
}

const checkPath = (value) => {
  if (typeof value !== 'string' || !value || value.length > 512 || value.startsWith('/') || value.split('/').includes('..') || /[\u0000-\u001f]/.test(value)) throw new StorageError('invalid_path');
  return value;
};

/** Sube un archivo (nunca sobrescribe) y devuelve la ruta del objeto. */
const uploadFile = async (buffer, destination, mimeType) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_BYTES) throw new StorageError('invalid_upload');
  checkPath(destination);
  let result;
  try { result = await bucketApi().upload(destination, buffer, { contentType: mimeType, upsert: false }); } catch (error) { if (error instanceof StorageError) throw error; throw fail(error); }
  if (result && result.error) throw fail(result.error);
  return destination;
};

/** URL firmada de lectura de corta vida (900 s por defecto; STORAGE_SIGNED_URL_TTL_SECONDS la acota entre 60 y 3600). */
const getSignedUrl = async (filePath) => {
  checkPath(filePath);
  let result;
  try { result = await bucketApi().createSignedUrl(filePath, ttlSeconds()); } catch (error) { if (error instanceof StorageError) throw error; throw fail(error); }
  if (!result || result.error || !result.data || !result.data.signedUrl) throw fail(result && result.error);
  return result.data.signedUrl;
};

/** Borra un objeto. Idempotente: si no existe, no falla. */
const deleteFile = async (filePath) => {
  checkPath(filePath);
  let result;
  try { result = await bucketApi().remove([filePath]); } catch (error) { if (error instanceof StorageError) throw error; throw fail(error); }
  if (result && result.error) throw fail(result.error);
};

/**
 * Borra todos los objetos directamente bajo `prefix` (p. ej. `therapist-docs/12`), por lotes. Devuelve cuántos borró.
 * Listo para el procedimiento de eliminación de profesionales; NO está conectado a ningún borrado de cuentas (decisión de Infra/Mauricio).
 */
const deleteByPrefix = async (prefix) => {
  checkPath(prefix);
  const api = bucketApi();
  let removed = 0;
  for (let guard = 0; guard < 1000; guard++) { // la lista se vuelve a pedir desde el principio: lo borrado ya no aparece
    let listed;
    try { listed = await api.list(prefix, { limit: 100, offset: 0 }); } catch (error) { throw fail(error); }
    if (listed && listed.error) throw fail(listed.error);
    const names = ((listed && listed.data) || []).map((o) => o && o.name).filter((n) => typeof n === 'string' && n && !n.includes('/'));
    if (!names.length) break;
    let result;
    try { result = await api.remove(names.map((n) => `${prefix}/${n}`)); } catch (error) { throw fail(error); }
    if (result && result.error) throw fail(result.error);
    removed += names.length;
  }
  return removed;
};

// Solo para pruebas: sustituye el cliente de Supabase por un doble y reinicia el cliente en caché.
const _setClientFactoryForTests = (create) => { factory = create; client = null; clientKey = null; };

module.exports = { uploadFile, getSignedUrl, deleteFile, deleteByPrefix, signedUrlTtlSeconds: ttlSeconds, StorageError, MAX_BYTES, DEFAULT_TTL_SECONDS, _setClientFactoryForTests };

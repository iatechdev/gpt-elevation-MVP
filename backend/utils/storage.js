// backend/utils/storage.js
// Singleton cliente Google Cloud Storage
// Fuente única de verdad para acceso a GCS en toda la app

const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', process.env.GCS_KEY_FILE ?? './gcs-credentials.json'),
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME ?? 'elevation-therapist-docs');

/**
 * Genera una signed URL temporal para lectura (expira en 1 hora)
 * @param {string} filePath — ruta del archivo dentro del bucket
 * @returns {Promise<string>} URL firmada
 */
const getSignedUrl = async (filePath) => {
  const [url] = await bucket.file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hora
  });
  return url;
};

/**
 * Sube un archivo al bucket
 * @param {Buffer} buffer — contenido del archivo
 * @param {string} destination — ruta destino en el bucket
 * @param {string} mimeType — tipo MIME del archivo
 * @returns {Promise<string>} ruta del archivo en el bucket
 */
const uploadFile = async (buffer, destination, mimeType) => {
  const file = bucket.file(destination);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });
  return destination;
};

/**
 * Elimina un archivo del bucket
 * @param {string} filePath — ruta del archivo en el bucket
 */
const deleteFile = async (filePath) => {
  await bucket.file(filePath).delete({ ignoreNotFound: true });
};

module.exports = { storage, bucket, getSignedUrl, uploadFile, deleteFile };
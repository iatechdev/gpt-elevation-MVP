// [QA-Claude] Doble del almacenamiento de documentos (sin GCS real) para probar la subida en un servidor REAL del merge.
// Se carga con NODE_OPTIONS="--require <este archivo>". Variables: QA_SUT (clon), QA_STORAGE_LOG (registro de subidas, una línea JSON por subida),
// QA_STORAGE_FAIL (si ese archivo existe, subir y firmar fallan con un error cuyo mensaje incluye una ruta de credenciales, para ver si se filtra).
const fs = require('node:fs'); const path = require('node:path');
const target = path.join(process.env.QA_SUT, 'backend', 'utils', 'storage.js');
const failing = () => process.env.QA_STORAGE_FAIL && fs.existsSync(process.env.QA_STORAGE_FAIL);
const boom = () => Object.assign(new Error('ENOENT: no such file or directory, open C:\\secretos\\gcs-credentials.json (bucket elevation-therapist-docs)'), { code: 'ENOENT' });
require.cache[target] = { id: target, filename: target, loaded: true, exports: {
  uploadFile: async (buffer, destination, mimeType) => { if (failing()) throw boom(); fs.appendFileSync(process.env.QA_STORAGE_LOG, JSON.stringify({ bytes: buffer.length, destination, mimeType }) + '\n'); return destination; },
  getSignedUrl: async (filePath) => { if (failing()) throw boom(); return 'https://storage.example.invalid/' + encodeURIComponent(filePath); },
} };

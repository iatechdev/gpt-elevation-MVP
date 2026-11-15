// ES-268 · Prueba de humo del almacenamiento contra el bucket REAL de un entorno (staging o PR). NO forma parte de CI y NO se ejecuta en producción.
// Lee SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_STORAGE_BUCKET del entorno EN EJECUCIÓN (nunca las imprime). Usa SOLO datos sintéticos bajo un prefijo propio
// (`smoke-es268/<aleatorio>/`) que borra al terminar. Uso (en backend/):   node scripts/smoke-storage.cjs
// Comprueba: subida, que NO sobrescribe, URL firmada que se lee y trae el mismo contenido, que el bucket NO es público (la ruta sin firma no se lee), expiración de la URL
// (con STORAGE_SIGNED_URL_TTL_SECONDS=60 se espera 65 s: ejecutar con SMOKE_WAIT_EXPIRY=true), borrado idempotente y borrado por prefijo.
const crypto = require('crypto');
const storage = require('../utils/storage');

const ok = (m) => console.log('OK   ', m);
const bad = (m) => { console.error('FALLA', m); process.exitCode = 1; };
const check = (cond, m) => (cond ? ok(m) : bad(m));

(async () => {
  if (process.env.NODE_ENV === 'production') { console.error('No se ejecuta con NODE_ENV=production.'); process.exit(2); }
  for (const v of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) if (!process.env[v]) { console.error(`Falta la variable ${v} (solo su nombre; nunca se imprime su valor).`); process.exit(2); }
  const prefix = `smoke-es268/${crypto.randomBytes(8).toString('hex')}`;
  const key = `${prefix}/${Date.now()}_${crypto.randomBytes(16).toString('hex')}.pdf`;
  const body = Buffer.from('%PDF-1.4 sintetico ES-268 ' + crypto.randomBytes(8).toString('hex'));
  try {
    check((await storage.uploadFile(body, key, 'application/pdf')) === key, 'subida devuelve la ruta');
    await storage.uploadFile(body, key, 'application/pdf').then(() => bad('NO debe sobrescribir un objeto existente'), (e) => check(e.code === 'storage_failed', 'segunda subida a la misma ruta falla (upsert:false)'));
    const url = await storage.getSignedUrl(key);
    const res = await fetch(url);
    check(res.ok && Buffer.from(await res.arrayBuffer()).equals(body), 'la URL firmada se lee y trae el mismo contenido');
    const unsigned = await fetch(url.split('?')[0].replace('/object/sign/', '/object/public/'));
    check(!unsigned.ok, 'el bucket NO es público: la ruta pública sin firma no se lee');
    if (process.env.SMOKE_WAIT_EXPIRY === 'true') {
      const ttl = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS) || 900;
      console.log(`Esperando ${ttl + 5} s para comprobar la expiración…`);
      await new Promise((r) => setTimeout(r, (ttl + 5) * 1000));
      check(!(await fetch(url)).ok, 'la URL firmada expira');
    }
    await storage.deleteFile(key); await storage.deleteFile(key);
    check(!(await fetch(await storage.getSignedUrl(key).catch(() => 'http://invalid.invalid/'))).ok, 'borrado: el objeto ya no se lee (y borrar dos veces no falla)');
    await storage.uploadFile(body, `${prefix}/a.pdf`, 'application/pdf'); await storage.uploadFile(body, `${prefix}/b.pdf`, 'application/pdf');
    check((await storage.deleteByPrefix(prefix)) === 2, 'borrado por prefijo elimina los 2 objetos');
  } catch (error) {
    bad(`excepción controlada: code=${error && error.code} status=${error && error.status}`);
  } finally {
    await storage.deleteByPrefix(prefix).catch(() => {});
  }
  console.log(process.exitCode ? 'RESULTADO: HAY FALLAS' : 'RESULTADO: TODO BIEN');
})();

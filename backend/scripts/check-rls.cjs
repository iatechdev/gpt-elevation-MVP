// ES-117 · Falla si alguna tabla de `public` queda sin RLS, o si anon/authenticated conservan privilegios sobre tablas, secuencias o funciones.
// Uso: DATABASE_URL=... node scripts/check-rls.cjs   (solo lectura; no imprime datos, solo nombres de objetos)
const { Client } = require('pg');

const API_ROLES = ['anon', 'authenticated'];

async function findExposure(client) {
  const withoutRls = (await client.query(`SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity ORDER BY 1`)).rows.map((r) => r.name);
  const roles = (await client.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1)', [API_ROLES])).rows.map((r) => r.rolname);
  const granted = [];
  for (const role of roles) {
    const tables = await client.query(`SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S') AND (
        (c.relkind = 'S' AND has_sequence_privilege($1, c.oid, 'USAGE,SELECT,UPDATE')) OR
        (c.relkind <> 'S' AND has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))`, [role]);
    for (const row of tables.rows) granted.push(`${role}: ${row.name}`);
    const functions = await client.query(`SELECT p.oid::regprocedure::text AS name FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') AND has_function_privilege($1, p.oid, 'EXECUTE')`, [role]);
    for (const row of functions.rows) granted.push(`${role}: ${row.name}`);
  }
  return { withoutRls, granted };
}

module.exports = { findExposure };

if (require.main === module) {
  (async () => {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'false' ? false : undefined });
    await client.connect();
    try {
      const { withoutRls, granted } = await findExposure(client);
      if (withoutRls.length) console.error(`Tablas sin RLS (${withoutRls.length}): ${withoutRls.join(', ')}`);
      if (granted.length) console.error(`Privilegios de la API pública (${granted.length}): ${granted.join('; ')}`);
      if (withoutRls.length || granted.length) process.exit(1);
      console.log('RLS ok: todas las tablas de public con RLS y sin privilegios para anon/authenticated.');
    } finally { await client.end(); }
  })().catch((error) => { console.error(error.message); process.exit(1); });
}

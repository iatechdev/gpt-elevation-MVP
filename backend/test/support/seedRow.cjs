// Siembra una fila en CUALQUIER tabla rellenando las columnas obligatorias sin valor por defecto: las pruebas no dependen del esquema de cada recurso.
const crypto = require('node:crypto');

function makeSeeder(q) {
  let seq = 0;
  const enumFirst = async (udt) => (await q('SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY e.enumsortorder LIMIT 1', [udt]))[0].enumlabel;
  async function seed(table, overrides = {}) {
    const cols = await q(`SELECT column_name, data_type, udt_name, character_maximum_length AS maxlen FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
      AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`, [table]);
    const given = { ...overrides };
    for (const c of cols) {
      if (c.column_name in given) continue;
      seq += 1; const type = c.data_type;
      if (type.includes('char') || type === 'text') given[c.column_name] = `sintetico-${c.column_name}-${seq}`.slice(-(c.maxlen || 200));
      else if (type === 'integer' || type === 'smallint' || type === 'bigint') given[c.column_name] = 1;
      else if (type === 'boolean') given[c.column_name] = true;
      else if (type.startsWith('timestamp')) given[c.column_name] = new Date(Date.now() + 86400000);
      else if (type === 'date') given[c.column_name] = '2026-10-01';
      else if (type === 'json' || type === 'jsonb') given[c.column_name] = '[]';
      else if (type === 'bytea') given[c.column_name] = Buffer.from('sintetico');
      else if (type === 'uuid') given[c.column_name] = crypto.randomUUID();
      else if (type === 'USER-DEFINED') given[c.column_name] = await enumFirst(c.udt_name);
      else throw new Error(`seed ${table}.${c.column_name}: tipo ${type} sin valor sintético`);
    }
    const names = Object.keys(given);
    const rows = await q(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(',')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, names.map((n) => given[n]));
    return rows[0];
  }
  return seed;
}

module.exports = { makeSeeder };

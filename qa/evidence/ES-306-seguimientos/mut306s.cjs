// [QA-Claude] Mutaciones PROPIAS de la migración ES-306 seguimientos (PR #283 cabeza 7f800e55). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const p = 'C:/Users/Usuario/Documents/qa-pr-253/backend/migrations/20261115010000-es306-email-index-repair.cjs'; const m = process.argv[2];
const edit = (a, b) => { const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 70)); fs.writeFileSync(p, s.replace(a, () => b)); };
const DROP = 'await sequelize.query(`DROP INDEX "${INDEX}"`, { transaction });';
const M = {
  Z1: () => edit('if (groups.length) {', 'if (!groups.length) {'), // condición invertida
  Z2: () => edit(DROP, 'await sequelize.query(`DROP INDEX "${INDEX}"`);'), // el DROP fuera de la transacción
  Z3: () => edit(DROP, 'await sequelize.query(`DROP INDEX IF EXISTS "otro_indice"`, { transaction });'), // borra otro índice
  Z4: () => edit('CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))', 'CREATE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))'), // sin UNIQUE
  Z5: () => edit('if (/btrim/i.test(rows[0].indexdef))', 'if (/nomatch/i.test(rows[0].indexdef))'), // nunca detecta el correcto: lo recrea siempre
  Z6: () => edit('if (/btrim/i.test(rows[0].indexdef))', 'if (true)'), // nunca repara
  Z7: () => edit("schemaname = current_schema() AND ", ''), // esquema ignorado (equivalente en public)
  Z8: () => edit("require('../scripts/guard-down.cjs')('20261115010000-es306-email-index-repair');", ''), // down sin guarda
  Z9: () => edit("if (!rows.length) return { action: 'created-or-skipped', ...(await createIndexIfClean(sequelize, log)) };", "if (!rows.length) return { action: 'noop' };"), // ausente: no lo crea
  Z10: () => edit(" AND indexname = '${INDEX}'`", '`'), // no filtra por nombre de índice
  Z11: () => edit('await sequelize.query(`CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))`, { transaction });', ''), // borra y no crea
  Z12: () => edit('CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))', 'CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower("email"))'), // crea sin btrim
  Z13: () => edit('const groups = await duplicateGroups(sequelize, transaction);', 'const groups = [];'), // ignora los duplicados
  Z14: () => edit("return { action: 'replaced', groups: [] };", "return { action: 'replaced', groups: [] }; /* sin cambio */"), // equivalente
};
if (!M[m]) throw new Error('mutación desconocida ' + m); M[m](); console.log('M apl ' + m);

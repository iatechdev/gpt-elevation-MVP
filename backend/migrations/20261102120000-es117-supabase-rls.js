'use strict';
// ES-117 · Defensa en profundidad sobre la API pública de Supabase (PostgREST), por si alguien enciende la Data API.
// La app y las migraciones se conectan como dueño de las tablas (postgres, con BYPASSRLS): no cambia nada para ellas.
//  1) anon y authenticated pierden todo privilegio sobre tablas, secuencias y funciones de `public` (y los de PUBLIC sobre funciones
//     propias, entre ellas ai_jobs_guard y skill_candidates_guard). service_role no se toca (decisión del equipo: es la llave del servidor).
//  2) Los privilegios por defecto de quien migra dejan de conceder a anon/authenticated lo que se cree después.
//  3) RLS activo en TODAS las tablas de `public`. Sin política = nadie sin BYPASSRLS lee ni escribe.
//  4) Políticas explícitas solo para los dos roles sin BYPASSRLS que sí deben operar (ES-85): elevation_worker (cifras de presupuesto)
//     y elevation_worker_owner (dueño de las funciones SECURITY DEFINER worker_*). Se limitan a las mismas tablas y operaciones que
//     ya les concede GRANT; las políticas no amplían privilegios, solo dejan pasar filas a quien ya tiene el privilegio.
// Toda tabla nueva debe activar RLS en su propia migración: lo comprueba test/integration/es-117-postgres.cjs y scripts/check-rls.cjs.
const guardDown = require('../scripts/guard-down.cjs');

const PUBLIC_API_ROLES = ['anon', 'authenticated'];
const WORKER = 'elevation_worker';
const OWNER = 'elevation_worker_owner';
// Operaciones que las funciones worker_* hacen como elevation_worker_owner (espejo de los GRANT de ES-85).
const OWNER_POLICIES = [
  ['Consents', ['SELECT', 'UPDATE']],               // FOR SHARE exige SELECT y UPDATE; el GRANT limita UPDATE a la columna createdAt
  ['CareerContextVersions', ['SELECT']],
  ['SkillCatalogs', ['SELECT']],
  ['SkillDefinitions', ['SELECT']],
  ['DeletionRequests', ['SELECT']],
  ['AiJobs', ['SELECT', 'UPDATE']],
  ['SkillCandidates', ['SELECT', 'INSERT']],
  ['BridgeTransfers', ['SELECT', 'INSERT']],
];
const WORKER_TABLES = ['AiBudgetCounters', 'AiUsages'];

// Funciones propias de quien migra (no de extensiones) en `public`.
const OWN_FUNCTIONS = `
  SELECT p.oid::regprocedure::text AS signature FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`;

async function up(queryInterface) {
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql, replacements) => sequelize.query(sql, { transaction, replacements });
    const rows = async (sql) => (await sequelize.query(sql, { transaction, type: 'SELECT' }));
    const existing = new Set((await rows('SELECT rolname FROM pg_roles')).map((r) => r.rolname));
    const api = PUBLIC_API_ROLES.filter((role) => existing.has(role));

    // 1) y 2) Quitar privilegios a la API pública.
    if (api.length) {
      const list = api.join(', ');
      await run(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${list}`);
      await run(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${list}`);
    }
    // EXECUTE sobre funciones nuevas lo concede PostgreSQL a PUBLIC por defecto (y anon/authenticated lo heredan): el REVOKE de arriba, limitado
    // al esquema, no lo quita. Se quita a nivel de quien migra; las funciones futuras que deba ejecutar un rol necesitan GRANT EXECUTE explícito.
    await run('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
    for (const { signature } of await rows(OWN_FUNCTIONS)) {
      // EXECUTE a PUBLIC por defecto lo hereda anon: también se quita. Los triggers no necesitan EXECUTE del usuario al dispararse.
      await run(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC${api.length ? `, ${api.join(', ')}` : ''}`);
    }

    // 3) RLS en todas las tablas de public que pertenecen a quien migra.
    const tables = (await rows(`SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)`)).map((r) => r.relname);
    for (const table of tables) await run(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

    // 4) Políticas explícitas para los roles del worker (si existen: los crea ES-85).
    const policy = async (table, command, role) => {
      if (!tables.includes(table)) throw new Error(`ES-117: falta la tabla ${table}`);
      const name = `es117_${role}_${command.toLowerCase()}`;
      await run(`DROP POLICY IF EXISTS "${name}" ON "${table}"`);
      const clause = command === 'INSERT' ? 'WITH CHECK (true)' : command === 'SELECT' ? 'USING (true)' : command === 'ALL' ? 'USING (true) WITH CHECK (true)' : 'USING (true) WITH CHECK (true)';
      await run(`CREATE POLICY "${name}" ON "${table}" FOR ${command} TO ${role} ${clause}`);
    };
    if (existing.has(WORKER)) for (const table of WORKER_TABLES) await policy(table, 'ALL', WORKER);
    if (existing.has(OWNER)) for (const [table, commands] of OWNER_POLICIES) for (const command of commands) await policy(table, command, OWNER);
  });
}

// Devuelve el estado anterior: sin RLS ni políticas y con los privilegios por defecto de Supabase para anon/authenticated.
// Reabre la exposición: solo para ensayos de reversión (guardDown exige ALLOW_DESTRUCTIVE_MIGRATION y prohíbe producción).
async function down(queryInterface) {
  guardDown('20261102120000-es117-supabase-rls');
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    const rows = async (sql) => (await sequelize.query(sql, { transaction, type: 'SELECT' }));
    const existing = new Set((await rows('SELECT rolname FROM pg_roles')).map((r) => r.rolname));
    const api = PUBLIC_API_ROLES.filter((role) => existing.has(role));

    for (const { schemaname, tablename, policyname } of await rows(`SELECT schemaname, tablename, policyname FROM pg_policies
      WHERE schemaname = 'public' AND policyname LIKE 'es117\\_%'`)) {
      await run(`DROP POLICY IF EXISTS "${policyname}" ON "${schemaname}"."${tablename}"`);
    }
    const tables = (await rows(`SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)`)).map((r) => r.relname);
    for (const table of tables) await run(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    await run('ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC');
    if (api.length) {
      const list = api.join(', ');
      await run(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${list}`);
      await run(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${list}`);
      await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${list}`);
      for (const guard of ['ai_jobs_guard()', 'skill_candidates_guard()']) {
        await run(`DO $$ BEGIN IF to_regprocedure('${guard}') IS NOT NULL THEN GRANT EXECUTE ON FUNCTION ${guard} TO PUBLIC, ${list}; END IF; END $$`);
      }
    }
  });
}

module.exports = { up, down };

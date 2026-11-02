'use strict';
// ES-85 (ES-84-A) · Rol `elevation_worker` y sus cuatro funciones SECURITY DEFINER (spike 43, §5).
// El rol del worker NO tiene privilegios sobre tablas de personas: solo ejecuta worker_claim, worker_heartbeat, worker_publish y
// worker_fail, más SELECT/INSERT/UPDATE en AiBudgetCounters y AiUsages (cifras, no contenido; callClaude, ES-22).
// Las funciones pertenecen a `elevation_worker_owner` (sin login), que solo tiene lo mínimo que ellas necesitan.
// La migración crea los roles SIN contraseña: la contraseña de `elevation_worker` la pone Mauricio en Supabase.
const guardDown = require('../scripts/guard-down.cjs');

const FUNCTIONS = [
  'worker_required_consent_version()',
  'worker_claim(text, integer, integer)',
  'worker_heartbeat(integer, integer, text, integer)',
  'worker_publish(integer, integer, jsonb)',
  'worker_fail(integer, integer, text, boolean, integer, integer)',
];
// Funciones que puede ejecutar el worker. La constante de versión es de uso interno de las otras.
const EXECUTABLE = FUNCTIONS.slice(1);
// Roles que Supabase crea y a los que concede EXECUTE por defecto sobre funciones nuevas de `public` (API REST pública).
const SUPABASE_ROLES = ['anon', 'authenticated', 'service_role'];

const SQL_REQUIRED_VERSION = `
CREATE OR REPLACE FUNCTION worker_required_consent_version() RETURNS integer LANGUAGE sql IMMUTABLE AS $fn$
  SELECT 1 -- debe coincidir con REQUIRED_VERSION.professional_bridge de utils/consent.js (lo comprueba la prueba ES-85)
$fn$`;

const SQL_CLAIM = `
CREATE OR REPLACE FUNCTION worker_claim(p_owner text, p_lease_seconds integer, p_max_attempts integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 120), 30), 1800);
  v_max integer := least(greatest(coalesce(p_max_attempts, 3), 1), 10);
  v_job "AiJobs"%ROWTYPE;
  v_ctx "CareerContextVersions"%ROWTYPE;
  v_catalog_id integer;
  v_catalog_version integer;
  v_skills jsonb;
  v_skip integer[] := ARRAY[]::integer[];
  v_locked boolean;
  v_consent_ok boolean;
  v_keys json;
BEGIN
  IF p_owner IS NULL OR p_owner !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN
    RAISE EXCEPTION 'invalid_owner' USING ERRCODE = '22023';
  END IF;

  -- Recuperación: lease vencido -> otro intento, o FAILED si ya se agotaron. Salta los que otro proceso tiene bloqueados.
  UPDATE "AiJobs" SET
    "status" = CASE WHEN "attempt" >= v_max THEN 'FAILED' ELSE 'PENDING' END,
    "errorCode" = CASE WHEN "attempt" >= v_max THEN 'lease_expired' ELSE "errorCode" END,
    "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
    "finishedAt" = CASE WHEN "attempt" >= v_max THEN now() ELSE "finishedAt" END,
    "updatedAt" = now()
  WHERE "id" IN (SELECT "id" FROM "AiJobs" WHERE "status" = 'RUNNING' AND "leaseExpiresAt" < now() FOR UPDATE SKIP LOCKED);

  SELECT "id", "version" INTO v_catalog_id, v_catalog_version FROM "SkillCatalogs" WHERE "status" = 'published';
  IF v_catalog_id IS NULL THEN RETURN NULL; END IF; -- sin catálogo vigente no hay contra qué validar: los jobs esperan

  LOOP
    SELECT * INTO v_job FROM "AiJobs"
    WHERE "status" = 'PENDING' AND ("notBefore" IS NULL OR "notBefore" <= now()) AND "id" <> ALL (v_skip)
    ORDER BY "createdAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1;
    EXIT WHEN NOT FOUND;

    -- Consentimiento: bloqueo compartido SIN esperar. Si una revocación lo tiene bloqueado, este job espera a la siguiente vuelta
    -- (así no hay interbloqueo con la revocación, que bloquea consentimiento y luego jobs).
    SELECT true, ("status" = 'granted' AND "version" >= worker_required_consent_version())
      INTO v_locked, v_consent_ok
      FROM "Consents"
     WHERE "UserId" = v_job."UserId" AND "purpose" = 'professional_bridge' AND "scope" = 'default'
       FOR SHARE SKIP LOCKED;
    IF v_locked IS NULL THEN
      IF EXISTS (SELECT 1 FROM "Consents" WHERE "UserId" = v_job."UserId" AND "purpose" = 'professional_bridge' AND "scope" = 'default') THEN
        v_skip := v_skip || v_job."id"; -- fila bloqueada por una revocación en curso
        CONTINUE;
      END IF;
      v_consent_ok := false; -- nunca hubo consentimiento
    END IF;
    IF NOT v_consent_ok OR EXISTS (SELECT 1 FROM "DeletionRequests" WHERE "UserId" = v_job."UserId") THEN
      UPDATE "AiJobs" SET "status" = 'INVALIDATED', "errorCode" = 'consent_revoked', "finishedAt" = now(), "updatedAt" = now()
       WHERE "id" = v_job."id";
      CONTINUE;
    END IF;

    SELECT * INTO v_ctx FROM "CareerContextVersions" WHERE "UserId" = v_job."UserId" AND "status" = 'active';
    IF NOT FOUND OR v_ctx."version" <> v_job."contextVersion"
       OR encode(sha256(convert_to(v_ctx."payload", 'UTF8')), 'hex') <> v_job."contextHash" THEN
      UPDATE "AiJobs" SET "status" = 'INVALIDATED', "errorCode" = 'context_changed', "finishedAt" = now(), "updatedAt" = now()
       WHERE "id" = v_job."id";
      CONTINUE;
    END IF;

    UPDATE "AiJobs" SET "status" = 'RUNNING', "attempt" = "attempt" + 1, "fence" = "fence" + 1, "leaseOwner" = p_owner,
      "leaseExpiresAt" = now() + make_interval(secs => v_lease), "catalogVersion" = v_catalog_version, "errorCode" = NULL,
      "notBefore" = NULL, "startedAt" = coalesce("startedAt", now()), "updatedAt" = now()
     WHERE "id" = v_job."id" RETURNING * INTO v_job;

    -- Auditoría de la frontera: claves entregadas y hash del payload cifrado; nunca texto.
    SELECT coalesce(json_agg(o->>'key' ORDER BY (o->>'index')::int), '[]'::json) INTO v_keys
      FROM jsonb_array_elements(v_ctx."origins"::jsonb) AS o;
    INSERT INTO "BridgeTransfers" ("UserId", "version", "keys", "hash", "consumer", "createdAt")
    VALUES (v_job."UserId", v_ctx."version", v_keys, v_job."contextHash", 'worker', now());

    SELECT coalesce(jsonb_agg(jsonb_build_object('skillKey', d."skillKey", 'type', d."type", 'labels', d."labels"::jsonb,
                                                 'rubric', d."rubric"::jsonb) ORDER BY d."skillKey"), '[]'::jsonb)
      INTO v_skills FROM "SkillDefinitions" d WHERE d."catalogId" = v_catalog_id;

    RETURN jsonb_build_object(
      'jobId', v_job."id", 'fence', v_job."fence", 'attempt', v_job."attempt", 'userId', v_job."UserId", 'kind', v_job."kind",
      'contextVersion', v_ctx."version", 'contextHash', v_job."contextHash", 'payload', v_ctx."payload",
      'leaseExpiresAt', v_job."leaseExpiresAt", 'catalogVersion', v_catalog_version, 'skills', v_skills);
  END LOOP;
  RETURN NULL;
END $fn$`;

const SQL_HEARTBEAT = `
CREATE OR REPLACE FUNCTION worker_heartbeat(p_job integer, p_fence integer, p_owner text, p_lease_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 120), 30), 1800);
  v_rows integer;
BEGIN
  UPDATE "AiJobs" SET "leaseExpiresAt" = now() + make_interval(secs => v_lease), "updatedAt" = now()
   WHERE "id" = p_job AND "status" = 'RUNNING' AND "fence" = p_fence AND "leaseOwner" = p_owner;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0; -- false: el job ya no es de este intento (invalidado, cancelado o reclamado): el worker debe abandonar
END $fn$`;

const SQL_PUBLISH = `
CREATE OR REPLACE FUNCTION worker_publish(p_job integer, p_fence integer, p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
  v_user integer;
  v_job "AiJobs"%ROWTYPE;
  v_consent "Consents"%ROWTYPE;
  v_ctx "CareerContextVersions"%ROWTYPE;
  v_catalog_id integer;
  v_keys text[];
  v_item jsonb;
  v_seen text[] := ARRAY[]::text[];
  v_count integer := 0;
  v_cite jsonb;
BEGIN
  SELECT "UserId" INTO v_user FROM "AiJobs" WHERE "id" = p_job;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'job_not_found'); END IF;

  -- 1) Consentimiento con bloqueo compartido: una revocación concurrente (FOR UPDATE) espera a esta publicación o esta espera a ella.
  SELECT * INTO v_consent FROM "Consents"
   WHERE "UserId" = v_user AND "purpose" = 'professional_bridge' AND "scope" = 'default' FOR SHARE;
  -- 2) El job, después (mismo orden que la revocación: consentimiento y luego jobs).
  SELECT * INTO v_job FROM "AiJobs" WHERE "id" = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'job_not_found'); END IF;
  IF v_job."status" <> 'RUNNING' OR v_job."fence" <> p_fence THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'fenced'); -- intento viejo o job ya resuelto: no escribe nada
  END IF;

  IF v_consent."status" IS DISTINCT FROM 'granted' OR v_consent."version" < worker_required_consent_version()
     OR EXISTS (SELECT 1 FROM "DeletionRequests" WHERE "UserId" = v_user) THEN
    UPDATE "AiJobs" SET "status" = 'INVALIDATED', "errorCode" = 'consent_revoked', "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
      "finishedAt" = now(), "updatedAt" = now() WHERE "id" = p_job;
    RETURN jsonb_build_object('ok', false, 'reason', 'consent_revoked');
  END IF;

  SELECT * INTO v_ctx FROM "CareerContextVersions" WHERE "UserId" = v_user AND "status" = 'active';
  IF NOT FOUND OR v_ctx."version" <> v_job."contextVersion"
     OR encode(sha256(convert_to(v_ctx."payload", 'UTF8')), 'hex') <> v_job."contextHash" THEN
    UPDATE "AiJobs" SET "status" = 'INVALIDATED', "errorCode" = 'context_changed', "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
      "finishedAt" = now(), "updatedAt" = now() WHERE "id" = p_job;
    RETURN jsonb_build_object('ok', false, 'reason', 'context_changed');
  END IF;

  -- 3) Validación de la salida: forma, habilidades del catálogo del job y citas dentro de las claves entregadas.
  IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_catalog_id FROM "SkillCatalogs" WHERE "version" = v_job."catalogVersion";
  SELECT coalesce(array_agg(DISTINCT o->>'key'), ARRAY[]::text[]) INTO v_keys FROM jsonb_array_elements(v_ctx."origins"::jsonb) AS o;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_candidates) LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item) k WHERE k NOT IN ('skillKey', 'level', 'citations'))
       OR jsonb_typeof(v_item->'skillKey') IS DISTINCT FROM 'string'
       OR NOT (v_item ? 'level') OR NOT (v_item ? 'citations') THEN
      RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
    END IF;
    IF (v_item->>'skillKey') = ANY (v_seen)
       OR NOT EXISTS (SELECT 1 FROM "SkillDefinitions" WHERE "catalogId" = v_catalog_id AND "skillKey" = v_item->>'skillKey') THEN
      RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || (v_item->>'skillKey');
    IF NOT (jsonb_typeof(v_item->'level') = 'null'
            OR (jsonb_typeof(v_item->'level') = 'number' AND (v_item->>'level') ~ '^[1-4]$')) THEN
      RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'citations') <> 'array' OR jsonb_array_length(v_item->'citations') NOT BETWEEN 1 AND 7 THEN
      RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
    END IF;
    FOR v_cite IN SELECT * FROM jsonb_array_elements(v_item->'citations') LOOP
      IF jsonb_typeof(v_cite) <> 'string' OR NOT ((v_cite #>> '{}') = ANY (v_keys)) THEN
        RAISE EXCEPTION 'invalid_candidates' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_candidates) LOOP
    INSERT INTO "SkillCandidates" ("jobId", "UserId", "skillKey", "level", "citations", "status", "catalogVersion", "createdAt", "updatedAt")
    VALUES (p_job, v_user, v_item->>'skillKey', CASE WHEN jsonb_typeof(v_item->'level') = 'null' THEN NULL ELSE (v_item->>'level')::integer END,
            (v_item->'citations')::json, 'REVIEW_REQUIRED', v_job."catalogVersion", now(), now())
    ON CONFLICT ("jobId", "skillKey") DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Sin candidatas no hay nada que revisar: el job termina directamente.
  UPDATE "AiJobs" SET "status" = CASE WHEN v_count = 0 THEN 'COMPLETED' ELSE 'REVIEW_REQUIRED' END,
    "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "errorCode" = NULL, "finishedAt" = now(), "updatedAt" = now() WHERE "id" = p_job;
  RETURN jsonb_build_object('ok', true, 'candidates', v_count);
END $fn$`;

const SQL_FAIL = `
CREATE OR REPLACE FUNCTION worker_fail(p_job integer, p_fence integer, p_error text, p_retryable boolean,
                                       p_retry_after_seconds integer, p_max_attempts integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
  v_max integer := least(greatest(coalesce(p_max_attempts, 3), 1), 10);
  v_wait integer := least(greatest(coalesce(p_retry_after_seconds, 0), 0), 86400);
  v_error text := CASE WHEN p_error ~ '^[a-z0-9_]{1,32}$' THEN p_error ELSE 'unknown' END;
  v_job "AiJobs"%ROWTYPE;
  v_retry boolean;
BEGIN
  SELECT * INTO v_job FROM "AiJobs" WHERE "id" = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'job_not_found'); END IF;
  IF v_job."status" <> 'RUNNING' OR v_job."fence" <> p_fence THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'fenced');
  END IF;
  -- Presupuesto agotado: no es un fallo del intento. Se devuelve el intento y se espera; el último mapa válido no se toca.
  v_retry := coalesce(p_retryable, false) AND (v_job."attempt" < v_max OR v_error = 'budget_exhausted');
  IF v_retry THEN
    UPDATE "AiJobs" SET "status" = 'PENDING', "errorCode" = v_error, "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
      "attempt" = CASE WHEN v_error = 'budget_exhausted' THEN greatest("attempt" - 1, 0) ELSE "attempt" END,
      "notBefore" = now() + make_interval(secs => v_wait), "updatedAt" = now() WHERE "id" = p_job;
    RETURN jsonb_build_object('ok', true, 'status', 'PENDING');
  END IF;
  UPDATE "AiJobs" SET "status" = 'FAILED', "errorCode" = v_error, "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
    "finishedAt" = now(), "updatedAt" = now() WHERE "id" = p_job;
  RETURN jsonb_build_object('ok', true, 'status', 'FAILED');
END $fn$`;

async function up(queryInterface) {
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    await run(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elevation_worker_owner') THEN
        CREATE ROLE elevation_worker_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elevation_worker') THEN
        CREATE ROLE elevation_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
      END IF;
      -- Quien migra debe poder asignar la propiedad de las funciones (en Supabase no es superusuario).
      IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
        EXECUTE format('GRANT elevation_worker_owner TO %I', current_user);
      END IF;
    END $$`);

    for (const sql of [SQL_REQUIRED_VERSION, SQL_CLAIM, SQL_HEARTBEAT, SQL_PUBLISH, SQL_FAIL]) await run(sql);

    // Propiedad y privilegios mínimos del dueño de las funciones (lo que ellas necesitan, nada más).
    // Cambiar el dueño exige que el nuevo dueño pueda crear en el esquema: se concede solo durante el cambio.
    await run(`GRANT CREATE ON SCHEMA public TO elevation_worker_owner`);
    for (const name of FUNCTIONS) await run(`ALTER FUNCTION ${name} OWNER TO elevation_worker_owner`);
    await run(`REVOKE CREATE ON SCHEMA public FROM elevation_worker_owner`);
    await run(`GRANT USAGE ON SCHEMA public TO elevation_worker_owner, elevation_worker`);
    // FOR SHARE exige algún privilegio UPDATE sobre la tabla (regla de Postgres). Se concede sobre UNA columna de metadatos (createdAt):
    // el dueño no puede cambiar status, version ni ninguna decisión de consentimiento.
    await run(`GRANT UPDATE ("createdAt") ON "Consents" TO elevation_worker_owner`);
    await run(`GRANT SELECT ON "Consents", "CareerContextVersions", "SkillCatalogs", "SkillDefinitions", "DeletionRequests" TO elevation_worker_owner`);
    await run(`GRANT SELECT, UPDATE ON "AiJobs" TO elevation_worker_owner`);
    await run(`GRANT SELECT, INSERT ON "SkillCandidates", "BridgeTransfers" TO elevation_worker_owner`);
    await run(`GRANT USAGE ON SEQUENCE "SkillCandidates_id_seq", "BridgeTransfers_id_seq" TO elevation_worker_owner`);
    // La función de auditoría escribe en BridgeTransfers; el dueño no puede leer nada más de personas.

    // El worker: sin tablas de personas. Primero se quita todo y luego se concede lo único permitido.
    await run(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM elevation_worker`);
    await run(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM elevation_worker`);
    await run(`GRANT SELECT, INSERT, UPDATE ON "AiBudgetCounters", "AiUsages" TO elevation_worker`);
    await run(`GRANT USAGE ON SEQUENCE "AiBudgetCounters_id_seq", "AiUsages_id_seq" TO elevation_worker`);

    for (const name of FUNCTIONS) {
      await run(`REVOKE ALL ON FUNCTION ${name} FROM PUBLIC`);
      // Supabase concede EXECUTE por defecto a anon/authenticated/service_role sobre funciones nuevas de public: se quita explícitamente.
      for (const role of SUPABASE_ROLES) {
        await run(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          REVOKE ALL ON FUNCTION ${name} FROM ${role}; END IF; END $$`);
      }
    }
    for (const name of EXECUTABLE) await run(`GRANT EXECUTE ON FUNCTION ${name} TO elevation_worker`);
  });
}

// El down quita funciones y privilegios. Los roles son del clúster: se eliminan solo si ya no los usa ninguna otra base.
async function down(queryInterface) {
  guardDown('20261028190100-es85-worker-role-functions');
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    const run = (sql) => sequelize.query(sql, { transaction });
    for (const name of FUNCTIONS.slice().reverse()) await run(`DROP FUNCTION IF EXISTS ${name}`);
    await run(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elevation_worker') THEN DROP OWNED BY elevation_worker; END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elevation_worker_owner') THEN DROP OWNED BY elevation_worker_owner; END IF;
    END $$`);
  });
  for (const role of ['elevation_worker', 'elevation_worker_owner']) {
    // Fuera de la transacción: si otra base del clúster aún depende del rol, se conserva (y se avisa).
    await sequelize.query(`DO $$ BEGIN DROP ROLE IF EXISTS ${role};
      EXCEPTION WHEN dependent_objects_still_exist THEN RAISE NOTICE 'El rol ${role} se conserva: lo usan otras bases.'; END $$`);
  }
}

module.exports = { up, down };

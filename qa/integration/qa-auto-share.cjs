// [QA-Claude] Solo para pruebas de regresión: en la base DESECHABLE de QA, cada vez que una persona se vincula a un terapeuta se registra
// su autorización `therapist_sharing` (como si la hubiera dado por la API). Adapta los scripts anteriores a ES-96 sin editarlos.
// Uso: QA_SUT=<clon> DATABASE_URL=<base> node qa/integration/qa-auto-share.cjs on|off
const path = require('node:path'); const { Client } = require(path.join(process.env.QA_SUT, 'backend', 'node_modules', 'pg'));
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: false }); await c.connect();
  if (process.argv[2] === 'off') { await c.query('DROP TRIGGER IF EXISTS qa_auto_share ON "Users"'); console.log('trigger off'); return c.end(); }
  await c.query(`CREATE OR REPLACE FUNCTION qa_auto_share() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN
      IF NEW."therapistId" IS NOT NULL THEN
        INSERT INTO "Consents" ("UserId", purpose, scope, status, version, "decidedAt", "createdAt", "updatedAt")
        VALUES (NEW.id, 'therapist_sharing', 'therapist-' || NEW."therapistId", 'granted', 1, now(), now(), now())
        ON CONFLICT ("UserId", purpose, scope) DO UPDATE SET status = 'granted', version = 1;
      END IF;
      RETURN NEW;
    END $f$`);
  await c.query('DROP TRIGGER IF EXISTS qa_auto_share ON "Users"');
  await c.query('CREATE TRIGGER qa_auto_share AFTER INSERT OR UPDATE OF "therapistId" ON "Users" FOR EACH ROW EXECUTE FUNCTION qa_auto_share()');
  console.log('trigger on'); await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

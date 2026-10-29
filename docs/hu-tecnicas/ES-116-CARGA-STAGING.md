# ES-116 · Cómo cargar los territorios del catálogo en staging

> **Estado: PREPARADO, NO EJECUTADO.** Dev no toca staging ni producción: este documento lo ejecuta Mauricio (o Infra con su confirmación). No contiene secretos; la `DATABASE_URL` la pone quien ejecuta, en su propio terminal.

## Qué cambia en la base y por qué importa el orden
- Una sola columna nueva y opcional: `"SkillDefinitions"."territories"` (JSON, admite nulos). Aditiva: no borra ni reescribe datos.
- En staging `sync()` **no altera tablas que ya existen** (`DB_SYNC_ALTER` no se define), así que la columna NO aparece sola al desplegar.
- El código nuevo la lee en cada consulta del catálogo y de `GET /api/skill-map`. **Si el código se despliega antes que la columna, esas dos rutas dan 500.** El código anterior, en cambio, ignora la columna.
- **Orden obligatorio: 1) columna → 2) código → 3) borrador (opcional).**

## Antes de empezar (Mauricio confirma)
1. Punto de restauración o volcado de respaldo de la base de **staging** (No verificado: qué plan de respaldos tiene el proyecto de Supabase de staging).
2. Qué código va a staging. Hoy los cambios están en la cadena de PR #84 (ES-37) → #86 (ES-30) → #88 (ES-116), aún sin fusionar ni aprobados por QA. Opciones: desplegar la rama `ES-116-catalogo-territorios` a staging, o esperar al QA y desplegar `main`. (No verificado: de qué rama despliega hoy el entorno `staging` de Railway.)
3. Que el entorno es **staging** y no producción (proyecto de Supabase y variables distintos, según `DESPLIEGUE-RAILWAY.md`).

## Paso 0 · Mirar antes de escribir (solo lectura)
En el editor SQL de Supabase de **staging** (o `psql` con la URL de staging):
```sql
-- ¿Existe ya la columna? (0 filas = falta)
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'SkillDefinitions' AND column_name = 'territories';
-- ¿La base ya usa migraciones? (NULL = no existe SequelizeMeta)
SELECT to_regclass('"SequelizeMeta"');
-- ¿Qué catálogos hay?
SELECT id, version, status FROM "SkillCatalogs" ORDER BY version;
```
Anota el resultado: decide el Paso 1 (opción A/B) y el Paso 3 (caso A/B/C).

## Paso 1 · Añadir la columna (ANTES de desplegar el código)
**Opción A — recomendada.** Una sentencia idempotente, equivalente a la migración `20261029010000-es116-skill-territories` (instantánea: añadir una columna nula no reescribe la tabla):
```sql
ALTER TABLE "SkillDefinitions" ADD COLUMN IF NOT EXISTS "territories" JSON;
```
**Opción B — NO recomendada hoy.** `npm run db:migrate` aplica **todas** las migraciones pendientes, no solo esta (entre ellas ES-85 crea roles y funciones de base de datos, que requieren confirmación aparte), y sobre una base creada por `sync()` falla con «already exists» salvo que antes se registre la línea base (ver «Migraciones versionadas» en `DESPLIEGUE-RAILWAY.md`). Úsala solo cuando staging ya esté bajo migraciones y Mauricio haya revisado `npm run db:migrate:status`.

Comprobación: repetir la primera consulta del Paso 0 → una fila `territories | json`. El staging actual sigue sano: `GET /api/health` y «Mi mapa» de la persona demo responden igual.

## Paso 2 · Desplegar el código
Según lo decidido arriba (rama de Railway o `main`). Humo, en este orden:
1. `GET /api/health` → `{"status":"ok"}`.
2. Entrar como administrador → menú «Catálogo de habilidades» abre `/admin/skill-catalog` sin error.
3. Como persona (demo): `/app/skill-map` carga y no da 500.
- **Si por error el código se desplegó antes que la columna:** el síntoma es 500 en `/api/skill-map` y en el catálogo («column "territories" does not exist»). Se arregla ejecutando el Paso 1 (idempotente); no hace falta revertir el código.

## Paso 3 · Borrador con la asignación PROVISIONAL (opcional)
La asignación del seed la propuso Dev, **sin verificar**; Alejo debe revisarla y corregirla desde la pantalla antes de publicar. El script **nunca publica** y solo imprime cuenta de habilidades. Según el Paso 0:

| Caso | Qué hay en staging | Qué hacer |
|---|---|---|
| **A** | Ningún catálogo (ni publicado ni borrador) | `cd backend && DATABASE_URL='<staging>' node scripts/seedSkillCatalogDraft.js` → crea el borrador con las 8 habilidades y sus territorios; imprime `{"draftId":…,"version":…,"skills":8,"published":false}`. |
| **B** | **Cualquier catálogo publicado** (sintético o REAL; producción ya tiene la versión 1 publicada) | **No uses el script** (decisión de Mauricio, Jira ES-116, comentario 10528): el borrador copia el vigente y el script lo mezclaría con el texto sin verificar (sobrescribe las habilidades de igual clave y añade las demás). En la pantalla: «Crear borrador desde el vigente» y marcar los territorios de cada habilidad (o dejarlo a Alejo). |
| **C** | Ya hay un borrador abierto | El script se niega («Ya hay un borrador abierto»). Edita ese borrador desde la pantalla. |

`DB_SSL`: déjalo con su valor por defecto en staging (Supabase exige SSL); solo `DB_SSL=false` en una base local.

## Reversión
- **Código:** Rollback de Railway al despliegue anterior (probado en staging, ver `DESPLIEGUE-RAILWAY.md` § Reversión). El código anterior ignora la columna.
- **Columna:** se deja; es inofensiva. Quitarla solo si Mauricio lo decide: `ALTER TABLE "SkillDefinitions" DROP COLUMN "territories";` (borra los territorios guardados; destructivo, requiere confirmación).
- **Borrador:** no hay «descartar borrador»; un borrador sobrante es inofensivo pero impide crear otro (solo puede haber uno). Se vacía quitando sus habilidades o se publica. Limitación conocida, no resuelta en ES-116.
- Publicar desde la pantalla es irreversible (la versión pasa a vigente y la anterior se archiva); para corregir se publica una versión nueva.

## Qué NO está verificado
Railway de staging con esta rama; plan de respaldos de Supabase; que `psql` esté disponible en tu equipo (el editor SQL de Supabase sirve); el seed contra la base real de staging (se probó solo contra un Postgres local desechable).

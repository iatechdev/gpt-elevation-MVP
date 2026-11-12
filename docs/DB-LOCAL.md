# Base de datos local para Dev y QA (ES-80)

Cada persona trabaja con su propio Postgres local, desechable. Nadie usa la base de staging ni recibe su `DATABASE_URL`. Misma versión mayor que staging: **PostgreSQL 17**.

El usuario `elevation` y la clave `elevation_local` son solo para esta base local. No son secretos y la base no sale de tu equipo.

## Opción A: sin Docker (recomendada)

Requisitos: Node 20 o superior. No hace falta administrador ni instalar nada en el sistema.

```bash
cd backend
npm ci
npm run db:local
```

La primera vez descarga los binarios de Postgres (unos 100 MB en `node_modules`) y crea la base `elevation_dev` en el puerto `54329`. Deja la terminal abierta; `Ctrl+C` la detiene. Los datos quedan en `backend/.pgdata/` (no se versiona).

> **Aviso: detén la base antes de volver a ejecutar `npm ci`.** `npm ci` borra y reinstala `node_modules`, donde están los binarios de Postgres que la base en marcha tiene en uso. Si la dejas corriendo (la terminal con `npm run db:local` abierta), la instalación puede fallar o dejar los binarios rotos. Orden seguro: `Ctrl+C` en esa terminal, `npm ci`, y de nuevo `npm run db:local`. Los datos de `backend/.pgdata/` no se pierden.

En otra terminal, crea `backend/.env` con estas variables (no se versiona) más las que ya necesitas (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PROMPT_ENCRYPTION_KEY`; genera valores propios, no uses los de staging):

```text
DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/elevation_dev
DB_SSL=false
```

Luego `npm start` en `backend/`. El servidor crea las tablas que falten. Para empezar de cero: detén la base y ejecuta `npm run db:local -- --reset`.

## Opción B: con Docker

```bash
docker compose up -d
```

Usa el mismo puerto y las mismas variables que la opción A. `docker compose down -v` borra los datos.

## CI

El job `backend` levanta un `postgres:17` desechable y comprueba que el servidor puede conectarse y crear el esquema. Las pruebas de integración con base real que escriban Dev o QA pueden usar `DATABASE_URL` de ese servicio (en CI) o la de tu base local.

## Límites

- Las 76 pruebas actuales siguen simulando la base. Esta herramienta da la base real; los casos de integración (aislamiento entre personas, propietario en servidor) los escriben Dev y QA.
- `embedded-postgres` es un paquete de terceros en versión beta que empaqueta binarios de Postgres. Se fija la versión exacta. Si algo falla en tu sistema operativo, usa la opción B.
- No sustituye a staging: las pruebas de humo y de despliegue siguen corriendo allí con datos sintéticos.

## Notas de QA-80

- **Codificación:** la base local se crea con `--encoding=UTF8 --locale=C` (en Windows `initdb` tomaba WIN1252 y fallaba con emojis). Si tu `backend/.pgdata` es anterior a este cambio, ejecuta `npm run db:local -- --reset` para recrearla.
- **Docker:** el puerto se publica solo en `127.0.0.1`, no en todas las interfaces.
- **Producción (no verificado):** `embedded-postgres` está en `devDependencies`; no se comprobó en Railway que el build con `NODE_ENV=production` omita las devDependencies. Revisar el tiempo y el tamaño del build en el primer despliegue.

## Pruebas con PostgreSQL real: un runner que descubre las suites (ES-245)

Todas las suites de `backend/test/integration/*.cjs` se corren con **un solo comando**; una suite nueva entra sola, **sin tocar `.github/workflows/ci.yml` ni `backend/package.json`** (antes cada historia añadía su paso y su script, y los PR abiertos chocaban en esas listas).

```bash
cd backend
PG_TEST_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:pg
npm run test:pg -- --list            # qué correría y por qué (no ejecuta nada)
npm run test:pg -- --only es-28      # solo los archivos cuyo nombre contiene ese texto
```

Convención al crear una suite:

1. El archivo vive en `backend/test/integration/` (`es-NNN-postgres.cjs`) y **declara en su propio texto** la variable que lee, `ESNNN_TEST_DATABASE_URL`; el runner la detecta y le da `PG_TEST_URL` (en CI, el servicio PostgreSQL desechable del job `data-rights-postgres`). La suite crea y borra su propia base aleatoria y exige bucle local.
2. Si necesita otra variable de entorno, una línea `// @pg-env CLAVE=valor` (p. ej. `// @pg-env DATA_RIGHTS_ENABLED=true`).
3. Los archivos `zz-*.cjs` se ignoran (sondas locales). Las exclusiones (con su motivo) viven en `EXCLUDE` de `backend/scripts/runPgSuites.cjs`; hoy: `es-14` (corre en el job `backend` con su base) y `es-15` (PostgreSQL embebido y navegador).
4. Una prueba unitaria (`test/es-245-pg-runner.test.cjs`) falla si una suite no declara su variable: no puede quedar fuera de la CI en silencio.

El runner corre las suites **en serie** (como antes), no se detiene en el primer fallo, agrupa la salida por archivo y termina con un resumen que lista **por nombre** las que fallaron. Los scripts `npm run test:xxx:pg` existentes siguen sirviendo para correr una suite suelta, pero ya no son necesarios para la CI.

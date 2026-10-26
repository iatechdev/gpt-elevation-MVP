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

# ES-82 · PR #49 (head e7e7ddd), merge local temporal con main a2c953f
- Diff: una línea del Dockerfile (`npm install --no-package-lock --omit=dev` solo en el backend; el frontend sigue con sus devDependencies). El CI no cambia.
- Instalación limpia del backend con `--omit=dev` (npm 11, Windows): 40 MB frente a 143 MB; 0 paquetes `embedded-postgres` ni `@embedded-postgres/*`.
- Recorrido de require/import de 100 archivos de runtime del backend (sin tests, scripts, evaluación ni test-db): ninguno usa una devDependency ni una dependencia no declarada.
- Servidor arrancado desde esa instalación solo de producción (con `shared/` al lado, como en la imagen): health 200, sin MODULE_NOT_FOUND; regresión ES-18/19 20/20 contra Postgres real.
- `sequelize-cli` (de #50) está en `dependencies`, no en devDependencies, así que sobrevive a `--omit=dev`.
- Build del frontend en verde. Docker, Linux, tamaño/tiempo de imagen en Railway y staging: no verificados.
- Nota de método: mis scripts de ES-14 no se usan aquí porque ES-14 (#32) aún no está en main.

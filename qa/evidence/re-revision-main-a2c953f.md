# Re-revisión sobre main a2c953f (28-oct): heads rebasados
Método: por PR, merge local temporal con main a2c953f; comparación del parche propio del PR contra main antes y después (solo difiere `frontend/src/App.tsx`, en los PRs de ruta, como es esperable); inspección de la resolución de conflictos (merge commit, `git show --cc`); lint, tipos, `npm test`, `npm audit` y build de frontend.
| PR | Head | lint/tipos | tests | audit | build | Nota |
|---|---|---|---|---|---|---|
| #36 ES-28 | 92120ed | ok | 36/36 | 0 | ok | conviven botones Mis evidencias y Mi mapa en el dashboard |
| #37 ES-26 | 27026ae | ok | 38/38 | 0 | ok | delta propio en App.tsx: import y ruta /app/compass |
| #38 ES-31 | 5c729ad | ok | 42/42 | 0 | ok | rutas /app/route-catalog y /admin/route-catalog |
| #39 ES-16 | 240e695 | ok | 33/33 | 0 | ok | ruta /app/exercises |
| #40 ES-15 | 957b385 | ok | 34/34 | 0 | ok | RegisteredRoutes, /app/diary, /app/next-step |
| #45 ES-34 | 6f8c2ec | ok | 45/45 | 0 | ok | sin «Reintentar lectura» en errores de validación (verificado en navegador) |
| #32 ES-14 | d091753 | ok | front 30/30; back 255/255 | 0 | ok | es14-real-db 61/61, es14-23-combined 13/13, ES-18/19 20/20 contra Postgres real |
Hallazgo de integración: #40 y #45 declaran la misma ruta `/app/next-step` (NextStepPage vs CareerShell); tras fusionar uno, el otro conflicta en App.tsx, landing.css y UserDashboard.tsx, y las dos rutas conviven con el mismo path.
No repetido: pruebas con servidor real y navegador de #36 a #40 (el parche propio no cambió).

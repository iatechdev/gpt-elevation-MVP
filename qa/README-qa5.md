# Scripts de QA-Claude-5 (qa/qa5-*)

Pruebas de verificación de PR, mutaciones y regresión escritas por QA-Claude-5 (read-only sobre el código de la aplicación). **No forman parte del CI.** Datos sintéticos; sin credenciales, correos reales, tokens ni rutas locales.

## Cómo se usan
- Variables: `QA_TOOLS` (carpeta con `qa5/`, `node22/`, `playwright/`, `pw-browsers/`, `lh/node_modules/axe-core`), `QA_REPO` (raíz del repositorio), `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH`, `AXE`, `DATABASE_URL` (PostgreSQL **desechable propio**), `API`, `BASE`, `STG` (URL de staging, solo para los scripts `*-staging*`).
- Casi todos ejecutan el backend real contra una base desechable con un doble del proveedor de IA (sin gasto). Las mutaciones se aplican sobre una **copia de trabajo** y se restauran con git; nunca sobre el repositorio.
- Los scripts de staging (`qa5-es45-staging.cjs`, `qa5-es45-roles-staging.cjs`, `qa5-es45-abuso-staging.cjs`, `qa5-staging-ro.cjs`) **escriben** (cuentas `qa-sint-*`) y exigen la confirmación directa del responsable del producto; las credenciales de roles las lee de un archivo local fuera del repositorio.

## ES-45 (E2E ES/EN, privacidad y abuso en registro)
`qa5-es45-recorrido.cjs` (recorrido completo, local), `qa5-es45-privacidad.cjs` (diario/crisis frente al proveedor), `qa5-es45-abuso.cjs` (registro/login con límites de producción, local), `qa5-es45-staging.cjs`, `qa5-es45-roles-staging.cjs`, `qa5-es45-abuso-staging.cjs`, `qa5-es45-explore.cjs`, `qa5-es45-carrera-dbg.cjs`, `qa5-es45-contexto-errores.cjs`.
Resultados en Jira ES-45: comentarios 12977 (Fase 0 local), 12997 y 13000 (Fase A en staging, commit b2ad42b) y 13001 (informe final).
**No verificado en ES-45:** propuesta de evidencia/habilidades con modelo real, tono con muestra mayor, vista del profesional del material autorizado, rol administración y junta, correo/invitaciones/recordatorios, 390 px y oscuro del recorrido de la persona, lector de pantalla y navegadores reales, purga física, catálogo real de rutas.

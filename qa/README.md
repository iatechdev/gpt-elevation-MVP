# qa/ — scripts de QA-Claude-2 (cadena del mapa: #84, #86, #88, #90, #93, #92)

Solo lectura sobre el código de la aplicación. Datos sintéticos (`@example.test`), bases locales desechables, nunca staging ni producción.
Entorno usado: Node 22 portable, Playwright 1.64.1 + Chromium, `embedded-postgres` (`backend/scripts/db-local.cjs`, puerto 54331), backend en :8090 y `vite` en :5173
(`VITE_BACKEND_URL=http://localhost:8090`; para los mocks, `frontend/scripts/mock-es37.mjs` en :8099).

| Script | Qué prueba |
|---|---|
| `es37-contrast.cjs` | Contraste WCAG de los tokens (claro y oscuro) |
| `es37-visual.cjs`, `es37-dark-focus.cjs` | Pantallas ES-37 con mock, desborde, modo oscuro en vivo, foco |
| `contrast-dom.cjs` | Contraste del texto renderizado (estilos computados) en cualquier ruta |
| `es30-layout.mjs`, `es30-map.cjs`, `es30-real.cjs`, `es30-codex-checks.cjs` | Mapa por territorios (#86), «Revocar todos» con backend real |
| `seed-catalog.cjs` | Publica un catálogo sintético con el seed del repo (solo base local) |
| `es116-api.cjs`, `es116-ui.cjs`, `es116-map.cjs`, `es116-codex-checks.cjs` | Catálogo con territorios (#88) |
| `es90-real.cjs`, `es90-onboarding.cjs` | Acceso al mapa (#90) |
| `es119-api.cjs`, `es119-ui.cjs` | Registrar mi nivel (#93) |
| `es118-check.cjs` | Habilidades técnicas borrador (#92) |
| `pendientes.cjs` | Sesión/token, puente (Compass) real, 40 capacidades (P-4), catálogo vacío |
| `perf-map.cjs` | Rendimiento acotado: 6 personas concurrentes, solo loopback (P-2/P-3) |

Variables: `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH`, `OUT` (capturas), `BACKEND`, `DATABASE_URL` (solo local), `TOKEN`/`ROLE`/`URL`/`WIDTHS`/`CLICK` para `contrast-dom.cjs`.

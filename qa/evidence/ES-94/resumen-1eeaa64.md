# ES-94 · PR #77 · la landing explica las tres rutas y Elevation sin etiqueta de estado · head 1eeaa64

[QA-Claude] · 29-oct-2026. Merge local con main ec77c2c (ya con #54, #64, #23, #37, #38, #41), Postgres 17 real, servidor del merge sirviendo el frontend, Chromium.

| Bloque | Resultado |
|---|---|
| lint / tipos / frontend / backend / audit / build | 0 avisos / ok / 122/122 / 358/358 / 0 / ok (JS 751.119 B, CSS 101.965 B: deuda de peso) |
| CI del PR | verde (frontend, backend, data-rights-postgres) |
| Mis casos (`es94-landing.cjs`, `landing-run2-1eeaa64.jsonl`) | 13 ok / 1 hallazgo Bajo (C03) |
| Script de Dev (`es94-browser.cjs`) | 3/3 |
| Regresión | landing S7 14/14, S9 12/14 (conocidas), S11 14/14, S13 14/14; chips 10/10; CMS 8/8; es68 25/28 (3 falsas alarmas conocidas); ES-18/19 20/20; sesión 25/25; navegador es74 23/23 |
| Fusión con #70 | conflicto en 4 archivos de ES-90 (`es-90-markers.test.cjs`, `es90-browser.cjs`, `landingPending.ts`, `es-90-pending.test.mjs`); `landing-content.json` se une solo |

Verificado: los tres textos de las rutas y la frase «Tú decides cuál aceptar y puedes rechazar cualquiera» salen literalmente como en el PR en el GET público (ES y EN) y en la landing a 320, 375, 768 y 1440 px; ya no existe «se mostrarán cuando el catálogo esté verificado», no hay corchetes ni la clave de Elevation en ninguna clave; los textos nuevos no prometen empleo, ingresos, plazos ni porcentajes y coinciden con §4 del contrato de rutas (ES-32); Elevation sin etiqueta y Skill Map con «Próximamente» (una sola etiqueta) en ES y EN; PUT a la clave eliminada → 400, el superadmin edita las demás, administrador y participante 403; contraste AA; un h1; sin desbordes ni errores; solo el propio origen; la pestaña Landing sin el panel de pendientes para superadmin y administrador y con la lista general editable (la clave de continuidad aparece en ella).

Hallazgos / observaciones (ninguno Crítico ni Alto):
- ES94-C03 (Bajo): un override viejo de `landing.modules.elevation.status` en la base se sigue devolviendo en el GET público (la clave ya no está en el catálogo): no se pinta, pero el GET publica filas huérfanas.
- ES94-O1 (editorial): el cuerpo de las rutas sigue abriendo con «Tres rutas fundamentadas con fuentes y fechas» mientras el contrato permite casillas vacías y las fuentes reales del catálogo siguen pendientes del PO; «Tú decides…» ayuda, pero convendría que el PO confirme el encabezado.
- ES94-O2: los textos aprobados no constan en el ticket; verifiqué contra el PR y el contrato.
No verificado: revisión editorial del PO y staging.

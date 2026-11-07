# Ejecución — ES-62 (PR #13 f86d7a8), ES-63 (PR #11 ab9a4ce), ES-64 (PR #12 2bc64f0)

[QA-Claude] · 26-oct-2026 · Clones limpios; builds servidos en local con API simulada; Chromium del navegador integrado. Sin sesión real.

| Comprobación | PR #13 | PR #11 | PR #12 |
| --- | --- | --- | --- |
| npm test | 8/8 | 10/10 | 8/8 |
| tsc -b / lint --max-warnings 0 / audit high | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| JS (kB, gzip) | 522,16 (133,35) | 522,19 (133,29) | 522,88 (133,39) |
| Secretos en el diff | 0 | 0 | 0 |

- ES-62: enlace "saltar al contenido" es el primer foco y apunta a `<main id=contenido>`; logotipo → `/`; selector ES/EN con aria-pressed; "Ingresar" → `/login`; sin etiqueta PROTOTIPO; idioma elegido persiste tras recargar y `html lang` pasa a `en`; a 320 px sin desbordes y objetivos de 44 px (44×45, 98×44, 75×48); anillo de foco de 3 px.
- ES-63: titular 84 px (1440) / 40 px (360); dos puertas, cada una un solo enlace a `/login`, una columna a 360 px y dos a 1440; sin anidar controles.
- ES-64: sin la variable de compilación la franja no se renderiza; con `VITE_LANDING_EXAMPLE_APPROVED=true` aparece con la etiqueta "Ejemplo ilustrativo · caso ficticio · docencia", texto de hipótesis revisables y nombre accesible sin flecha.
- Maqueta aprobada (1440 px): cabecera, héroe, puertas y franja dentro de un marco centrado de 1078 px (174–1252); texto a 202 px. Implementación: cabecera y puertas de borde a borde (0–1425), texto a 58 px, franja 1425 de ancho.
- Fusión entre PR: #11, #12 y #13 chocan entre sí en `LandingPage.tsx` y `landing.css`; cada uno es limpio contra `main`.

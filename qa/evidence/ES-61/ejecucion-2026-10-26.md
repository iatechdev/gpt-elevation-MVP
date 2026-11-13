# Ejecución — ES-61 / PR #9 · commit 1f6b1b6

[QA-Claude] · 26-oct-2026 · Clon limpio del commit; comparación contra `main` (573669b). Node 24 / Windows local. Build servido en local con API simulada (503). Sin sesión ni datos reales.

| Caso | Resultado real |
| --- | --- |
| Repo: `npm test` | 2 de 2; contraste texto/papel 5,54:1; ocre decorativo 2,69:1 (no se usa como texto) |
| Repo: `tsc -b` y build | exit 0; JS 518,78 kB (131,81 gzip); CSS 24,09 kB (5,16 gzip); fuente 48,25 kB |
| Lint del alcance / global | exit 0 / 13 problemas (4 errores, 9 advertencias), iguales a `main` |
| ES61-F01 tokens vs DISENO-FASE1.md | Coinciden; 6 colores semánticos extra (info/éxito/error, claro y oscuro) que daisyUI exige; la mono es Cascadia/SFMono/Consolas en lugar de JetBrains Mono (el diseño admite cambiar el token) |
| ES61-F02 sin regresión | `/login`: estilos computados idénticos entre `main` y PR (17 elementos, mismo hash). Zonas con sesión no verificadas por QA |
| ES61-F03 foco y teclado | Tab enfoca el selector de idioma con contorno de 3 px ocre; sin overflow a 320 px |
| ES61-F04 contraste | Reproducido (test del repo) |
| ES61-F05 textos nuevos | Sin textos nuevos en `LandingPage.tsx` |
| ES61-S01 dependencias | `npm audit --omit=dev`: 0; daisyui MIT, Inter OFL-1.1 con texto de licencia incluido |
| ES61-S02 CSP | Build servido con la CSP de staging: fuente cargada del mismo origen, 0 violaciones |
| ES61-S03 secretos | 0 en el diff |
| ES61-P01/P02 peso | JS +0,78 kB, CSS +14,2 kB; muy por debajo de los umbrales propuestos (JS ≤ 600 kB, CSS ≤ 40 kB) |
| Tema oscuro | Sigue la preferencia del sistema (fondo rgb(21,21,19)); sin selector manual (decisión de diseño) |

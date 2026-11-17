[QA-Claude] QA aprobado — head f92c620429697f68987fb283caf8042e1f48765c

**Veredicto: APROBADO** — PR #312 (puerta de auditoría del frontend con excepción con caducidad para GHSA-fc5q-39xc-vjpf). Plan A1–A9 aprobado por Infra. CI 4/4 y CLEAN verificados con gh sobre la cabeza exacta, también justo antes de publicar. Cabeza ya al día con main (sin merge necesario). Solo CI/tooling: sin pantallas, datos, IA, staging ni producción.

| Caso | Resultado |
|---|---|
| A1 otro aviso falla | **Cumple.** Con un `npm` falso que devuelve el informe real de picomatch más: otro alto, otro crítico, otro GHSA del mismo paquete picomatch, uno por cadena, uno en la misma lista `via` que el permitido, origen desconocido y alta sin origen → exit 1 en los 7 (con npm saliendo 0 y 1). Moderada y limpio → 0 |
| A2 antes de la fecha | **Cumple.** `npm audit` REAL: hoy, 2026-12-01T00:00Z y 2026-12-01T23:59:59Z → «EXCEPCIÓN VIGENTE», exit 0 |
| A3 después de la fecha | **Cumple.** `AUDIT_GATE_NOW` 2026-12-02T00:00Z y 2027-01-15 → «EXCEPCIÓN CADUCADA», exit 1 aunque el aviso siga; fecha inválida → exit 2 |
| A4 bundle | **Cumple.** `vite build` propio de la cabeza: 159 archivos en `dist/`, `picomatch`/`tinyglobby`/`fdir` = 0 coincidencias y ninguna referencia a `node_modules/vite`. `vite` está en devDependencies. Ver observación E312-2 |
| A5 `package*.json` | **Cumple.** Sin cambios (4 archivos: ci.yml, docs, script, prueba) |
| A6 sin `\|\| true` ni umbral laxo | **Cumple.** El paso de auditoría no tiene `continue-on-error` (el único del job es el lint, anterior al PR); el umbral sigue en alta+crítica; excepción por GHSA, no por paquete (probado en A1); job `backend` intacto |
| A7 fallo cerrado | **Cumple.** Salida de texto, vacía, `{"error":…}` (sin lockfile) → exit 2; `{}`, `[]`, `{"vulnerabilities":null}` → exit 1; `null` → exit 1 por excepción no controlada (E312-1). Nunca 0 |
| A8 mutaciones (6) | **6/6 detectadas** (prueba del PR y/o mi guion): sin comparación de fecha (PR: 1 falla), excepción por paquete (PR 1 + guion 4), informe sin formato pasa (PR 1 + guion 6), solo `high` (PR 1 + guion 4), `exit 0` siempre (**solo mi guion**, 20 casos: la prueba del PR no ejecuta `main()`), JSON ilegible sin salir con 2 (solo mi guion; queda en exit 1, sigue fallando) |
| A9 regresión | `node --test test/audit-gate.test.mjs` 6/6; CI del PR 4/4 (incluye el paso real en Ubuntu: `frontend` verde) |

**Hallazgos**
| ID | Sev. | Evidencia | Sugerencia |
|---|---|---|---|
| E312-1 | Bajo | Si `npm audit --json` imprime `null`, `report.error` lanza TypeError: la puerta falla (exit 1, nunca pasa) pero con un volcado de Node en vez del mensaje | `report?.error` o validar objeto antes; no urgente |
| E312-2 | Observación | `@tailwindcss/vite` está en `dependencies` y arrastra vite → tinyglobby → fdir → picomatch; por eso `--omit=dev` lo ve. Es herramienta de build (bundle = 0 coincidencias) | considerar moverlo a devDependencies en un ticket aparte; no en este PR |
| E312-3 | Observación | La prueba del PR no cubre `main()` (spawn, lectura del JSON, códigos de salida): lo cubrí con el npm falso | opcional: añadir una prueba con un `npm` falso |
| E312-4 | Observación | Excepción con caducidad el 2026-12-01: queda como tarea de revisión (renovar con motivo, actualizar o retirar) | seguimiento de PO/Tech Lead |

**No verificado:** CI en Ubuntu más allá del resultado verde ya publicado; la explotabilidad de picomatch en máquinas de desarrollo (riesgo aceptado y declarado); avisos nuevos que aparezcan después de hoy (la puerta los bloquea, probado con informes sintéticos).

Evidencia: PR de QA #6, `qa/evidence/PR312-cabeza-f92c6204/` (fechas, npm falso, mutaciones, scripts). **Puedes fusionar con CI 4/4 y CLEAN.** Cualquier cambio de head anula esta aprobación.

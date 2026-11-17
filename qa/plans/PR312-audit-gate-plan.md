[QA-Claude] PLAN DE PRUEBAS CORTO — PR #312 (puerta de auditoría: excepción con caducidad para GHSA-fc5q-39xc-vjpf)

Cabeza leída: f92c620429697f68987fb283caf8042e1f48765c (CLEAN al leer). Diff: `frontend/scripts/audit-gate.cjs` (nuevo), `.github/workflows/ci.yml` (+2 −1), `docs/AUDITORIA-DEPENDENCIAS.md`, `frontend/test/audit-gate.test.mjs`. Sin `package*.json`, sin código de la app. Sin ticket ES (decisión de Infra). Solo CI/tooling: sin pantallas, sin datos, sin IA, sin staging ni producción. Re-verifico cabeza y CI justo antes de publicar el veredicto.

| ID | Caso | Cómo | Esperado |
|---|---|---|---|
| A1 | Otro aviso alto/crítico falla | script contra informes sintéticos (alto, crítico, por cadena, mismo paquete picomatch con otro GHSA, origen desconocido) y contra el `npm audit` real con un informe inyectado | exit 1, aunque la GHSA permitida siga vigente |
| A2 | GHSA permitida antes de la fecha pasa | script real hoy y con `AUDIT_GATE_NOW` = 2026-12-01T00:00Z y T23:59:59Z | exit 0, «EXCEPCIÓN VIGENTE» |
| A3 | Después de la fecha falla | `AUDIT_GATE_NOW` = 2026-12-02T00:00:00Z y 2027-01-15 (fecha simulada, no se espera) | exit 1, «CADUCADA» |
| A4 | El bundle no lleva picomatch/fdir/tinyglobby/vite | `vite build` propio de la cabeza y búsqueda en todos los archivos de `dist/` (incl. mapas); además `npm ls --omit=dev` y `package.json` | 0 coincidencias en el bundle; vite solo en devDependencies |
| A5 | Cero cambios en `package*.json` | `git diff main...cabeza --stat` | ningún `package*.json` |
| A6 | Sin `\|\| true`, sin bajar el umbral general | lectura del diff del script y del `ci.yml`: sin `continue-on-error` en el paso, sin `--audit-level` más laxo, job `backend` intacto; excepción por GHSA y no por paquete | cumple |
| A7 | Falla cerrado si no se lee el JSON | script con `npm` ficticio en el PATH que devuelve texto, vacío, `{}`, `[]`, `{"error":…}`, y sin red/sin lockfile; `AUDIT_GATE_NOW` inválido | exit ≠ 0 en todos, nunca 0 |
| A8 | Mutaciones (4) | quitar la comparación de fecha, excepción por paquete en vez de GHSA, tratar informe ilegible como vacío, `HIGH` sin `critical` | la prueba del PR o mi guion detecta cada una |
| A9 | Regresión | `node --test test/audit-gate.test.mjs` (6/6), `npm test` del frontend, lint de los 2 archivos, CI 4/4 de la cabeza exacta (incluye el paso real en Ubuntu) | verde |

**Fuera de alcance / no verificable:** que picomatch no se explote en máquinas de desarrollo (riesgo aceptado y declarado en el PR); la renovación o retiro de la excepción (decisión de PO/Tech Lead antes del 2026-12-01); Windows frente a Ubuntu más allá de lo que muestre la CI.

**Criterio de salida:** A1–A7 cumplen y A8 detecta; cualquier ruta en que la puerta pase sin informe legible, o con un aviso alto/crítico distinto, o después de la fecha = CAMBIOS REQUERIDOS. Prioridad máxima: ejecuto en cuanto Infra apruebe este plan por escrito.

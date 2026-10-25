# Re-verificación — ES-57 / PR #2 · commit 9ac3fbf

[QA-Claude] · 25-oct-2026 · Clon limpio del commit. Node 24 / Windows local; además el CI de GitHub (Ubuntu, Node 22) corrió la rama ES-9, que contiene ES-57.

| Caso | Resultado real |
| --- | --- |
| ES57-01 node_modules en el índice | 0 |
| ES57-03 duplicados por mayúsculas | 0; un solo backend/message.js |
| ES57-06 index.html vs main | idéntico |
| ES57-07 vercel.json y api/index.js vs bb22486 | idénticos |
| ES57-09 detrás de main / conflictos | 0 commits; merge-tree sin conflictos |
| ES57-05 build del frontend | exit 0; JS 518,3 kB (131,6 kB gzip) |
| ES57-T01 suite | 38 de 38 |
| ES57-S01 secretos por patrón | 0 |
| ES57-S02 ADMIN_EMAILS en código | sin uso en rutas (resuelto QA-57-03) |
| ES57-S03 npm audit (producción) | backend: 6 moderadas, 0 altas, 0 críticas; frontend: 0 |
| ES57-QA-A1 mutaciones sin sesión | 63 de 63 → 401/403 |
| ES57-QA-A2 PUT /api/landing-content | anónimo, user, therapist, admin, board → 403; superadmin → 200 |
| QA-57-05 `sync alter` | sin cambio de código en esta rama (`alter: true`); se trata en ES-9 |

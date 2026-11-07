# Evidencia de ejecución — ES-57 / PR #2 (plan v2, PR #6)

[QA-Claude] · 23-oct-2026 · Commit probado: `d8533e6` · Clon limpio (worktree desprendido, sin cambios locales)
Entorno: Windows, Node 24.14.0 / npm 11.9.0 (el plan pedía Node 22 y Linux: **no se cumplió**). Sin DB real, sin Railway, sin Claude real. Datos sintéticos; no se leyó ningún `.env`.

| Caso | Comando / método | Resultado real |
| --- | --- | --- |
| ES57-01 | `git ls-tree -r d8533e6` buscando `node_modules/` | 0 archivos |
| ES57-02 | crear `node_modules/x`, `.env.local`, `supabase/.temp/x`, `dist/x` + `git check-ignore -v` | Los cuatro ignorados |
| ES57-03 | rutas en minúsculas duplicadas | 0 duplicados; un solo `backend/message.js` |
| ES57-04 | `grep` de requires + guarda | Ambos requires en minúscula; `listen` bajo `require.main === module` |
| ES57-05 | `npm ci` + build del frontend | Exit 0; JS 520,9 kB (132,3 kB gzip); aviso chunk > 500 kB |
| ES57-06 | `index.html` rama vs `main` | Idéntico |
| ES57-07 | `git diff bb22486 d8533e6 -- vercel.json api/index.js` | Diff vacío |
| ES57-09 | docs y commits | Rama 86 archivos de `docs/`, `main` 104; la rama va 5 commits por detrás de `main`; `git merge-tree` sin conflictos |
| ES57-T01 | `npm --prefix backend test` | 35 de 35 pasan, 0 fallos (Node 24, Windows) |
| ES57-S01 | patrón de secretos (solo archivo:línea) + nombres en `.env` versionado | 0 coincidencias; `frontend/.env.production` versionado con una variable (`VITE_API_URL`), valor no leído |
| ES57-S03 | `npm audit` | Backend prod: 19 (1 crítica, 7 altas, 10 moderadas, 1 baja). Frontend prod: 7 altas |
| ES57-QA-A1 | `qa/security/es57-anon-mutations.test.cjs` (63 mutaciones sondeadas sin sesión) | 62 devuelven 401/403; **1 no**: `PUT /api/landing-content` |
| ES57-QA-A2 | mismo script, matriz de roles | **500 para todos los roles, incluido superadmin**; 0 escrituras |
| ES57-14 | API de GitHub, solo lectura | `main` protegida; check requerido: `Vercel` |

Reproducir: `QA_SUT=<clon limpio> node --test qa/security/es57-anon-mutations.test.cjs`.

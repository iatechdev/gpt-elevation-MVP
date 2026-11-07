# Ejecución — ES-66 / PR #10 · commit 6cbb991

[QA-Claude] · 26-oct-2026 · Clon limpio. Express y JWT reales; DB y proveedores simulados (arnés de Dev). Datos sintéticos.

| Caso | Resultado real |
| --- | --- |
| Repo: backend `npm test` | 76 de 76; los 3 casos ES-66 de Dev: 3 de 3 |
| Tipos y build del frontend | exit 0; JS 520,32 kB (132,56 gzip); CSS 9,88 kB |
| `npm audit --omit=dev --audit-level=high` | backend y frontend: exit 0 |
| ES66-F01 catálogo | 23 claves, sin duplicados, ES y EN completos y ≤ 5000 caracteres |
| ES66-F02/F03 GET | Mezcla defaults con ediciones; el valor en blanco no pisa el default; con la base caída responde 200 con defaults |
| ES66-S01 PUT por rol | anónimo, user, therapist, admin, board → 403; token inválido → 401/403; superadmin → 200; 0 escrituras al denegar |
| ES66-S02 entradas inválidas | 14 casos (key/value/lang que no son texto, clave desconocida, 256 y 5001 caracteres, cuerpo vacío) → todos 400, 0 escrituras (la sospecha de un 500 **no se confirmó**) |
| ES66-S03 contenido hostil | HTML/script se guarda y devuelve como texto |
| ES66-P01 GET, 6 usuarios virtuales, 120 s | 134 724 peticiones, 0 errores; p50 4,3 ms, p95 9,6 ms, máx 217,5 ms (umbral propuesto p95 ≤ 300 ms) |
| ES66-C01 tono | 23 textos revisados: sin diagnóstico, prescripción ni promesa de empleo; incluyen avisos explícitos de no diagnóstico |
| F04 hook/resolver, F06 semilla | Código leído y pruebas de Dev reproducidas: sin mostrar el idioma anterior, respaldo ante red/JSON/blanco, semilla con guarda y transacción, segunda ejecución con 0 filas |

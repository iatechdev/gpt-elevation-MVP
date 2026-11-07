# ES-96 · PR #74 · head 112e99c · reverificación · QA-Claude
Merge local con main (limpio); Postgres 17 local; IA simulada; datos sintéticos.
- Backend 402/402; prueba Postgres del PR 13/13; CI verde.
- es96-real-db.mjs 33/33 (incluye las decisiones 1, 2 y 3 de Mauricio y el pool con 50 listas simultáneas).
- Pool: 12 y 20 lecturas simultáneas de personas autorizadas con el pool de 5: todas 200, máximo 154 y 297 ms (antes: 500/503 y hasta 68 s).
- Mutaciones: reasignar sin retirar (D2, D2b, D2c), desvincular sin retirar (D1, D1b, R2), agendar/iniciar/anotar sin autorización (D3), cierre siempre con IA (D3b): 4 de 4 detectadas.
- Regresión ES-93: 56/61, corrige 10 hallazgos y sin fallos nuevos (siguen F02b, F10e, S08b, S08c, S10b).
Pendiente de Mauricio: el cierre de una sesión en curso cuando la persona retiró la autorización (Dev lo cierra sin IA).
No verificado: interfaz (ES-100), Supabase real, staging, concurrencia con carga real.

# ES-85 · PR #60 · head 25c2825 · QA-Claude
Merge local con main (limpio); Postgres 17 local; roles de Supabase simulados; datos sintéticos; sin IA.
- npm test backend 388/388; prueba Postgres del PR 17/17; db:drift sin deriva.
- es85-real-db.mjs: 29/29 (migraciones up/down/up y guarda del down; privilegios del worker y del dueño; search_path; matriz de transiciones 42+12; 18 salidas hostiles; fencing, lease, intentos; consentimiento, versión vieja, eliminación, revocación concurrente; 60 reclamos simultáneos sobre 40 jobs; sin texto libre; p95 de worker_claim 1,0 ms con 1000 jobs).
- Mutaciones: sin REVOKE a roles Supabase (falla P04), sin comprobar citas (S01), sin disparador (T01, T02), worker con SELECT global (P01).
Observaciones: (1) worker_claim/publish tratan CUALQUIER fila de DeletionRequests como eliminación (sin mirar status); (2) el worker puede insertar en AiUsages (diseño); (3) CREATE ROLE y GRANT del propietario en Supabase real no verificados.
No verificado: Supabase real, staging, rendimiento con carga real.

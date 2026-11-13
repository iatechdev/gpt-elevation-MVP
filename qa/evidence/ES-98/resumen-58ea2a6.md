# ES-98 · PR #71 · head 58ea2a6 · QA-Claude
Merge local con main (limpio); Postgres 17 local; IA simulada; datos sintéticos.
- npm test backend 390/390; prueba Postgres del PR 9/9; db:drift sin deriva; CI verde.
- es98-real-db.mjs 27/27 (2 corridas): 180 llamadas con ids mal formados (15 variantes x 12 rutas) sin 5xx ni trazas y con 404 uniforme; tipo de nota; estado de sesión; cancelReason 255/256; duración; doble reserva (7 casos de borde exactos, misma persona con dos terapeutas, 20 altas simultáneas = 1); matching (inexistente, participante, admin, inactivo, cerrado, persona inactiva, terapeuta desactivado entre elección y confirmación, solicitud confirmada no se reabre); rating/avg solo admin; entradas maliciosas; alta de sesión p95 en rango.
- Regresión: ES-102 20/20, ES-105 7/7; ES-93 corrige F07d, F11c, F12b, S01b, S07e, S09c y no agrega fallos.
- Mutaciones 6/6 detectadas (ids, reglas de estado, choques, rating/avg, persona, terapeuta).
Observaciones: (1) elegir terapeuta antes de confirmar se puede cambiar (diseño); (2) 10 confirmaciones simultáneas de la misma solicitud devuelven 2xx las 10 (no atómico; efecto idempotente); (3) ES93-S08b/S10b/F02b/S11 siguen abiertos fuera de este PR.
No verificado: interfaz, Supabase real, staging.

# ES-107 · PR #81 · head 77c6e1b · QA-Claude
Merge local con main (limpio, d4cdd62); Postgres 17 local con bases desechables; 4 servidores reales con topes distintos; datos sintéticos.
- Backend 393/393; frontend 159/159, tsc, lint, build; prueba Postgres del PR 6/6; ES-95 pg 5/5; db:drift sin deriva; CI verde.
- es107-real-db.mjs 26/26 salvo T2b (hallazgo): PDF de 5 MB = PDF + 29 bytes, hash idéntico, sin texto en claro, IV distinto; alteraciones del cifrado fallan sin traza; 60 envíos con tope 5 = 5 + 55 503 sin cifras; migración de 4 filas sin pérdida, down/up, guarda del down, fila corrupta detiene sin destruir, base vacía.
- es107-ui.cjs 17/17: aviso con role=status, 320/375/768/1440 sin desborde, contraste, teclado, estados de error sin aviso falso, roles sin acceso, se recalcula al eliminar.
- Mutaciones: sin candado (T1, A2, T4, R2), sin tope de peso (T2), 503 con cifras (T6) detectadas; migración sin verificar huella NO detectada ni por mi script ni por la prueba del PR.
- Rendimiento: 20 envíos simultáneos de 5 MB: total 8,8–12,5 s (mediana 9,5 s; antes 17–22 s) con la máquina al 65–96 % de CPU por otros procesos.
Hallazgos: ES107-QA-01 (Medio) el tope de peso cuenta hojas ya rechazadas/aprobadas; ES107-QA-02 (Medio) con el formulario lleno, 201 para un correo repetido y 503 para uno nuevo revela quién ya tiene solicitud; ES107-QA-03 (Bajo) una migración fallida deja la columna `data` y no se puede reintentar; ES107-QA-04 (Bajo) descarga con datos alterados devuelve 500; ES107-QA-05 (Bajo) la verificación de huella de la migración no tiene prueba.
No verificado: lector de pantalla real, Supabase real, staging, volúmenes mayores.

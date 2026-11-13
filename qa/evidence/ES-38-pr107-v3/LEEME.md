# ES-38 · PR #107 head 3441b7dea29ba130ded357f7334377a7f3b8b3e6 (QA-Claude, 1-nov-2026)
Merge local sobre main 645d6dda; Postgres real; Chromium; datos sintéticos; 0 tokens de IA. Front 319/319, eslint y build sin errores.
- `salida-es38-3.txt`: `qa/integration/es38-v3.cjs`, 88/93. Los 5 fallos son idénticos a los de la ronda aprobada (F10 «primer Tab» a 375 px ×4 y «S1 admin abre /admin/users»); sin fallos nuevos. En v3 se cambió `networkidle` por `load` desde S1b (ver abajo).
- `registro/`, `salida-registro.txt`: `qa/integration/es107-registro-es128.cjs`, 32/32 (política nueva de ES-128 en el registro, ES/EN, 320 y 1440 px).
- `salida-es38.txt`, `salida-es38-2.txt`: corridas con el script original; se cortan en S1b por el motivo siguiente.
- Hallazgo informativo sobre **main** (reproducido en main 645d6dda sin #107): con un token de persona y el rol «admin/superadmin» falsificado en el navegador, `/admin/users` responde 403 en 17 ms pero tres peticiones `/api/admin/*` no se dan por terminadas en Chromium y la página nunca llega a «red inactiva». No hay fuga de datos (0 usuarios). Con rol «user» sí termina.

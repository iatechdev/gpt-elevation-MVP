# Rendimiento en ejecución de las listas de administración — noviembre 2026 (ES-199 · PERF-05, parte administración)

Medición con `frontend/scripts/perf-admin.cjs`: build de producción servido en local, CPU ×4, 390 px (tarjetas) y 1360 px (tabla), español, cuentas SINTÉTICAS, API simulada, mediana de 3 corridas. Pantalla medida: `/admin/users`, pestaña «Personas» (la lista más grande de administración: las colas de emparejamientos y de planes son listas de solicitudes pendientes y vienen acotadas por el servidor).

## 1. Hallazgo

1. `GET /api/admin/usuarios` **no pagina**: devuelve todas las cuentas (y hace 3 consultas por cuenta en el servidor, N+1). El piloto tiene 6 personas, pero la pantalla pinta todas. Esto es del servidor, fuera del alcance de este ticket (frontend): se propone un ticket aparte (paginar y agregar las consultas).
2. Perfil (CDP, 200 cuentas, quitar un filtro, CPU ×4): `toLocaleDateString` creaba un formateador de fechas en cada fila (dos veces por cuenta: tabla y tarjetas) = **421 ms de JS** de ~2,5 s; el resto es DOM y diseño del navegador (crear ~400 filas con chips y botones).
3. Abrir «Gestionar» volvía a pintar toda la lista (el estado del diálogo vive en el padre y `useAdminList` devolvía un objeto nuevo en cada render). Con memoización: JS total de la interacción 505 → 384 ms (200 cuentas, una corrida de perfil; modesto).

## 2. Correcciones (solo donde la medición las justifica)

- `adminUsersLogic.ts`: `formatAltaDate` con un `Intl.DateTimeFormat` por idioma (mismo resultado que `toLocaleDateString` con las mismas opciones; prueba con es-CO y en-US y fechas de borde).
- `AdminUsersPeople.tsx`: `PeoplePanel` en `memo`. `AdminUsers.tsx`: `onManage` estable (`useCallback`). `adminUsersApi.ts`: `useAdminList` devuelve un objeto estable (`useMemo`).

Sin cambio de marcado, de textos ni de diseño (exento de la puerta de diseño).

## 3. Antes y después (CPU ×4, mediana de 3, ms; equipo cargado: ±30 % de ruido)

| Ancho | Cuentas | Pintar lista | Filtro de rol | Filtro de estado | Quitar filtro | Abrir «Gestionar» |
| --- | --- | --- | --- | --- | --- | --- |
| 390 | 30 | 4 135 → 3 508 | 485 → 383 | 364 → 363 | 718 → 564 | 1 482 → 1 310 |
| 390 | 200 | 7 455 → 6 287 | 975 → 897 | 720 → 547 | 2 415 → 2 116 | 3 461 → 2 482 |
| 390 | 500 | 13 062 → 11 411 | 2 110 → 1 546 | 963 → 684 | 6 313 → 6 149 | 6 633 → 4 650 |
| 1360 | 30 | 4 320 → 4 076 | 490 → 410 | 252 → 185 | 718 → 388 | 1 114 → 819 |
| 1360 | 200 | 7 714 → 5 981 | 1 288 → 1 096 | 792 → 561 | 2 677 → 2 230 | 3 529 → 2 537 |
| 1360 | 500 | 12 296 → 8 567 | 1 900 → 1 283 | 1 101 → 872 | 6 949 → 4 000 | 6 100 → 3 809 |

Mejora de ~10–40 %, no de órdenes de magnitud: lo que queda es DOM y diseño nativos del navegador (≈ 7–12 ms por cuenta a CPU ×4).

## 4. Lo que NO se hizo y por qué

- **Paginar o virtualizar la lista**: no se justifica con el piloto (6 cuentas: ~0,4 s a CPU ×4) y cambia lo que ve la persona (puerta de diseño) y la navegación por teclado/lector. La solución de fondo es paginar en el servidor (ticket aparte propuesto, backend).
- **Dibujar solo la tabla o solo las tarjetas según el ancho**: ahorraría la mitad del DOM, pero cambia la estructura que prueban otras pruebas y la accesibilidad; no se hizo sin medir su efecto real (los `display: none` no pagan diseño).
- **Colas de emparejamientos y de planes, auditoría, métricas**: listas de pendientes/entradas con límite del servidor (30, 50, 100); no se perfilaron con datos máximos (no verificado).

## 5. Limitaciones

Servidor sintético, localhost, un equipo cargado, solo Chromium, CPU ×4 simulada; sin INP real ni Firefox/Safari ni dispositivos reales.

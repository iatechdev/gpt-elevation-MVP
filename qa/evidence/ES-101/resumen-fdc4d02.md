# ES-101 · PR #72 · el terapeuta no accede a personas con eliminación aceptada o cuenta inactiva (ES93-A1) · head fdc4d02

[QA-Claude] · 28/29-oct-2026. Merge local con main 6af605f, Postgres 17 real, servidor del merge (DATA_RIGHTS_ENABLED=true), IA simulada, datos sintéticos.

| Bloque | Resultado |
|---|---|
| backend `npm test` / audit alto / CI | 342/342 / exit 0 / verde |
| Pruebas Postgres de Dev (`test:therapist-deletion:pg`, con `ES101_TEST_DATABASE_URL`) | 6/6 |
| Mutación (revertir los cambios de las rutas) | 6 de las 7 pruebas simuladas del PR fallan (1 pasa) |
| Mis casos con Postgres real (`es101-real-db.mjs`, `run3-fdc4d02.jsonl`) | 17/17 (dos corridas previas con falsos fallos míos: patrón de id y nombre parcial) |
| Regresión ES-93 (mis dos scripts) | solo cambia ES93-S07e (de fallo a correcto); el resto igual. ES93-S07f sigue fallando porque el purgado es manual (declarado). |
| ES-18/19 | 20/20 |

Verificado: eliminación aceptada → 404 en historial, historia, resumen IA, crear y editar nota, sesiones (editar, notas leer y escribir, iniciar, terminar), agendar 403, y la persona desaparece de lista, alertas, sesiones y próximas; cuenta inactiva por la API de administración o por SQL → igual, y reactivar restablece; el tombstone bloquea aunque `active=true`; solicitud desaparecida (cancelada por un operador) → acceso restablecido; registro de eliminaciones caído → 503 en las 10 rutas probadas, sin datos y sin conceder; terapeuta B y su persona sin cambios y A sin acceso a la de B; concurrencia: 117 peticiones, 0 escrituras tras el bloqueo y 0 5xx; 404 idéntico al de una persona ajena y sin nombres ni datos en cuerpo ni registros; rendimiento con 50 pacientes: lista 137 ms, alertas 91 ms, historia 27 ms (umbrales 500/500/300), 60 simultáneas sin 5xx.

Observaciones: (1) no existe API para cancelar la solicitud de eliminación; «cancelada» solo se probó borrando la fila (operador); (2) el lado de la persona no cambia (mi-terapeuta 200; unirse 401 por token de la persona con eliminación aceptada); (3) el purgado sigue manual: los datos permanecen en la base hasta ese paso (ES93-S07f).
No verificado: staging y el purgado real.

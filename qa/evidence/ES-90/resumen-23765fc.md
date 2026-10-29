# ES-90 · PR #62 · panel «Pendientes de contenido» y textos provisionales · head 23765fc (apilado sobre #52 2fd0796)

[QA-Claude] · 28-oct-2026. Merge local sobre main cdcd065 (contiene #55), Postgres 17 real, servidor del merge sirviendo el frontend, Chromium. Datos sintéticos; sin IA.

| Bloque | Resultado |
|---|---|
| lint / tipos / frontend / backend / audit / build | 0 avisos / ok / 91/91 / 326/326 / 0 (backend alto exit 0) / ok |
| API con Postgres real (`es90-real-db.mjs`) | 20/20 (`api-23765fc.jsonl`) |
| Mutación (volver a poner un `[…]` en el catálogo) | las pruebas del PR fallan: backend 2 de 3, frontend 3 de 6 |
| Interfaz con superadmin real (`es90-ui-real.cjs`) | 21/23; las 2 fallas son Bajas (R02 contraste, R03 alto del botón) |
| Script de Dev (`es90-browser.cjs`) | 5/5 |
| Regresión sobre #52 | S7 14/14, S9 12/14 (conocidas), S13 14/14, chips 10/10, CMS 8/8, es68 25/28 (3 falsas alarmas conocidas), ES-18/19 20/20, navegador es74 23/23 |

Hallazgos (sin Críticos ni Altos):
- ES90-O1 (Bajo): «Listo» se calcula en el cliente comparando exacto con el provisional: «EN PILOTO» o «en piloto» cuentan como Listo (con espacios sobrantes sí queda Pendiente).
- ES90-O2 (Bajo): el panel lo ve también el administrador (la pestaña Landing ya era visible para él); al guardar, el servidor responde «Acceso exclusivo para superadmin.» y no cambia nada. El PR dice «solo superadmin»: la restricción es del servidor, no de la pantalla.
- ES90-O3 (Bajo): los 5 campos nuevos usan el estilo compartido con `outline: none` y sin otro indicador: no hay foco visible al navegar con teclado (los botones sí).
- ES90-O4 (Bajo): contraste de la línea «N pendientes · N listos» 4,33:1 (12 px) y del botón Guardar 4,46:1 (13 px) frente a 4,5:1; el alto de Guardar es 39 px (< 44). Estilos compartidos del backoffice.
- ES90-O5 (informativo): un superadmin puede guardar «[…]» por el PUT y el GET público lo devuelve; el panel lo marca Pendiente. La frase «el GET público no puede traer […]» vale para el catálogo por defecto.

No verificado: un superadmin real contra el backend desplegado (staging), los datos reales pendientes del PO, el panel en inglés (no existe).

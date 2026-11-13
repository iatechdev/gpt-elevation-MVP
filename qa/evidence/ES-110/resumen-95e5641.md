# ES-110 · PR #91 · head 95e5641 · QA-Claude
Merge local con main (limpio; incluye el código de #89); Postgres 17 local; IA simulada; datos sintéticos; Chromium real.
- Backend 443/443; frontend 176/176, tsc, lint, build; prueba Postgres del PR 8/8; ES-27 7/7, ES-28 5/5, ES-29 8/8 (una corrida 6/2 y tres limpias después), ES-23 12/12, ES-109 8/8; db:drift sin deriva; npm audit sin altos; CI verde.
- es110-real-db.mjs 26/26: borradores sin nivel y sin evaluaciones, el Skill Map no cambia, clasificación contra el catálogo vigente, aislamiento A/B, origen no falsificable y conservado al editar, para revisión al borrar/retirar, 8 promociones simultáneas = 1 evidencia, requestId idempotente, 12 formas hostiles, pool de 5, registros limpios.
- Mutaciones 6/6: ver evidencia ajena, borrador que nace confirmado, editar pierde el origen, sin bloqueo por persona, sin «para revisión», permitir sin clasificar.
- es110-ui.cjs 19/21: ninguna casilla marcada, diálogo con role=dialog y aria-modal, «Nivel: sin definir», cuerpo de la petición solo requestId+names, ES/EN, 320-1440 px, contraste, teclado, origen propio, estados vacío y error, borrar.
- FALLA E2c (A11Y): el foco NO queda atrapado en el diálogo modal: con Tab sale al resto de la página. Esc sí cierra y devuelve el foco.
- E4b: la medición automática de la distinción por forma no la logró mi script; la captura (bandeja-320.png) muestra «Declarada» con borde punteado y «Respaldada con evidencia» con relleno y marca.
Observaciones: casillas de 22x22 px; fecha ISO sin formato en la tarjeta de «Mis evidencias»; A2 no es sensible a mutación (confirmar sin evaluaciones no cambia el mapa).
No verificado: IA real, lector de pantalla, otros navegadores, Supabase real, staging.

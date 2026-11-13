# ES-122 · PR #101 · head 99d7ef434b088475f33c690a2c63348d003c48e1 — evidencia [QA-Claude]
Entorno: merge local con main, Postgres embebido (qa101), servidor real, Chromium; datos sintéticos. Frontend 195/195, tsc, lint y build limpios.
- `ui-99d7ef4.jsonl`: es122-ui.cjs, 18 correctas, 0 fallos (+2 observaciones).
- Conversión verificada sobre lo GUARDADO en el servidor: 7,5→450; 7.5→450; 10→600; 0→0; 168→10 080; 0,5→30; 1,25→75; 1.67→100; 0,01→1; vacío→null.
- 19 entradas inválidas u hostiles: no se envía nada, `aria-invalid` con mensaje asociado, guardado intacto, sin scripts.
- Lo ya guardado: 10 valores (100, 2400, 7, 59, 10 079…) se muestran en horas y guardar sin tocar conserva los minutos exactos; 71 valores más por la interfaz sin deriva. Verificación exhaustiva aparte: los 10 081 valores posibles de minutos (0 a 10 080) hacen ida y vuelta minutos→texto→minutos sin cambio.
- Plan de carrera (`careerPlanContracts.getContext`, ES-33) recibe weeklyMinutes=450 tras escribir 7,5 h. El servidor sigue rechazando 10 081, −1, 1,5, texto, objeto y 1e21. El análisis de la hoja de vida excluye explícitamente este campo.
- 320–1440 px sin desborde, campo ≥ 44 px, contraste AA, teclado, ES/EN, resto del formulario intacto. Mutaciones: 4/4 detectadas por las pruebas del PR (sin tope 168, factor ×100, mostrar minutos, sin formato).
## Observaciones (Bajas, no bloquean)
| ID | Qué pasa |
|---|---|
| ES122-QA-01 | El texto de error del campo es genérico («Introduce un valor válido dentro del límite indicado.»): no repite «horas» ni «0 a 168» (la ayuda debajo sí) y no tiene `role`. |
| ES122-QA-02 | Se rechazan «.5», «,5» y «7,» (sin dígito antes o después de la coma): válido por diseño, pero una persona puede escribir «,5». |
| ES122-QA-03 | Minutos que no son múltiplos de 6 se muestran redondeados a 2 decimales (declarado por Dev): solo presentación, sin cambiar lo guardado. |
## No verificado
Teclados móviles reales, lectores de pantalla, producción. El script es14-browser.cjs de Dev ya no corre en main (no es de este PR).

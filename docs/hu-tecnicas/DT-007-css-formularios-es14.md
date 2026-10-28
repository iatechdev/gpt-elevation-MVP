# DT-007 — Peso del CSS de los formularios de ES-14 (QA-14-02)

> Estado: **aceptada como deuda técnica** · Origen: hallazgo QA-14-02 del PR #32 (ES-14)
> Decisión: Mauricio Roldán, 28-oct-2026. Revisión: después del piloto (fecha por fijar)

---

## Qué pasó

Los formularios de ES-14 (contexto del participante) usan componentes de daisyUI con el prefijo `elv-`. QA midió que eso aumenta el CSS de la app en **+80 %** (QA-14-02, Medio).

Medición del equipo de desarrollo, por componente (kB, aproximado, sobre el CSS compilado):

| Componente | kB |
| --- | --- |
| input | 6,7 |
| select | 8,5 |
| textarea | 3,4 |
| radio | 2,3 |
| fieldset | 0,13 |
| **Total** | **≈ 21** |

El +80 % es la cifra de QA; el equipo no la recalculó. Los kB son de una medición puntual y deben repetirse antes de actuar.

## Decisión

Se **acepta** el costo en ES-14 y se publica #32 tal como está. Motivos: el piloto es de seis personas, el costo absoluto es bajo, y rehacer los formularios obliga a volver a presentar el diseño (puerta de diseño), repetir la revisión visual y de navegador de QA, y no hay tiempo antes de la entrega.

## La deuda

- **Alternativa medida:** CSS local solo para los controles que usa ES-14 → ≈ **18 kB menos** que hoy.
- **Qué hay que hacer cuando se retome:**
  1. Volver a medir el peso del CSS de toda la app (antes/después) para confirmar la cifra.
  2. Decidir si conviene una solución para todo el producto (por ejemplo, importar solo los componentes de daisyUI que se usan) en lugar de solo ES-14.
  3. Si cambia el aspecto o el flujo de algún formulario, presentar el diseño y esperar aprobación de Mauricio o Alejo antes de codificar.
  4. Repetir con QA las pruebas visuales, de teclado y responsive de las pantallas afectadas, en ES y EN.
- **Criterio para retomarla antes:** si el peso total de la app llega a ser un problema de carga para las personas del piloto (no verificado hoy), o si otra pantalla suma más CSS de daisyUI.
- **Riesgo de dejarla:** carga inicial algo mayor en conexiones lentas; no afecta a la privacidad, la seguridad ni el comportamiento.

## No verificado

- El impacto real en tiempos de carga para las personas del piloto.
- Si la cifra de +80 % se mantiene con las demás pantallas ya fusionadas en `main`.

## Referencias

- Ticket de seguimiento en Jira: **ES-83**.

- PR #32 (ES-14), hallazgo QA-14-02 y la medición publicada en el comentario del PR.
- Contrato de ES-14: `docs/elevation-skillmap/25-CONTEXTO-PARTICIPANTE.md`.

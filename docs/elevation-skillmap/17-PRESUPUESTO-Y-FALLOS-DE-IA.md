# ES-22 · Presupuesto, fallos y reintentos de IA

26-oct-2026 · Dev-Claude · Cubre SP2-HU18 (RF-13, V-12, V-13). Implementación en la rama de ES-22 (apilada sobre ES-21).

## 1. Qué decide y qué NO decide este documento

- **V-12 (presupuesto de IA) sigue «por definir»**: no hay montos, moneda ni periodo acordados. **No se inventan topes ni tarifas.** El presupuesto se mide en **tokens**, por persona y para toda la cohorte (el despliegue), y los valores los carga Mauricio/Infra como variables de entorno.
- **Sin configuración las llamadas se rechazan** (no se interpreta la ausencia de montos como ilimitado). Esto afecta a **todo entorno donde se despliegue este código, incluido el staging**: hasta que existan las variables, el chat responde 503.
- **Los precios en dinero** viven en `backend/config/aiPricing.json`, que **sale vacío**. Un costo solo se registra si hay una entrada completa (modelo, versión, moneda, precios por millón de tokens, fuente, verificador y fecha). Sin ella el costo queda como desconocido.

## 2. Variables de entorno (nombres; los valores los carga Mauricio/Infra)

| Variable | Uso |
| --- | --- |
| `AI_BUDGET_TOKENS_PER_USER` | **Obligatoria.** Tope de tokens por persona y periodo. Sin ella, todas las llamadas se rechazan |
| `AI_BUDGET_TOKENS_COHORT` | Opcional. Tope de tokens de toda la cohorte por periodo. **Sin ella no hay tope de cohorte**: definirla es una decisión explícita |
| `AI_BUDGET_PERIOD` | `day`, `week` (lunes UTC) o `month` (por defecto) |
| `AI_CALL_TIMEOUT_MS` | Tiempo de espera por llamada, de 1.000 a 120.000 (por defecto 45.000) |
| `AI_MAX_RETRIES` | Reintentos del SDK por llamada, de 0 a 2 (por defecto 1) |

## 3. Cómo funciona

1. **Reserva atómica previa.** Antes de cada llamada se reservan tokens estimados (caracteres/3 + `max_tokens`, una heurística conservadora, no una tarifa) bajo bloqueo de fila, primero en el contador de la cohorte y después en el de la persona (mismo orden: sin interbloqueos). Si no cabe, no se llama al proveedor.
2. **Ajuste al uso real.** Al terminar se reemplaza la reserva por el uso informado por el proveedor; si el proveedor no informa el uso, la reserva completa se da por consumida. Si la llamada falla, la reserva se libera.
3. **Agotar el límite (V-13).** No se llama al proveedor, el último turno válido y los avances quedan intactos, se responde 429 `ai_budget_exhausted` con `reply` (el contrato que lee la interfaz), `scope` (`person` o `cohort`) y `resetsAt`. **No se amplía solo**: seguir bloqueado hasta el siguiente periodo o hasta que alguien cambie la configuración; con el mismo `requestId` se retoma sin duplicar.
4. **Las respuestas de seguridad (ES-21) no consumen presupuesto**: no usan el proveedor y siguen funcionando con el límite agotado.
5. **Tiempo de espera y reintentos acotados** por llamada, con límites duros. La recuperación tras un reinicio usa el estado de `ChatTurns` (ES-20): un turno pendiente vencido se puede reintentar sin duplicar.
6. **Registro de uso (`AiUsages`).** Una fila por llamada: tipo, modelo, versión de la aplicación (commit), tokens, latencia, código de error clasificado y costo si hay precio. **Nunca guarda mensajes, prompts ni respuestas**, ni el texto de error del proveedor.
7. **Esquemas de salida.** Recomendaciones: arreglo de 1 a 3 elementos con categoría permitida y texto de hasta 500 caracteres. Matching: hasta 3 elementos, solo terapeutas ofrecidos, puntuación entera de 1 a 10 y razón de hasta 300 caracteres. Una salida inválida se rechaza (502 `invalid_model_output`) sin guardar nada.
8. **Secretos.** Antes de enviar texto al proveedor se enmascaran claves, tokens, JWT y cadenas de conexión (`[secreto omitido]`) en el mensaje, el historial y el diario elegido. Lo que la persona escribió se conserva tal cual en su propio historial.

## 4. API

| Ruta | Quién | Respuesta |
| --- | --- | --- |
| `GET /api/ai/usage` | La persona autenticada | `{ configured, period, periodKey, limit, used, remaining, resetsAt }` (sin datos de la cohorte) |
| `GET /api/superadmin/ai-usage` | Solo superadmin | Resumen agregado del periodo: llamadas, personas (solo la cantidad), estados, errores, tokens, latencia media, versiones, modelos y costo por moneda. **Sin contenido ni identificadores de personas** |

Errores de las llamadas de IA (chat, recomendaciones, matching): 429 `ai_budget_exhausted`, 503 `ai_budget_not_configured`, 502 `provider_unavailable` (reintentable) o 502 `invalid_model_output`.

## 5. Datos nuevos (creados por `sync()`, sin migración)

`AiBudgetCounters` (único por `UserId + periodKey`; `UserId = 0` es la cohorte) y `AiUsages`. Reversión: el código anterior las ignora y vuelve a llamar sin tope; las tablas no se borran.

## 6. Qué no cubre este ticket

- **Llamadas que siguen fuera del control:** el resumen del terapeuta (`resumen-ia`, ES-78) y la recomendación de fin de sesión (ES-79) están en ramas aún sin fusionar; pasarán por `callClaude` cuando se fusionen. Hoy esas dos rutas llaman al proveedor sin presupuesto.
- Valores de presupuesto y precios (decisiones de Alejo/Mauricio, V-12), un panel para cambiarlos sin redesplegar, avisos a la persona antes de agotar el límite, cobros del proveedor por llamadas duplicadas (no se promete evitarlos), y la prueba con Postgres real (la reserva se probó con exclusión mutua por fila simulada).
- La cohorte es una sola fila por periodo: serializa todas las reservas; suficiente para seis personas, no para escalar.

## 7. Cómo calcular los topes con datos reales (fórmula; los valores los decide Alejo/Mauricio)

No se proponen montos. Los topes salen de tres datos que hoy no existen y de un margen que se decide:

| Dato | De dónde sale |
| --- | --- |
| `T` = tokens por turno de chat (entrada + salida) | Medido: `GET /api/superadmin/ai-usage` da tokens y llamadas del periodo (`T = (entrada + salida) / llamadas`) |
| `N` = turnos esperados por persona y periodo | Decisión de producto (diseño del piloto: sesiones por semana × turnos por sesión) |
| `P` = personas del piloto | Seis (PRD) |

- **Tope por persona** = `N × T × (1 + margen)`. Conviene fijar `margen` después de ver la dispersión: partir del uso de las personas más activas del periodo de medición, no del promedio.
- **Tope de cohorte** = `P × tope por persona × factor de simultaneidad` (≤ 1; con 1 la cohorte nunca bloquea antes que las personas). Si se quiere un techo global de gasto, se fija directamente desde el costo (abajo).
- **Costo** = `entrada × precio de entrada + salida × precio de salida`, con precios verificados en `aiPricing.json`. Un techo de gasto en dinero `G` implica un tope de tokens de cohorte ≈ `G / costo medio por token`.
- **Periodo:** el que coincida con cómo se quiere controlar el gasto (`week` o `month`).

**Cómo medir sin inventar:** (1) fijar topes provisionales holgados en un entorno de pruebas con datos sintéticos, (2) ejecutar el guion de humo y las pruebas del piloto guiado, (3) leer `T`, la dispersión y el uso de las personas más activas en el resumen de superadmin, (4) fijar los topes definitivos y anotar quién los aprobó y la fecha. Con personas reales, los topes de partida los aprueba Alejo/Mauricio y se revisan tras la primera semana.

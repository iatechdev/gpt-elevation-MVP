# Verificación de los documentos legales contra el código (ES-335)

> **BORRADOR SIN REVISIÓN LEGAL.** Cada afirmación factual de `es/` y `en/` sale de aquí. «Verificado» = leído en el código o en un contrato del repo el 18-nov-2026 (rama `main` en `4a414957`); **no** significa probado en un entorno desplegado. Lo que no se pudo comprobar está al final y en `POR-COMPLETAR.md`.

## Afirmaciones verificadas

| Afirmación en los documentos | Fuente en el repo |
| --- | --- |
| La contraseña se guarda con hash (bcrypt), nunca en claro | `backend/routes/auth.js` (`bcryptjs`) |
| Las sesiones caducan a las 8 horas; se pueden cerrar en todos los dispositivos | `backend/utils/sessions.js:13` (`SESSION_TTL = '8h'`); `backend/routes/session.js` (`/logout-all`) |
| El enlace de restablecer contraseña es de un solo uso y caduca a los 30 minutos por defecto | `backend/routes/passwordReset.js:23` (`PASSWORD_RESET_TTL_MINUTES`, por defecto 30) |
| Los enlaces firmados de archivos duran 15 minutos por defecto; almacenamiento privado | `backend/utils/storage.js` (`DEFAULT_TTL_SECONDS = 900`, bucket privado de Supabase Storage) |
| Bloqueo temporal tras intentos fallidos; administración ve nombre, correo, rol, estado, plan, intentos y bloqueo | `backend/routes/adminUsers.js:67` (atributos); campos `loginAttempts`, `lockedUntil` |
| La aceptación guarda versión y fecha desde el servidor (`2026-11-v1`) | `backend/utils/terms.js`; `frontend/src/legal/version.ts` |
| El chat envía al modelo los últimos 20 mensajes y las entradas de diario que la persona elige; no envía nombre ni correo | `backend/routes/chat.js:31` (`HISTORY_LIMIT = 20`), `:223-228` (entradas elegidas), `:200-262` (composición del prompt) |
| Se enmascaran claves, tokens y cadenas de conexión antes de enviar | `backend/utils/promptSafety.js:24-34` (`SECRET_PATTERNS`, `redactSecrets`) |
| Un turno con indicio grave de crisis no se envía al modelo ni se reenvía después | `backend/routes/chat.js` (ES-298); `docs/elevation-skillmap/16-LIMITES-Y-FRONTERA-PRIVADA.md` §2 y §5 |
| El nivel de riesgo no se guarda, no se registra y no llega a terceros; sin alertas automáticas | contrato 16 §5 |
| No se publican líneas de ayuda sin verificar (registro vacío a propósito) | contrato 16 §4 (`backend/config/supportResources.json`) |
| El asistente se identifica como IA; sin diagnóstico, prescripción, promesas de empleo ni puntuaciones de salud mental o empleabilidad | `backend/utils/promptSafety.js` (`COMPANION_LIMITS`) |
| El detector tiene límites conocidos (falsos positivos y negativos) | contrato 16 §3 |
| Propósitos de consentimiento y su independencia; historial; versión y fecha | `backend/utils/consent.js:11-29`; contrato 14 |
| `therapist_sharing` ligado al profesional (`therapist-<id>`); `professional_review` al revisor (`reviewer-<id>`) | `backend/utils/consent.js:30-36` |
| El profesional asignado ve correo, ánimo y valoraciones, no chats, diario ni mapa | `frontend/src/i18n/therapistCopy.ts:239` (`mt_share_desc`) |
| Puente profesional: máximo 12 textos y 3 por categoría; cada lectura se registra sin texto ni huella | `frontend/src/bridge/copy.ts` (`limitTotal`, `limitKey`); contrato 18 (`BridgeTransfers`) |
| Lectura por IA: hasta 20 mensajes, hasta 10 entradas de diario, hoja de vida sin datos de contacto; textos de riesgo se saltan; nada llega al profesional | `frontend/src/bridge/copy.ts:86-95` (`dlg_*`) |
| Cifrado a nivel de aplicación de mensajes, diario, contexto, evidencias, hojas de vida | `backend/routes/chat.js`, `diary.js`, `participantContext.js`; `backend/utils/evidence.js`, `careerContext.js`; migración `20261030000000-es107-cv-binary.js` (uso de `encriptar`) |
| «Tu opinión»: texto aprobado, agregados solo con 5 o más personas, retirar el permiso no borra, «Retirar mi respuesta» borra | `frontend/src/pilot/copy.ts` (`grant*`); `frontend/test/es-173-permiso-texto.test.mjs`; `backend/routes/pilotFeedback.js` |
| Claves del navegador (localStorage/sessionStorage) y su vida útil | `frontend/src/access/signOut.ts`, `returnTo.ts`, `space/pending.ts`, `space/pause.ts`, `space/chatKeys.ts`, `cartografia/themeState.ts`, `pages/ChatPage.tsx` |
| Sin cookies propias; formularios públicos sin almacenamiento en el navegador | búsqueda de `document.cookie`/`cookie` en `frontend/src` y `backend` (solo comentarios que dicen «ni cookies») |
| Purga al eliminar una persona: qué se borra, qué se conserva (notas del profesional), lápida sin nombre ni correo, aceptación de términos a NULL | `backend/utils/personalData.js` (`CORE`, `RETAINED`, `SESSION_PERSON_FIELDS`); `backend/utils/deletionProcessor.js:45` (`termsVersion: null, acceptedAt: null`); contrato 18 (matriz de datos, ES-274, ES-293) |
| El texto libre de las notas conservadas no se puede depurar; no se afirma anonimización | contrato 18 (decisión ES-274) |
| Exportación y eliminación detrás de `DATA_RIGHTS_ENABLED`; sin plazos verificados (`deadlinesVerified: false`) | `backend/routes/dataRights.js:27`; contrato 18 |
| Hoy no hay pago en línea | `frontend/src/access/accessCopy.ts:9` (`access.no_payment`) |
| Almacenamiento de archivos en Supabase Storage (bucket privado) | `backend/utils/storage.js` |
| Proveedor de IA: Anthropic (modelo Claude) | `backend/utils/anthropic.js`, dependencia `@anthropic-ai/sdk` |
| Solicitud de profesional minimizada al purgar (solo estado y fechas) | contrato 18 (ES-293) |

## Discrepancias encontradas (no se tocó el producto)

1. **Aviso vigente vs. código (IA):** `/privacidad` dice que la IA «solo ve tus evidencias confirmadas, no tu diario, tu ánimo ni tus conversaciones» (`frontend/src/legal/legalCopy.ts:29`). El chat envía al modelo mensajes recientes y las entradas de diario elegidas; los permisos `insights_*` leen chat, diario y hoja de vida. El borrador lo describe con exactitud. Ver Q10 en `PREGUNTAS-ABOGADO.md`.
2. **Página antigua `/privacy`:** `frontend/public/privacy/index.html` es la política del producto anterior («Integración con ChatGPT») y carga Google Fonts. Ver Q11.
3. **`resume_ai_reading`:** el comentario del código dice que retirarlo borra las hojas de vida; el texto de la interfaz dice que no. Ver VF-14.
4. **`facilitator_sharing`, `research`, `notifications`:** el contrato los define; no se encontró en esta revisión una función de producción que consuma `facilitator_sharing` ni `research`. Ver VF-06, VF-12, VF-15.

## No verificado (y por qué)

- Cualquier comportamiento **en un entorno desplegado** (cookies, cabeceras, proveedor real, país de alojamiento): solo se leyó el código. (VF-01, VF-03, VF-09, VF-10)
- Contratos y condiciones de los proveedores (no entrenamiento, retención, país): no hay acceso a ellos desde el repo. (VF-02, VF-03)
- Plazos de supresión en proveedores y copias de seguridad. (PC-13)
- Si el nombre y el correo se cifran en reposo (se asume que no). (VF-04)
- El estado de `DATA_RIGHTS_ENABLED` en producción y el aprovisionamiento del registro de borrados independiente del respaldo. (VF-17, VF-18)
- Que el módulo de terapeutas cumpla obligaciones legales propias de registros de salud: es pregunta para el abogado (Q13).
- Ninguna afirmación legal (marco aplicable, plazos de ley, bases de licitud) está verificada: es trabajo del abogado.

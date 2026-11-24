# ES-148 · Inventario de pantallas y plan de entrega a desarrollo

*[UX-Claude] · 6-nov-2026 · Borrador para aprobación de Mauricio y Alejo. Fuente: rutas de `frontend/src/App.tsx` en esta rama. Color de marca decidido: azul tinta (#1D4F91 claro, #7FB0E8 oscuro); el rojo queda solo para errores.*

## 1. Dónde estamos

Hay 9 pantallas diseñadas en [cartografia-v2](cartografia-v2/index.html) (portada, registro, entrar, recuperar, mapa, evidencias, conversación, planes, estados) y un [manual de voz](VOZ-ELEVATION.md). Las rutas reales del frontend son unas 50. **No hay todavía un diseño de toda la plataforma ni un paquete que un desarrollador pueda implementar sin preguntar.**

## 2. Rutas reales y su cobertura

| Familia | Rutas (App.tsx) | Diseñado hoy |
|---|---|---|
| Público (6) | `/`, `/login`, `/forgot-password`, `/reset-password`, `/profesionales`, `/pricing` | Portada, entrar, recuperar y planes (prototipo). Faltan: restablecer contraseña, solicitud de profesionales. El registro no tiene ruta propia hoy. |
| Persona usuaria (30) | `onboarding`, `dashboard`, `chat`, `checkin`, `skill-map`, `evidence` (lista, nueva, detalle, editar, habilidades de la hoja de vida), `context/resumes`, `diary` (lista, nuevo, detalle), `exercises`, `space/tools`, `compass`, `next-step` (rutas, experimentos, experimento, plan), `route-catalog` (2), `progress`, `feedback`, `data`, `bridge`, `my-therapist`, `session/:id` | Mapa (≈ skill-map/dashboard), evidencias (lista y crear), conversación. **Sin diseño:** onboarding, check-in, detalle y edición de evidencia, hojas de vida, diario, ejercicios, herramientas, brújula, siguiente paso (rutas, experimentos, plan), catálogo de rutas, progreso, feedback, mis datos, puente, mi terapeuta, sala de sesión. |
| Profesional (5) | `/facilitation` (3), `professional-reviews`, `/therapist/dashboard`, `/therapist/patient/:id`, `/therapist/session/:id` | Nada. |
| Administración (12) | `dashboard`, `prompts`, `content`, `users`, `metrics`, `manifest`, `pilot-metrics`, gestores de catálogo de rutas y de capacidades (con detalle) | Nada. |
| Junta (1) | `/board/manifest` | Nada. |

## 3. Qué entregaremos a desarrollo (por familia)

1. **Sistema de diseño** (`tokens.css` + catálogo de componentes con todos sus estados): color azul claro/oscuro, tipografías, espaciado, mapa y relieve, botones, campos, avisos, pistas, fichas de evidencia, tablas, vacíos y errores. Con medidas de contraste.
2. **Una especificación por pantalla**: objetivo, quién la ve y qué datos (propietario verificado en servidor), layout escritorio y móvil, estados (vacío, cargando, guardando, error, éxito), textos ES y EN con sus claves, teclado y lector de pantalla, criterios de aceptación, y qué cambia frente a lo actual.
3. **Prototipo navegable por familia**, con los textos finales.
4. **Archivo de textos ES/EN** listo para i18n.
5. **Decisiones abiertas** que bloquean pantallas (ver §5).

## 4. Fases propuestas

| Fase | Contenido | Para qué sirve |
|---|---|---|
| 0 | Fijar el azul, tokens y componentes | Desarrollo puede empezar la base visual. |
| 1 | Núcleo de la persona: onboarding, check-in, mapa, evidencias completas, conversación, diario, siguiente paso (rutas, experimentos, plan), mis datos, hojas de vida | Es lo que usan las seis personas del piloto. |
| 2 | Puente y profesional: puente, mi terapeuta, sala de sesión, panel de profesional, revisiones | Frontera de privacidad: solo campos autorizados; nunca crisis ni diario. |
| 3 | Administración y junta: usuarios, catálogos, prompts, contenido, métricas del piloto | Operación del piloto. |
| 4 | Revisión cruzada y entrega: coherencia, accesibilidad, ES/EN, una lista de historias por pantalla | Cierre. |

Antes de diseñar cada pantalla sin diseño, leo cómo está hoy (solo lectura del código) para no inventar flujos ni campos.

## 5. Decisiones que bloquean

- Número de emergencia local (aviso de seguridad).
- Cobro en línea: si existe y cómo se nombra («solicitud» o «compra»).
- Variante A o B de ES-114 (etiquetas de nivel).
- «Profesional» o «terapeuta» en la interfaz del puente.
- Cancelar solicitud de plan y registro con consentimiento: hoy el servidor no lo hace.

## 6. No verificado

- No he revisado todavía el código de las pantallas sin diseño; el inventario sale solo de las rutas.
- Los textos EN son borrador y requieren revisión humana.
- Licencias de las tipografías, fotografía, ilustración y logotipo: por confirmar o encargar a personas.

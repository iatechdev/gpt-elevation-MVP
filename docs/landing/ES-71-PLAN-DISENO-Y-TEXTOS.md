# ES-71 · Diseño y plan de la sección de profesionales

[Dev-Codex] · 29-oct-2026. Rama ES-71-seccion-profesionales, base main d5eb00f9d0a035c6c98506038490f32087d4acc6. Solo propuesta documental; sin código de implementación.

## Alcance y aprobación existente

S8 Para quienes acompañan a otras personas, entre S7 Funciones y S9 Skill Map. Diseño general aprobado en ES-60/10279 y ES-71/10283. Texto fuente: origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md. Revisión previa de los 84 frames: ES-68/10304 y docs/landing/ES-68-VERIFICACION.md (S8, frames 21–24).

La aprobación existente cubre la sección; se presentan para decisión únicamente las correcciones de texto, estados y continuación al formulario real. No se rediseñan /therapist, /app, chat, formulario de profesionales ni backoffice. No se incorporan otras ramas de HU en curso.

## OBJECIÓN · textos originales desactualizados

| Texto o criterio | Evidencia actual | Corrección propuesta |
| --- | --- | --- |
| Resúmenes basados en ánimo, valoraciones y notas | backend/routes/therapistRoutes.js, resumen-ia: no lee ClinicalNote, notes:0; callClaude recibe solo datos estructurados. Decisiones ES-79/102/105 | Decir explícitamente que el resumen usa ánimo y valoraciones, sin notas ni conversaciones |
| Puedes proponer estilo, con aprobación del comité ético | therapistRoutes propone al Vault; adminPrompts requiere verificarSuperAdmin para aprobar | Decir aprobación requerida, sin atribuir una revisión clínica/humana a una institución no acreditada por código |
| Videollamada disponible | sessions.js devuelve mock.daily.co si falta DAILY_API_KEY | No anunciar integración externa como disponible sin verificación del entorno |
| Unirme crea acceso profesional | /profesionales existe en App; ES-95 guarda solicitud y hoja de vida. Aprobar solicitud no crea cuenta | CTA al formulario, nota de revisión previa y sin acceso automático |
| Psicólogo/a o coach profesional obtiene su espacio | ES-95 se definió para profesionales de psicología; no consta contrato separado de admisión de coaching | Introducción dirigida a profesionales de psicología; otros perfiles quedan a decisión del PO, sin prometerles acceso |
| Solo lo que la persona autoriza se comparte | El puente profesional existe, pero su conexión al terapeuta está pendiente y ES-103 define finalidad específica | No presentar el puente al terapeuta como operativo. Mantener separación del chat y estado Próximamente |

Riesgo de seguir el texto antiguo: prometer una prestación no verificada y afirmar envío de notas privadas al proveedor cuando se decidió excluirlas.

Recomendación: implementar el tramo informativo y probarlo con publicación desactivada por defecto hasta la revisión especializada exigida por ES-71 y la verificación D-03. Para las seis funciones, usar estado editorial «Disponibilidad por confirmar», porque existencia de código no acredita despliegue ni configuración. La conexión Skill Map mantiene «Próximamente». El estado no será una prueba automática ni una aprobación.

Estimación: 8–12 h para implementación y verificación, sin contar revisión especializada ni despliegue. Alternativa: esperar texto especializado final antes de implementar, posponiendo ese trabajo. No se propone modificar núcleo de permisos, resumen IA o videollamada desde esta HU.

## Flujo y maqueta

```text
Cabecera: Cómo funciona · Skill Map · Para psicólogos · …
  Para psicólogos → #profesionales, solo si S8 está montada

S7 Funciones
08 · PROFESIONALES
PARA QUIENES ACOMPAÑAN A OTRAS PERSONAS
Introducción
[Panel]              [Historia y notas]
[Resúmenes con IA]   [Sesiones y videollamada]
[Tu estilo]          [Credenciales]
  Cada bloque: título, descripción y estado por confirmar.
[Lo que no ves · chat privado separado]
[Skill Map · Próximamente]
[Invitación a revisar el diseño del piloto]
[Unirme como profesional] → /profesionales
  «La solicitud no crea una cuenta ni concede acceso automático.»
S9 Skill Map
```

Solo se navega al formulario ya existente; ES-71 no envía solicitudes ni añade campos. El flujo de envío/validación/estado pertenece a ES-95 y no se replica. No se comparten datos de la landing ni se conserva una selección en almacenamiento.

Una columna móvil, dos columnas a partir de tableta; marco editorial de la fase 1, sin imágenes ni iconos nuevos. Textos completos, sin truncar. CTA mínimo 44 px, orden de lectura y Tab iguales al orden visual; foco visible, enlace Saltar al contenido existente. Ancla directa con foco y margen bajo cabecera; menú móvil cierra al navegar y Escape devuelve foco al botón.

Reutilizar LandingSurface, LandingSection, LandingCard, LandingLabel, enlaces/botones de daisyUI prefijados elv-, tokens ES-61. Inter en titulares/cuerpo, mono en etiquetas. Papel #FAFAF9, tinta #1A1A18, gris #6B6B67; ocre #B8963E decorativo; texto ocre #7D6218 en claro y #D9B861 en oscuro. Verificar AA en ambos temas. Sin dependencias, módulos visuales adicionales ni movimiento nuevo; respetar prefers-reduced-motion.

## Estados y publicación

- VITE_ENABLE_LANDING_PROFESSIONALS ausente/false: S8 y su enlace de navegación ocultos. Solo true literal monta el tramo de revisión. La bandera no equivale a revisión especializada ni la habilita el CMS.
- Cargando, CMS offline/vacío/parcial/malformado: respaldo ES/EN completo, sin pantalla vacía o mezcla de idiomas.
- Seis funciones: estado «Disponibilidad por confirmar / Availability to be confirmed» editable por clave. No «Disponible» por deducirlo del repositorio.
- Skill Map hacia profesional: Próximamente / Coming soon. No enlace a resultados privados.
- Formulario existente: CTA /profesionales; si la ruta deja de estar registrada, ocultar CTA y mostrar Próximamente. No derivar URLs de contenido editable.
- No hay guardando, error o éxito de escritura propios: sección de lectura. El formulario conserva sus estados de ES-95.
- Revisión humana: especialista ES-17 y Mauricio o Alejo antes de publicación, como exige ES-71. No hay constancia de revisión especializada en los comentarios leídos.

## Textos ES/EN propuestos

Una clave por campo bajo landing.pros.*; claves de navegación existentes donde corresponda. Ningún texto o estado sale de HTML arbitrario, sin dangerouslySetInnerHTML.

| Elemento | ES | EN |
| --- | --- | --- |
| Número | 08 | 08 |
| Etiqueta | Profesionales | Professionals |
| Navegación | Para psicólogos | For psychologists |
| Título | Para quienes acompañan a otras personas | For those who support other people |
| Introducción | Si eres profesional de la psicología, puedes presentar tu perfil para que el equipo de Elevation revise tu incorporación. El espacio del profesional acreditado está separado del asistente de IA, que ofrece acompañamiento no clínico. El criterio profesional es tuyo. | If you are a psychology professional, you can submit your profile for the Elevation team to review your application. The accredited professional's space is separate from the AI assistant, which offers non-clinical support. The professional judgement is yours. |
| Estado de funciones | Disponibilidad por confirmar | Availability to be confirmed |
| Panel: título | Panel de personas vinculadas | Panel for people linked to you |
| Panel: cuerpo | Consulta registros de ánimo de entrada y salida y valoraciones de las personas vinculadas, según los permisos habilitados. | View mood check-in and check-out records and ratings for people linked to you, according to enabled permissions. |
| Notas: título | Historia y notas del profesional | Professional history and notes |
| Notas: cuerpo | Registra notas para tu seguimiento. Se guardan cifradas y su acceso está restringido al profesional vinculado. | Record notes for your follow-up. They are stored encrypted and access is restricted to the linked professional. |
| Resúmenes: título | Resúmenes con IA | AI summaries |
| Resúmenes: cuerpo | Síntesis basadas en registros de ánimo y valoraciones para apoyar tu revisión. No utilizan tus notas ni las conversaciones con el asistente. La IA puede equivocarse. | Summaries based on mood records and ratings to support your review. They do not use your notes or conversations with the assistant. AI can be wrong. |
| Sesiones: título | Sesiones y videollamada | Sessions and video calls |
| Sesiones: cuerpo | Organización y seguimiento de sesiones. La disponibilidad de videollamada requiere confirmar el servicio habilitado. | Session organisation and follow-up. Video call availability requires confirmation that the service is enabled. |
| Estilo: título | Tu estilo de acompañamiento | Your style of support |
| Estilo: cuerpo | Puedes proponer un estilo para el asistente. Los cambios requieren revisión y aprobación antes de activarse. | You can propose a style for the assistant. Changes require review and approval before activation. |
| Credenciales: título | Revisión de credenciales | Credential review |
| Credenciales: cuerpo | La incorporación requiere revisión del perfil y validación de credenciales antes de conceder acceso profesional. | Joining requires profile review and credential verification before professional access is granted. |
| Separación: título | Lo que no ves | What you do not see |
| Separación: cuerpo | No lees las conversaciones de la persona con el asistente de IA. Ese chat y su diario son espacios privados separados. | You do not read the person's conversations with the AI assistant. That chat and their journal are separate private spaces. |
| Puente: título | Y el Skill Map | And Skill Map |
| Puente: cuerpo | Está prevista una conexión para que la persona pueda compartir, si lo decide, las conclusiones profesionales que haya revisado y autorizado. Esa conexión con tu espacio aún no está disponible. | A connection is planned so the person can share, if they choose, professional conclusions they have reviewed and authorised. That connection to your space is not yet available. |
| Puente: estado | Próximamente | Coming soon |
| Invitación: título | Aporta tu criterio al piloto | Contribute your expertise to the pilot |
| Invitación: cuerpo | Queremos contar con profesionales de la psicología para revisar el encuadre, el lenguaje, la seguridad y la privacidad del piloto. Las condiciones de participación se acuerdan por separado. | We want psychology professionals to help review the pilot's framing, language, safety and privacy. Participation terms are agreed separately. |
| CTA | Unirme como profesional | Join as a professional |
| Nota CTA | La solicitud no crea una cuenta ni concede acceso automático. El equipo revisa tu perfil antes de continuar con la validación. | An application does not create an account or grant automatic access. The team reviews your profile before proceeding with verification. |

No tarifas, pagos, ingresos, cifras de eficacia, datos del piloto ni promesas de derivación/empleo. No se presume supervisión humana en vivo. La invitación sigue el propósito del one-pager; no publica sus datos históricos de participantes.

## Backend y seguridad

Sin nuevos endpoints, consultas personales, modelos, migraciones o permisos. Reutilizar GET /api/landing-content?lang=es|en y su fallback del catálogo shared/landing-content.json. El gestor existente deriva campos del catálogo: no rediseñar /admin. PUT de contenido conserva verificarSuperAdmin; no modificar helpers.

No llamar a /therapist, /consents, /career-context, documentos de credenciales o archivos privados desde la landing. /profesionales es solo el destino del enlace; no hacer POST ni subir documentos desde S8. La prueba del enlace no autoriza crear solicitudes reales. No analítica, cookies de seguimiento ni datos de personas.

## Pruebas y entrega previstas

- npm run lint sin errores/advertencias, tsc -b, npm test, build y audit; backend suite y prueba de contenido/permisos.
- Render real TSX de seis funciones, estados, separación, puente, invitación y CTA en ES/EN. Todas las claves sobrescribibles, valores en blanco/tipos incorrectos conservan fallback; HTML escapado.
- Bandera por defecto y valores no literales ocultan sección y navegación; build de revisión true visible.
- Menú ES/EN, Tab/Enter/Escape, foco visible y ancla directa. CTA llega al formulario registrado sin crear cuenta ni enviar solicitud.
- Responsive 320/375/390/768/1440, textos largos, ampliación al 200%, ambos temas y sin movimiento nuevo.
- GET público/PUT protegido con HTTP y JWT reales; persistencia simulada declarada si se usa el arnés del proyecto. Usuario sin rol 403, token inválido 401, superadmin legítimo 200. Sin afirmar pruebas A/B de endpoints personales nuevos, pues no se crean.
- Comparación antes/después de landing; zonas privadas sin cambios. Registrar fallos reales, riesgos de bundle/audit y lo no verificado.
- Una rama/un PR contra main; sin merge propio ni cierre de hilos. No cerrar historia integral hasta revisión especializada, D-03 y publicación autorizada.

## Decisión solicitada

Aprobar este texto actualizado, los estados por confirmar, CTA al formulario real y preparación con publicación desactivada. El diseño general ya está aprobado; no se pide aprobarlo otra vez. La aprobación de implementación no sustituye la revisión especializada ni verifica prestaciones en producción.


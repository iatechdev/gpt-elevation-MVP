# ES-69 · Diseño y plan para aprobación

[Dev-Codex] · 28-oct-2026. Rama ES-69-privacidad-faq, base origin/main 2f237a4. No se ha escrito código de implementación.

**Decisión posterior:** Alejo aprobó explícitamente en el chat «Si, lo apruebo saquemoslo adelante»; registrada en ES-69/10430. Se implementa el tramo preparatorio descrito, con publicación desactivada por defecto. La aprobación no sustituye la revisión especializada de ES-69/10281 ni resuelve D-08. Este documento conserva el plan presentado antes de implementar; entrega y resultados en ES-69-VERIFICACION.md.

## Alcance y fuentes

S6 Privacidad y límites y S14 Preguntas frecuentes (diez). Diseño general aprobado en ES-60/10279 y ES-69/10281. Textos base: docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md de origin/docs/landing-diseno-fase2. La revisión de los 84 frames fue registrada en ES-68/10304; se conserva la estructura aprobada. La presente propuesta adapta las afirmaciones que no pueden presentarse como disponibilidad verificada.

Sin cambios en /app, chat, terapeuta, backoffice, sesiones, permisos, consentimiento, exportación o borrado. No se duplica el trabajo de ES-94 (Dev-Claude), ES-95 ni de los PR de privacidad del terapeuta.

## OBJECIÓN · disponibilidad y revisión editorial

1. ES-69 dice «hoy no existen» puente, diario y derechos: ya existen rutas/modelos en main, pero eso no prueba despliegue ni disponibilidad. backend/routes/dataRights.js exige DATA_RIGHTS_ENABLED=true y no se encontró interfaz frontend de exportación/eliminación. El puente de contexto no es acceso del psicólogo al Skill Map. No confundir ambos.
2. frontend/public/privacy/index.html describe un GPT de OpenAI; Vercel conserva /privacy. ES-65/PR #68 propone política v0.2 pendiente de revisión. Enlazarla como política actualizada sería engañoso.
3. «Solo se comparte lo que autorizas» no describe todavía todos los accesos heredados del terapeuta: ES-96/101/103 y sus contratos deben resolverse. No se declara una garantía integral por implementar una landing.
4. ES-69/10281 y ES-60/10279 exigen revisión especializada de privacidad antes de publicación; no hay constancia de esa revisión en ES-69. La traducción tampoco tiene revisión nativa.

Recomendación: implementar y probar las dos secciones detrás de VITE_ENABLE_LANDING_TRUST_FAQ=true, apagada por defecto. Probar en build de revisión explícito; no cerrar la HU integrada ni anunciarla pública hasta aprobar texto y dependencias. Mantener /privacy intacta, marcador no interactivo mientras no haya política actual aprobada. Solo después de aprobación registrada se enlaza exactamente /privacy, sin URL nueva. Esta condición requiere decisión explícita sobre el texto adaptado, no una nueva aprobación del diseño global.

Impacto estimado: 10–14 h de implementación/pruebas; revisión humana y solución D-08 fuera de esa estimación. Alternativa: detener toda ES-69 hasta recibir versión editorial final, sin avance de interfaz. No se recomienda publicar promesas no verificadas.

## Pantallas y maqueta

Landing pública, mismo orden:
S5 Cómo funciona → S6 Privacidad y límites → S7 Funciones
S13 Cómo vincularte → S14 FAQ → S15 cierre/pie.

```text
06 · PRIVACIDAD Y LÍMITES
TU ESPACIO ES TUYO...
[01 Acompañamiento no clínico]   [02 Lo privado]
[03 Sin evidencia...]           [04 Tus datos · Próximamente]
[05 Si estás en riesgo: aviso general]
[Política de privacidad · pendiente de revisión]

14 · PREGUNTAS FRECUENTES
[¿Es terapia?                                  +]
[¿Mis conversaciones son privadas?             −]
  Respuesta completa, sin llamadas de red.
[Qué puede ver...                              +]
... diez preguntas, sin abrir ninguna por defecto.
```

Escritorio: lista de cinco puntos, dos columnas para S6 cuando el ancho lo permita; FAQ una columna editorial con longitud de lectura limitada. Móvil: una columna, texto sin corte y botones de al menos 44 px. La plantilla de escritorio sigue el marco de la fase 1; no inventa otra navegación.

Reutilizar LandingSurface, LandingSection, LandingLabel, tokens de ES-61 y estilos editoriales existentes. daisyUI prefijado elv-, sin nuevas dependencias; acordeón con button nativo en heading y panel asociado, aria-expanded y aria-controls. Varios paneles pueden estar abiertos. Enter/Espacio activan; Tab recorre preguntas/enlaces, foco visible 3 px. Panel cerrado no es enfocable. Sin animación; respeta reduced-motion. IDs estables por pregunta, no derivados de texto editable. Idioma cambiado conserva apertura, reemplaza todo el texto inmediatamente con fallback correcto.

Papel #FAFAF9, tinta #1A1A18, gris #6B6B67; ocre decorativo #B8963E y texto #7D6218 / #D9B861 según tema. Contraste AA verificado en ambos temas. No se importa todo collapse si componentes ya usados permiten la interacción accesible sin sumar CSS innecesario.

## Estados

- Bandera ausente/false: ninguna sección ni ancla pública nueva.
- CMS cargando, vacío, offline o JSON inválido: texto ES/EN de respaldo; no pantalla vacía ni texto de otro idioma.
- FAQ cerrada/abierta: estado solo en memoria, sin guardar ni registrar qué pregunta abrió la persona.
- Derechos/puente no publicados: chip Próximamente, sin botón ficticio.
- Política no aprobada: marcador no interactivo, no enlace roto ni sustituir URL.
- No existen guardando/éxito/error de escritura: esta HU es informativa y no escribe datos de personas.
- Precio: respuesta neutral con enlace a /pricing (ruta existente), sin cifras ni promesa de gratuidad. Así funciona con catálogo vacío, pagado o fallido y no duplica el GET de ES-73.

## Textos ES/EN propuestos para revisar

Todas las cadenas, incluidos títulos, etiquetas y estados, serán claves landing.trust.* y landing.faq.* del catálogo existente. Valores del CMS se renderizan como texto, nunca HTML. Este documento es la propuesta editorial, no la revisión especializada realizada.

### S6

| Elemento | ES | EN |
| --- | --- | --- |
| Etiqueta | Privacidad y límites | Privacy and limits |
| Título | Tu espacio es tuyo, y sabemos cuáles son nuestros límites | Your space is yours, and we are clear about our limits |
| 1 título | Acompañamiento no clínico | Non-clinical support |
| 1 cuerpo | El asistente de IA ofrece acompañamiento no clínico y orientación profesional. No diagnostica, no hace psicoterapia, no atiende urgencias ni garantiza empleo. La IA puede equivocarse. La atención con un profesional acreditado se realiza en un espacio separado, según disponibilidad. | The AI assistant offers non-clinical support and career guidance. It does not diagnose, provide psychotherapy or emergency care, or guarantee employment. AI can be wrong. Care with an accredited professional takes place in a separate space, subject to availability. |
| 2 título | Lo privado y lo profesional son espacios separados | Private and career information belong in separate spaces |
| 2 cuerpo | El chat con IA y el diario no se incorporan automáticamente al Skill Map. El puente profesional requiere que revises y autorices los campos que quieres trasladar. La conexión con el espacio del profesional sigue pendiente. | The AI chat and journal are not automatically added to Skill Map. The career bridge requires you to review and authorise the fields you want to transfer. The connection to the professional's space is still pending. |
| 3 título | Sin evidencia, una pregunta; no un déficit | No evidence is a question, not a deficit |
| 3 cuerpo | Una emoción o una preferencia no demuestra una competencia. El estado de ánimo no se usa para calcular tu mapa. | A feeling or a preference does not prove a capability. Mood is not used to calculate your map. |
| 4 título | Tus datos | Your data |
| 4 cuerpo | La exportación y la solicitud de eliminación desde la aplicación están en preparación. No anunciamos plazos de borrado sin verificarlos. | Export and deletion requests within the app are being prepared. We do not announce deletion deadlines without verifying them. |
| Estado | Próximamente | Coming soon |
| 5 título | Si estás en una situación de riesgo | If you are in a risky situation |
| 5 cuerpo | Esto no es un servicio de urgencias. Contacta a los servicios de emergencia o de salud de tu país. | This is not an emergency service. Contact the emergency or health services in your country. |
| Política | Política de privacidad | Privacy policy |
| Marcador | Pendiente de revisión | Pending review |

Sin números, enlaces de ayuda o países inferidos. No se consulta ni transmite información sobre crisis.

### S14 · Preguntas frecuentes / Frequently asked questions

| # | ES: pregunta / respuesta | EN: question / answer |
| --- | --- | --- |
| 1 | ¿Es terapia? / El asistente de IA no: ofrece acompañamiento no clínico y orientación profesional. No diagnostica ni garantiza empleo. El espacio de un profesional acreditado es independiente del chat con IA y está sujeto a disponibilidad. | Is this therapy? / The AI assistant is not: it offers non-clinical support and career guidance. It does not diagnose or guarantee employment. An accredited professional's space is separate from the AI chat and subject to availability. |
| 2 | ¿Mis conversaciones son privadas? / El chat con IA y el diario no se publican en el mapa ni se trasladan automáticamente al dominio profesional. El puente requiere revisar y autorizar campos concretos. La conexión con el espacio del profesional sigue pendiente. | Are my conversations private? / The AI chat and journal are not published in the map or automatically transferred to the career domain. The bridge requires reviewing and authorising specific fields. The connection to the professional's space is still pending. |
| 3 | ¿Qué puede ver mi psicólogo/a? / El alcance depende de la vinculación y los permisos habilitados. La información del espacio profesional está separada del chat con IA. La conexión con Skill Map está pendiente; no se anuncia acceso a sus conclusiones como disponible. | What can my psychologist see? / Access depends on the relationship and enabled permissions. Information in the professional's space is separate from the AI chat. The Skill Map connection is pending; access to its conclusions is not announced as available. |
| 4 | ¿Qué hace la IA? / Propone síntesis y opciones. Tú las corriges, las rechazas o las confirmas. Puede equivocarse. | What does the AI do? / It proposes summaries and options. You correct, reject or confirm them. It can be wrong. |
| 5 | ¿El Skill Map certifica mis capacidades? / No. Muestra qué evidencia respalda cada capacidad. Aceptar una capacidad candidata no acredita un nivel. | Does Skill Map certify my capabilities? / No. It shows what evidence supports each capability. Accepting a candidate capability does not certify a level. |
| 6 | ¿Me garantizan un empleo? / No. Conseguir empleo depende de condiciones externas y no forma parte de lo que ofrecemos. | Do you guarantee a job? / No. Getting a job depends on external conditions and is not part of what we offer. |
| 7 | ¿Sirve para profesiones no técnicas? / Está diseñado para que sí: una docente o una contadora no recibe programación por defecto. | Does it work for non-technical professions? / It is designed to: a teacher or an accountant is not recommended programming by default. |
| 8 | ¿Puedo borrar mis datos? / La exportación y la solicitud de eliminación desde la aplicación están en preparación. No anunciamos plazos de borrado sin verificarlos. | Can I delete my data? / Export and deletion requests within the app are being prepared. We do not announce deletion deadlines without verifying them. |
| 9 | ¿Cuánto cuesta? / Consulta los planes y precios disponibles en la página de planes. La solicitud no cobra ni activa automáticamente un plan. | How much does it cost? / Check the plans page for available plans and prices. A request does not charge you or automatically activate a plan. |
| 10 | ¿En qué idiomas está? / Español e inglés. | Which languages are available? / Spanish and English. |

Enlace de FAQ 9: Ver planes / View plans → /pricing. No «Empieza sin costo» estático. No se añaden países, tarifas, fuentes, testimonios ni datos del piloto.

## Backend y datos

No endpoints, consultas personales, modelos ni migraciones nuevos. GET /api/landing-content?lang=es|en existente, público; extensión declarativa del catálogo shared/landing-content.json. Gestor existente deriva campos de ese catálogo: sin rediseñar /admin. Sus PUT siguen solo para superadmin, verificación de rol del servidor intacta. No llamar /consents, /career-context, /exports, /account/deletion-requests ni rutas del terapeuta desde la landing.

La política de privacidad se resuelve en ES-65, no se duplica ni cambia la URL. ES-73 permanece PR #76 independiente: ES-69 no incorpora su rama ni inventa una API alternativa de precios. /pricing ya existe en main.

Seguridad/privacidad: página de lectura sin acceso a cuentas, cookies de seguimiento, analítica o contenido privado. No se cambian helpers de Mauricio. A/B no aplica a nuevas consultas personales porque no se añaden; comprobar usuario ordinario 403 al editar claves, superadmin autorizado, sin sesión denegada. No se afirmará una prueba real con DB si solo se usa el arnés simulado de contenido.

## Verificación prevista y entrega

- Frontend lint, tsc -b, npm test, build y audit, con salidas reales.
- Render real TSX ES/EN y diez preguntas; claves CMS completas, parciales, vacías, malformadas, offline y texto con HTML escapado.
- Navegador: Enter/Espacio/Tab, aria-expanded/controls, foco, panel oculto no enfocable, idioma sin mezcla, anclas y orden de secciones.
- 320/375/390/768/1440, textos largos, zoom 200%, claro/oscuro, reduced motion; comparación antes/después sin cambios en zonas privadas.
- Bandera por defecto oculta y build explícito de revisión; precios sin red duplicada ni gratuidad prometida, política pendiente no enlazada.
- Backend: pruebas de catálogo y permisos de edición contra arnés declarado, suite existente; sin migraciones que ejecutar.
- Un PR contra main, firmado, criterios del tramo preparatorio separados de publicación integral. No merge propio ni cierre de hilos QA.

## Aprobación requerida

El layout está aprobado. Falta aprobar estas adaptaciones ES/EN y el plan de preparación con publicación desactivada. Esto NO sustituye la revisión especializada exigida por ES-69/10281. Cuando exista revisión humana y política actual aprobada, registrar referencias y decidir habilitación; no deducirla de un cambio del CMS.


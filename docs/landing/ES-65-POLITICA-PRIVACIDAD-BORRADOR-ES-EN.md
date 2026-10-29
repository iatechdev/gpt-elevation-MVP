# Elevation + Skill Map — Política de privacidad / Privacy policy

**BORRADOR PARA REVISIÓN — NO PUBLICAR / DRAFT FOR REVIEW — DO NOT PUBLISH**

Versión / Version: 0.1 · Preparado / Prepared: 28-oct-2026 · Ticket: ES-65, D-08.
Autoría / Prepared by: [Dev-Codex]. Solicitado por Alejo en el chat de ES-65.
Referencia técnica / Code reviewed: `main`, commit `6f01a928a6b015edb75b4f934af2d2f032f6541c`.
Entrada en vigor / Effective date: **pendiente de aprobación / pending approval**.
URL pública a conservar / Public URL to preserve: **`/privacy`**.

Este borrador reemplaza la descripción del antiguo GPT por la aplicación React/Express con Claude. No reemplaza todavía el documento público ni acredita cumplimiento normativo. Las indicaciones entre corchetes deben resolverse antes de publicarlo. La existencia de una función en el código no prueba que esté habilitada en producción.

This draft replaces the description of the former custom GPT with the React/Express application using Claude. It does not yet replace the public document or establish regulatory compliance. Bracketed items must be resolved before publication. A feature present in source code is not proof that it is enabled in production.

## Español — texto propuesto

### 1. Quién trata tus datos y cómo contactar

El responsable de Elevation + Skill Map es **[PENDIENTE: razón social o persona responsable, identificación y domicilio]**. Puedes contactar para consultas y solicitudes sobre tus datos en **[PENDIENTE: canal público verificado de privacidad]**. La jurisdicción, autoridad de protección de datos competente y vías de reclamación aplicables son **[PENDIENTES de revisión jurídica según el responsable y los países del servicio]**.

### 2. Qué es el servicio

El asistente de IA ofrece acompañamiento y orientación profesional no clínicos. No sustituye atención psicológica, médica ni de emergencia. El espacio de un profesional acreditado es separado y puede contener información sensible, notas y documentos con reglas propias de acceso y conservación. **[PENDIENTE: identificar la relación y responsabilidades entre plataforma y profesionales y su aviso específico]**.

El piloto está pensado para personas adultas en transición profesional. **[PENDIENTE: política de edad mínima y procedimiento aplicable; no se ha verificado un control de edad]**.

### 3. Datos y finalidades

Según las funciones que uses, la aplicación puede tratar:

| Datos | Para qué se usan |
| --- | --- |
| Nombre, correo, contraseña protegida mediante hash, rol y estado de cuenta | Crear la cuenta, autenticarte y aplicar permisos y controles de seguridad |
| Mensajes con el asistente, respuestas y entradas de diario que decidas guardar | Mantener tu historial y prestar las funciones de conversación y diario; las entradas del diario solo se incorporan a una conversación cuando las seleccionas explícitamente |
| Registros de ánimo y valoraciones | Mostrar seguimiento y funciones de acompañamiento; no certificar competencias ni diagnosticar |
| Idioma, residencia, mercado de interés, zona horaria, profesión, intereses, disponibilidad, objetivos y restricciones que aportes | Preparar tu contexto y orientar la exploración profesional |
| Campos profesionales autorizados, evidencias y evaluaciones del mapa, versiones y decisiones de compartir o retirar | Construir funciones profesionales con trazabilidad y respetar tus decisiones |
| Solicitudes de plan, sesiones, vinculación con profesionales y sus documentos de acreditación o notas, cuando corresponda | Gestionar el servicio y el espacio profesional separado |
| Metadatos de sesión, revocación, consentimiento, uso y presupuesto de IA | Proteger accesos, registrar decisiones y controlar el funcionamiento y consumo del servicio |

Los textos libres pueden incluir información sensible si la escribes. Evita incluir información identificativa o confidencial de otras personas que no sea necesaria. **[PENDIENTE: determinar y documentar la base jurídica de cada finalidad y la condición aplicable a datos sensibles; no se presume consentimiento por usar la página]**.

### 4. Quién puede acceder y qué se comparte

La aplicación usa cuentas y permisos para comprobar el propietario y el rol en servidor. El chat y el diario privados no son una carpeta pública ni el historial de lectura del profesional. El puente profesional se diseña para transferir únicamente campos profesionales que revises y autorices; la señal de riesgo no alimenta el mapa ni se envía al profesional como indicador.

Si usas el espacio de un profesional, este puede acceder a los datos previstos para su relación contigo, como registros de ánimo, valoraciones y sus propias notas. Las funciones de resumen con IA del espacio profesional pueden enviar los materiales que esa función utiliza al proveedor de IA. Esto es distinto de abrir tus conversaciones privadas con el asistente.

Personal autorizado de operación y proveedores técnicos pueden intervenir en la prestación, soporte o seguridad según sus funciones. **[PENDIENTE: inventario de accesos operativos, personal, controles de soporte, obligaciones y destinatarios externos efectivamente contratados]**. No prometemos inaccesibilidad absoluta para quien administra la infraestructura.

### 5. IA y proveedores

El backend integra Claude mediante la API de Anthropic. Para responder, se envía al proveedor el contenido necesario del turno y el contexto seleccionado por la función; no es un servicio sin tratamiento de conversaciones por terceros. Las respuestas pueden equivocarse y debes revisarlas. No son certificaciones, decisiones de contratación ni garantías de empleo.

También hay integraciones con PostgreSQL para persistencia, Google Cloud Storage para documentos profesionales y Daily para crear salas de videollamada. El HTML actual solicita fuentes de Google Fonts. **[PENDIENTE: confirmar servicios activos, entidades contratadas, regiones, subencargados, transferencias internacionales y garantías contractuales; no dar por verificados Railway, Supabase o Vercel solo por su documentación o configuración en el repo]**.

La retención de datos enviados a Anthropic depende de la API, el modelo, las condiciones del proveedor y el acuerdo de la organización. No se ha verificado un acuerdo de retención cero para Elevation. Las reglas de conservación de Google Cloud Storage también dependen de la configuración del bucket. Las páginas oficiales citadas al final no acreditan la configuración de esta cuenta.

### 6. Almacenamiento del navegador y seguridad

La aplicación usa almacenamiento local del navegador para la sesión y preferencias como el idioma. Cerrar una sesión y borrar datos de la cuenta son operaciones distintas. El almacenamiento local no debe confundirse con una cookie de publicidad.

Este cambio de landing no añade analítica ni cookies de seguimiento. **[PENDIENTE: inventario completo de cookies, almacenamiento, logs y telemetría del despliegue y de todos los proveedores]**. Las solicitudes a servicios externos, incluidas fuentes, pueden transmitir datos técnicos de conexión.

El código incluye hashes de contraseña, controles de sesión y permisos, y cifrado de determinados contenidos en la base de datos. No significa cifrado de extremo a extremo ni que todos los datos, copias o registros tengan la misma protección. **[PENDIENTE: comprobar en despliegue TLS, gestión de claves, backups, acceso operacional y respuesta a incidentes]**.

### 7. Conservación, exportación y eliminación

**[PENDIENTE: tabla aprobada de conservación por categoría, fundamento, disparador de borrado, excepciones y plazo de backups/proveedores]**. No prometemos un plazo exacto de eliminación ni borrado inmediato de todas las copias.

El código tiene funciones de exportación personal o profesional y solicitud de eliminación, sujetas a habilitación y verificación de identidad. La solicitud aceptada de eliminación bloquea la cuenta y los accesos; la purga es una etapa posterior. La eliminación local no demuestra eliminación de copias de proveedores, backups ni datos sujetos a obligaciones separadas. Los registros profesionales o que afecten a varias personas pueden requerir revisión humana antes de exportarse o borrarse.

Cuando las funciones no estén habilitadas o un caso requiera revisión, el canal alternativo es **[PENDIENTE: canal público operativo verificado]**. No debes enviar tu contraseña ni tokens por ese canal. **[PENDIENTE: alcance de conservación de constancias mínimas de una eliminación y política de restauración de backups]**.

### 8. Tus decisiones y derechos

Puedes revisar y corregir la información que permiten editar las funciones disponibles y retirar los permisos de compartición mediante sus controles. Retirar un permiso detiene los usos cubiertos por ese permiso según el contrato de la función; no garantiza recuperar copias que ya se hayan comunicado legítimamente ni elimina por sí mismo toda tu cuenta.

Para ejercer derechos sobre tus datos, solicita la verificación y gestión de tu caso por **[PENDIENTE: canal]**. **[PENDIENTE: catálogo de derechos, procedimiento, plazos legales, verificaciones proporcionales y autoridad de reclamación según la jurisdicción confirmada]**. No se presenta la disponibilidad técnica de un botón como condición para ejercer un derecho aplicable.

### 9. Cambios del aviso

La versión aprobada se publicará en `/privacy` con su fecha real de vigencia y mecanismo de aviso **[PENDIENTE]**. Una nueva finalidad que requiera autorización no se considerará aceptada solo porque se actualice este texto. **[PENDIENTE: responsable y procedimiento de revisión y notificación]**.

## English — proposed text

### 1. Who handles your data and how to contact us

The controller of Elevation + Skill Map is **[PENDING: legal entity or responsible person, identification and address]**. Contact us about your information through **[PENDING: verified public privacy channel]**. Applicable jurisdiction, supervisory authority and complaint procedures are **[PENDING legal review based on the controller and countries served]**.

### 2. About the service

The AI assistant provides non-clinical support and career guidance. It does not replace psychological, medical or emergency care. An accredited professional's space is separate and may contain sensitive information, notes and documents with specific access and retention rules. **[PENDING: platform/professional responsibilities and separate notice]**.

The pilot is intended for adults in career transition. **[PENDING: minimum-age policy and applicable procedure; an age check has not been verified]**.

### 3. Data and purposes

Depending on the features you use, the application may process:

| Data | Purpose |
| --- | --- |
| Name, email, hashed password, role and account status | Account creation, authentication, permissions and security |
| Assistant messages and responses, and journal entries you choose to save | Conversation and journal features and history; journal entries are included in a conversation only when explicitly selected |
| Mood records and ratings | Tracking and support features, without diagnosing or certifying capabilities |
| Language, residence, target market, time zone, profession, interests, availability, goals and constraints you provide | Your context and career exploration |
| Authorised professional fields, evidence, map assessments, versions and sharing/withdrawal decisions | Traceable professional features and respecting your choices |
| Plan requests, sessions, professional matching, credentials and notes where applicable | Service administration and the separate professional space |
| Session, revocation, consent and AI usage/budget metadata | Access security, decision records and service/usage controls |

Free text may contain sensitive information if you provide it. Avoid unnecessary identifying or confidential information about others. **[PENDING: legal basis for each purpose and applicable condition for sensitive data; using the page is not assumed to establish consent]**.

### 4. Access and sharing

The application checks ownership and roles on the server. Private assistant conversations and journals are not public folders or the professional's reading history. The professional bridge is designed to transfer only professional fields you review and authorise; a risk indicator does not feed the map or become a professional-facing indicator.

If you use a professional's space, that professional can access the information provided for that relationship, including mood records, ratings and their own notes. Its AI summary features may send the materials used by that function to the AI provider. This differs from opening your private assistant conversations.

Authorised operations staff and technical providers may be involved in service delivery, support or security according to their functions. **[PENDING: actual operational access, support controls, obligations and contracted recipients]**. We do not promise absolute inaccessibility to infrastructure administrators.

### 5. AI and providers

The backend integrates Claude through Anthropic's API. The content needed for a turn and the context selected by the feature are sent to the provider. Conversations are therefore processed by a third-party provider. Responses can be wrong and require your review; they are not certifications, hiring decisions or employment guarantees.

The code also integrates PostgreSQL for persistence, Google Cloud Storage for professional documents and Daily for video rooms. The current HTML requests Google Fonts. **[PENDING: active services, contracted entities, regions, subprocessors, international transfers and safeguards; repository configuration does not verify Railway, Supabase or Vercel deployment]**.

Anthropic's retention depends on the API, model, provider terms and organisational agreement. A zero-data-retention agreement for Elevation has not been verified. Google Cloud Storage retention also depends on bucket configuration. The official pages below do not establish this account's settings.

### 6. Browser storage and security

The application uses browser local storage for the session and preferences such as language. Signing out is different from deleting account data. Local storage is not the same as an advertising cookie.

This landing change adds no analytics or tracking cookies. **[PENDING: complete deployment/provider cookie, storage, log and telemetry inventory]**. External requests, including fonts, may transmit technical connection data.

The code includes password hashing, session and permission controls, and encryption of certain database content. This is not end-to-end encryption and does not mean all records, logs or backups have identical protection. **[PENDING: deployed TLS, key management, backups, operational access and incident response verification]**.

### 7. Retention, export and deletion

**[PENDING: approved retention schedule by category, grounds, deletion triggers, exceptions and backup/provider timelines]**. We do not promise an exact deletion deadline or immediate removal of every copy.

The code has personal/professional export and account-deletion request functions, subject to enablement and identity verification. An accepted deletion request blocks the account and access; purge is a later step. Local deletion does not establish deletion from providers or backups, or of records subject to separate obligations. Professional records or records involving several people may require human review before export or deletion.

When controls are unavailable or review is needed, contact **[PENDING: verified operational public channel]**. Do not send passwords or tokens. **[PENDING: minimum deletion-receipt retention and backup-restoration policy]**.

### 8. Your choices and rights

You can review and correct information through available editing features and withdraw sharing permissions through their controls. Withdrawal stops the uses covered by that permission under the feature's contract; it does not guarantee recovery of lawfully shared copies or automatically delete your entire account.

For requests about your information, contact **[PENDING: channel]** for verification and handling. **[PENDING: applicable rights, procedure, statutory timelines, proportionate verification and complaint authority under the confirmed jurisdiction]**. Availability of a technical button is not presented as a condition for exercising applicable rights.

### 9. Changes to this notice

The approved version will be published at `/privacy` with its actual effective date and notification mechanism **[PENDING]**. Updating this document alone does not establish acceptance of a new purpose requiring authorisation. **[PENDING: review and notification owner/procedure]**.

## Anexo de revisión / Review appendix — no es texto de producción

| Pendiente / Pending | Responsable propuesto / Proposed owner | Evidencia necesaria / Evidence needed |
| --- | --- | --- |
| Identidad del responsable, contacto, jurisdicción, bases y derechos | Mauricio + asesoría jurídica | Datos públicos aprobados y revisión legal de ambas versiones |
| Encuadre y datos sensibles del espacio profesional | Alejo + especialista + asesoría | Finalidades, accesos y obligaciones profesionales |
| Proveedores, regiones, contratos y retención | Infra + Mauricio | Inventario de producción, acuerdos y configuración efectiva |
| Borrado, backups, soporte, incidentes y canal alternativo | Mauricio + Infra | Procedimientos y pruebas operativas, no solo tests unitarios |
| Revisión de inglés y paridad ES/EN | Alejo + revisor EN | Correcciones y aprobación registradas |
| Publicación y enlace desde landing | Mauricio + QA | Aprobación D-08, `/privacy` conserva URL y responde documento aprobado en despliegue |

Fuentes técnicas revisadas: `backend/routes/chat.js`, `backend/routes/therapistRoutes.js`, `backend/routes/sessions.js`, `backend/routes/dataRights.js`, `backend/routes/participantContext.js`, `backend/utils/personalData.js`, `backend/utils/sessions.js`, `backend/utils/safety.js`, `backend/utils/crypto.js`, `backend/utils/anthropic.js`, `backend/utils/storage.js`, `frontend/index.html`, `frontend/src/i18n/LanguageProvider.tsx`, `vercel.json`. El registro de datos personales incluye la revisión de casos profesionales antes de exportar/purgar; los endpoints de derechos requieren habilitación explícita.

Fuentes oficiales consultadas / Official references consulted, 28-oct-2026:

- [Anthropic: retención comercial](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data): sus condiciones incluyen excepciones y no permiten prometer retención cero sin confirmar el acuerdo/configuración de la organización. / Terms include exceptions and do not establish this organisation's agreement/settings.
- [Google Cloud Storage: soft delete](https://docs.cloud.google.com/storage/docs/soft-delete): borrar un objeto puede conservarlo según la política configurada. / Deleting an object may retain it under the configured policy.

**No se ha consultado ni modificado configuración de producción, ni se han incorporado secretos o datos personales. Este adjunto solicita revisión; no aprueba ni publica una política. / Production settings were not accessed or modified; no secrets or personal data are included. This attachment requests review, not approval or publication.**

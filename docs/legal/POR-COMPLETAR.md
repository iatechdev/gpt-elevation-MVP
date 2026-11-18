# Marcadores pendientes de los documentos legales (ES-335)

> **BORRADOR SIN REVISIÓN LEGAL.** Esta lista es completa: la prueba `frontend/test/es-335-legal-docs.test.mjs` falla si un marcador de `es/` o `en/` no está aquí, o si algo listado aquí ya no aparece en los documentos. Los identificadores son los mismos en español e inglés.

Tres tipos de marcador:
- `PC-nn` — **POR COMPLETAR / TO BE COMPLETED**: dato que solo la empresa o el equipo puede dar. **No se inventa.**
- `VF-nn` — **VERIFICAR / VERIFY**: hecho que no se pudo comprobar en el código o que depende de un contrato o decisión externa.
- `RL-nn` — **REVISAR LEGAL / LEGAL REVIEW**: punto de redacción o de interpretación para el abogado.

## PC — datos que debe aportar la empresa

| ID | Qué falta | Quién decide / aporta | Documentos |
| --- | --- | --- | --- |
| PC-01 | Razón social del responsable del tratamiento | Mauricio / Alejo | 01, 02, 06 |
| PC-02 | NIT o identificación tributaria | Mauricio | 01, 02 |
| PC-03 | Domicilio | Mauricio | 01, 02 |
| PC-04 | Correo de contacto para asuntos de datos (consultas, reclamos, derechos) | Mauricio | 01, 02, 07 |
| PC-05 | Fecha de última actualización / entrada en vigor | Mauricio (al publicar) | 01, 02 |
| PC-06 | Plazo máximo de conservación (p. ej., cuentas inactivas) | Mauricio con el abogado | 01, 07 |
| PC-07 | Edad mínima para crear una cuenta | Abogado | 01, 02 |
| PC-08 | Ley aplicable, jurisdicción y marco de protección de datos (se asume Colombia, Ley 1581 de 2012, por confirmar) | Abogado | 01, 02 |
| PC-09 | Línea de ayuda o emergencia local (decisión de producto; solo se publica una línea verificada por país y fecha) | Alejo | 02, 03 |
| PC-10 | Persona o área encargada de la protección de datos, si aplica | Mauricio / abogado | 01 |
| PC-11 | Proveedores (modelo de lenguaje, alojamiento, base de datos y almacenamiento, correo), su país y la base de cualquier transferencia internacional | Infra (Mauricio) | 01 |
| PC-12 | Plazos de respuesta a solicitudes de derechos | Abogado | 01, 07 |
| PC-13 | Plazo efectivo de supresión total (copias de seguridad, proveedores) y procedimiento al restaurar una copia | Infra / Mauricio | 07 |
| PC-14 | Retención de los registros que escribió un profesional sobre una persona (QA-23-02) | Mauricio / abogado | 01, 07 |
| PC-15 | Retención operativa de registro de uso de IA, tokens revocados, bloqueos de seguridad y logs | Infra / Mauricio | 07 |
| PC-16 | Condiciones comerciales futuras (precios, facturación, reembolsos); hoy no hay pago en línea | Alejo | 02 |

## VF — hechos por verificar

| ID | Qué verificar | Quién | Documentos |
| --- | --- | --- | --- |
| VF-01 | Entorno real de producción: el código y los documentos mencionan Railway, Supabase y un despliegue previsto en Vercel + Supabase | Infra | 01 |
| VF-02 | Por contrato: el proveedor de IA no usa los datos para entrenar y cuánto tiempo los conserva | Mauricio | 01 |
| VF-03 | País de cada proveedor y si hay transferencia internacional | Infra | 01 |
| VF-04 | Si el nombre y el correo de la cuenta se guardan cifrados o en claro (hoy se asume en claro) | Mauricio | 01 |
| VF-05 | Que no existe ni se prevé otro uso comercial de los datos | Alejo | 01 |
| VF-06 | Si habrá un uso de investigación (`research`); hoy ninguna función lo usa | Alejo | 01, 05 |
| VF-07 | Cómo se describe la relación entre la plataforma y los profesionales (independientes, contratados, aliados) | Alejo | 02 |
| VF-08 | Quién valida el aviso de producto no clínico (especialista; ES-17 / ES-24 sin responsable) | Alejo | 03 |
| VF-09 | En un entorno desplegado, que ninguna cookie aparece (incluidas las del proveedor de alojamiento) | QA / Infra | 04 |
| VF-10 | En un entorno desplegado, que no hay analítica ni publicidad | QA / Infra | 04 |
| VF-11 | Qué se hace con la página estática antigua `/privacy` (contenido del producto anterior; carga tipografías de un tercero) | Mauricio | 04 |
| VF-12 | Si hay una función que consuma el permiso `facilitator_sharing`; si no, retirar esa sección | Mauricio | 05 |
| VF-13 | Comportamiento exacto de las revisiones ya hechas tras retirar el permiso de revisor | Mauricio | 05 |
| VF-14 | Si retirar `resume_ai_reading` borra las hojas de vida (el comentario del código dice que sí; el texto de la interfaz dice que no) | Mauricio | 05 |
| VF-15 | Qué notificaciones se envían hoy y por qué canal | Mauricio | 05 |
| VF-16 | Cuánto tiempo vive una exportación generada antes de caducar | Mauricio | 07 |
| VF-17 | Que el registro de solicitudes de borrado independiente del respaldo esté aprovisionado | Infra | 07 |
| VF-18 | Estado de `DATA_RIGHTS_ENABLED` (exportación y eliminación) al lanzamiento | Mauricio / Infra | 07 |

## RL — puntos para el abogado

| ID | Punto | Documentos |
| --- | --- | --- |
| RL-01 | Alcance de la licencia de uso y de las marcas | 02 |
| RL-02 | Redacción exacta de las limitaciones de responsabilidad según la ley aplicable | 02 |
| RL-03 | Si el almacenamiento local de preferencias exige aviso o consentimiento | 04 |
| RL-04 | Si el texto de «Tu opinión» basta como finalidad y como tratamiento de datos de opinión | 06 |
| RL-05 | Conservar versión y fecha de aceptación de términos tras la purga (E301-2) | 07 |
| RL-06 | Si los agregados del piloto cuentan como datos anonimizados fuera de la supresión | 07 |

Preguntas abiertas completas: `PREGUNTAS-ABOGADO.md`. Verificación contra el código: `VERIFICACION-CONTRA-CODIGO.md`.

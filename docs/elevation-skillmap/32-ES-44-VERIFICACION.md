# ES-44 — Entrega del paquete preparatorio

[Dev-Codex]

28-oct-2026. Diseño/plan técnico: comentario Jira 10239. Aprobación explícita en chat: «Aprobar el paquete preparatorio y las pruebas locales». Base main 6dc61e9; rama aislada `ES-44-referencias-calidad`.

**Esta entrega no cierra ES-44 integral ni valida calidad de Claude.** Corpus, controles y herramientas listos para revisión técnica/QA. Rúbrica draft, revisiones humanas sin realizar, corrida real no autorizada y rutas/plan/parser pendientes. No se invita al piloto.

## Entregado

- Corpus de 30 casos sintéticos, 24 ES / 6 EN, 21 no técnicos y 8 adversos. Cada caso tiene fuentes locales, autorización prevista, restricciones, controles, criterios humanos y afirmaciones que no deben inventarse. Casos de escasez, contradicción, profesión regulada, privacidad, cita inexistente, inyección, revocación y fallo/presupuesto.
- Esquema cerrado y validación de estructura, composición, referencias, secuencia/versiones, cobertura específica y banderas sintéticas.
- Rúbrica bilingüe propuesta, siete dimensiones, `calibrated:false`, aprobación null y sin personas/revisiones inventadas.
- CLI offline y modo mock sin red/DB/SDK, arnés local con PostgreSQL desechable y proveedor simulado, reportes inmutables con hashes y plantillas vacías para dos revisores humanos.
- Consolidado con denominador fijo 30, mínimo 24 pertinentes **y justificados**, pendientes separados y bloqueo por cualquier hallazgo crítico. Desacuerdo requiere resolución de Tech Lead referenciada; no borra un hallazgo crítico. Las identidades son declaraciones que Mauricio/QA deben verificar, no autenticación del producto.
- `releaseStatus:not_approved` incluso si un conjunto de registros llega a ser elegible para decisión humana. No hay vía de proveedor real activada: `--mode=provider` se rechaza antes del adaptador.
- Job CI offline, Node 22, sin instalar dependencias ni abrir DB/proveedor; agrega validación y 16 unitarias del paquete. No se relaja ningún check existente.

No cambian frontend, código de producto, helpers de identidad/consentimiento/derechos, endpoints, modelos, migraciones o dependencias. Los scripts añadidos a backend/package.json son comandos de evaluación. Sin pantalla nueva: no aplica diseño visual; el plan técnico se aprobó antes de escribir el paquete.

## Resultados reales locales

Node 24.14.0 / Windows; unitarias nuevas repetidas también con Node 22.

| Comando | Resultado |
| --- | --- |
| `node evaluation/es44/cli.cjs --mode=validate` | exit 0; 30 validated, 0 llamadas; puerta blocked |
| `node evaluation/es44/cli.cjs --mode=mock` | exit 0; 30 simulated, controles not_run; puerta blocked |
| `node --test test/es-44-evaluation.test.cjs` | 16/16, 0 fail; también 16/16 con Node 22 |
| `npm test` backend | 264/264, 0 fail |
| `node evaluation/es44/cli.cjs --mode=integration` | exit 0; 30 casos ejecutados, 61/61 controles mecánicos sin fallo; 15 casos sin etapa adicional pendiente y 15 con etapas ausentes |
| Integración: proveedor | 58 llamadas simuladas; **0 llamadas reales**; tokens de fixtures etiquetados simulados, costo null |
| `--mode=integration --max-cases=1 --max-calls=5` | exit 1; 1 caso ejecutado, 29 not_run; no se reduce denominador ni se rellena el lote |
| `--mode=provider` | exit 1; provider_execution_not_authorized |
| `review.cjs` con reporte y template real vacío | exit 1; blocked, 30 pendientes de evaluación humana, releaseStatus not_approved |
| `node --check` seis módulos CJS nuevos | exit 0 |
| `npm audit --audit-level=high --json` | exit 0; 6 moderadas, 0 altas/críticas; sin cambios de dependencias |
| `git diff --check` | exit 0; informes generados ignorados por Git |

La integración final de referencia generó `integration-97632f10-2efd-4816-9b70-5962e0b3aeeb.run.json`, hash `e0d44941028c18f8b8e597901990f17a62aed1765d43c539bdf0a84cf3d89196`. Artefactos en la carpeta ignorada `backend/evaluation/es44/reports/`; incluyen salidas sintéticas sin tokens de propuesta. La salida esperada del caso 30 registra un fallo deliberado del doble y luego recuperación; no es una llamada a Anthropic ni un error sin resolver del producto.

No se ejecutaron lint/tipos/build de frontend localmente desde esta HU porque no cambia frontend; su job existente se mantiene en CI. Los resultados de CI remoto se registrarán en el PR del head correspondiente, sin presentarlos como ejecución del arnés PostgreSQL.

## Qué ejercita el arnés real

Usuarios, JWT/sesión, consentimiento, cifrado v2, ORM, transacciones, presupuesto y endpoints de evidencia/Skill Map reales. Usuarios y referencias solo de la base local temporal. La siembra del catálogo es un fixture explícito; sus niveles/fuente/revisor sintéticos no son curación ni revisión humana real.

- Propuestas de evidencia sobre turnos propios, citas verificadas y cero persistencia automática de evidencias.
- Propuestas de Skill Map sobre autorreportes confirmados con referencias existentes; sin evaluaciones guardadas hasta confirmar; nivel acotado a autonomía asistida declarada en los casos aplicables.
- Números de resultados no presentes y citas inexistentes rechazados; habilidad fuera del catálogo rechazada.
- IDs ajenos: propuesta desde turno extranjero 404; GET/DELETE evidencia ajena 404 con JWT de usuario/admin/terapeuta/board; sin token 403; JWT revocado 401. No aumenta el contador de llamadas del doble en esos accesos.
- Canarios de diario/crisis/asistente ausentes del prompt profesional. Fuente de riesgo excluida con 422 y sin llamada. Delimitadores de texto no confiable y redacción de credencial **ficticia** comprobados; no se da por probado que un modelo real resistirá la inyección.
- Revocación durante el doble: la propuesta iniciada llega al dueño, pero su confirmación posterior da 403, no crea EvidenceVersion y una nueva propuesta ya no llama al doble. No se promete detener remotamente una generación en curso.
- Presupuesto agotado: 429 sin llamada al doble; fallo del doble: 502 sin evidencia persistida; segundo intento explícito recupera propuesta sin publicarla.

Los relatos de cada profesión y su pertinencia NO se validan con esos mocks: solo un revisor con la rúbrica puede decidir si el resultado es pertinente y está justificado. El arnés no transforma un autorreporte en evidencia examinada ni un rango sintético en nivel calibrado.

## Verificación de la puerta

Las unitarias usan registros nominales marcados `TEST_ONLY_*`, no firmas o revisiones reales. Comprueban 24 frente a 23, 30/30 con fallo crítico, revisor duplicado o igual al autor, agente fingido como humano, desacuerdos, salida cambiada tras revisar, corpus/rúbrica alterados, controles desconocidos, corrida incompleta, QA ausente, modo simulado etiquetado indebidamente como real y eliminación fraudulenta de pendientes en el reporte. Un caso pendiente en el corpus no puede convertirse en evaluado borrando su campo en el informe.

El template real no tiene reviews/resolutions ni QA. Su consolidado mantiene bloqueos `rubric_pending`, `real_provider_pending`, `qa_pending`, `cases_pending` y `below_24_of_30`. El conteo de confirmados es cero porque nadie los ha revisado; no significa que un ensayo real haya obtenido cero pertinencia.

Durante desarrollo, el arnés detectó tablas faltantes por cargar modelos después de sync y los hooks de revocación sin tablas del puente. Se corrigió el montaje cargando esos modelos antes, sin tocar producto. También se corrigió que el hook de salida de embedded-postgres podía ocultar el exit no cero de una corrida fallida: se verifica ahora con la corrida truncada, que devuelve 1 después de limpiar sus recursos. No se cambiaron resultados esperados para pasar.

## Seguridad, reproducción y pendientes

Reproducción detallada y formato de revisiones en `backend/evaluation/es44/README.md`. No lee `.env`/DATABASE_URL de usuario; DB creada en directorio temporal generado y loopback. Claves/JWT aleatorios solo en RAM, proveedor sustituido antes de cargar módulos; cero correos, ofertas o datos del piloto. Sin endpoint de evaluación público ni lectura nueva para facilitadores. Reportes fuera de telemetría general, sin credenciales; hashes de prompts en lugar de sus contenidos completos.

Pendientes para la HU integral:

1. Alejo/especialista revisan casos, criterios y rúbrica final, incluido inglés; designan dos revisores humanos distintos del autor por caso y Mauricio para discrepancias.
2. Contratos/motores de rutas y plan ES-32/33 y parser de archivo cuando corresponda. Al completarlos habrá que versionar corpus/expectativas y repetir evaluación; no marcar sus etapas como realizadas desde este PR.
3. Plan y autorización concretos de corrida Claude real: modelo/parametrización acordados, catálogos adecuados, presupuesto y límites. Tarifas verificadas o costo desconocido, nunca inventado.
4. Revisiones técnicas/QA, corrida integral con sus resultados, revisión humana de todos los casos y puerta >=24/30 sin fallos críticos antes de invitaciones. Sin calidad real aprobada, ninguna activación del piloto.

Se conservan seis vulnerabilidades moderadas conocidas del backend (`@google-cloud/storage`, `gaxios`, `retry-request`, `sequelize`, `teeny-request`, `uuid`); no se cambian dependencias en esta HU. No se probaron staging/producción, datos de personas reales o Claude real. No se fusiona ni se cierran hilos de QA desde Dev.

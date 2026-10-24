# Elevation + Skill Map — índice de definiciones

22-oct-2026 · Paquete conciliado para revisión técnica y QA. Esta rama propone el índice aprobado por Alejo; será referencia publicada cuando se apruebe el PR y Mauricio lo fusione a main. No acredita implementación ni despliegue.

## Mauricio: empieza aquí

1. [PRD conciliado, sección 0](02-PRD.md): corte 1, incremento 1 y piloto integral; después RF-01 a RF-17.
2. [Registro de acuerdos V-01 a V-21 y alcance A-01](08-REGISTRO-VALIDACION-CTO.md): qué aprobó Alejo y qué sigue pendiente.
3. [Arquitectura y ADRs](10-ARQUITECTURA-Y-ADRS.md): decisiones vinculadas, propuestas técnicas y puntos que debes revisar.
4. [Mapeo de HUs y pendientes](09-MAPEO-HUS-Y-PENDIENTES.md): correspondencia propuesta sin duplicar tickets.
5. [QA y aceptación](11-QA-Y-ACEPTACION.md): capas y puertas aprobadas; plan detallado aún pendiente.
6. [Operación y releases](12-OPERACION-Y-RELEASES.md): Railway, aislamiento, transición de 48 h y evidencia de despliegue.

## Cómo consultar la fuente de verdad

| Fuente | Define |
| --- | --- |
| PRD | Alcance y aceptación. |
| ADR | Decisión técnica, motivos y alternativas; distinguir estado propuesto/aprobado. |
| [Jira ES](https://iatech-team-xqxmjki1.atlassian.net/jira/software/projects/ES/boards/2) | Responsable, dependencias y estado de ejecución. |
| PR | Cambios, revisión y pruebas. |
| Registro de release | Commit y entorno efectivamente desplegados. |

Alejo aprueba alcance y prioridad; Mauricio arquitectura y operación; QA deja aceptación; Mauricio hace el merge después de QA. Cambios mixtos necesitan Alejo y Mauricio. Ante contradicción, registrar y resolver solo la parte afectada, indicando qué decisión se sustituye; actualizar las fuentes antes de continuar. No prevalece un comentario por ser el más reciente.

## Decisiones vigentes en este paquete

Express/Sequelize/Postgres y Claude; Railway con Supabase; incremento 1 con worker y Redis como transporte solo de IDs, durabilidad en Postgres; aislamiento técnico del worker; QA antes del merge y cero Altos/Críticos sin resolver; pruebas de calidad 30 casos (>=10 no técnicos, >=5 adversos, >=6 EN), >=24/30 pertinentes y justificados sin fallos críticos. Presupuesto de IA por definir.

Objetivo condicionado del corte 1: **27-oct-2026, 12:00 America/Bogota**. No es fecha del incremento funcional ni del piloto integral.

## Referencias y vigencia

- [PDF v0.3 original](references/Paquete_CTO_v0.3.pdf): PRD/RFC/ADRs propuestos, conservado sin alteraciones. Sus dudas sobre stack o dos bases se resuelven por las decisiones posteriores explícitas; no se aprueba íntegramente.
- [PRD v0.2 anotado](references/PRD-v0.2-anotado.md): antecedente; solo queda sustituido tras aprobación y merge de la versión conciliada.
- [Canvas](01-CANVAS-NEGOCIO.md), [plan de validación](03-VALIDACION-Y-FUENTES.md), [plan inicial de HUs](04-SPRINT-2-HUS.md): referencias históricas; no prevalecen sobre acuerdos posteriores. Estimaciones por recalibrar.
- [Overview para psicología](05-ONEPAGER-PSICOLOGO.md): propuesta de colaboración, no atención clínica contratada.
- [Agenda de preguntas](07-PREGUNTAS-CTO-Y-FUENTE-DE-VERDAD.md): material de trabajo anterior; las respuestas consolidadas están en el registro.
- [Flujo de desarrollo](06-JIRA-DESARROLLO.md): repositorio, ramas y estados.

PRs relacionados: [#1 reglas LLM](https://github.com/iatechdev/gpt-elevation-MVP/pull/1), [#2 ES-57](https://github.com/iatechdev/gpt-elevation-MVP/pull/2), [#3 Railway](https://github.com/iatechdev/gpt-elevation-MVP/pull/3). Su estado y sus checks deben consultarse en GitHub; este paquete no los aprueba ni fusiona.

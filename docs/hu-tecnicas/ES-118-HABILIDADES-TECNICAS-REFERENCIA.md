# ES-118 · Habilidades técnicas de PerfiladorV2: referencia para Alejo

> **Estado: BORRADOR SIN VERIFICAR.** Material de referencia; no es el catálogo. Se carga en el backoffice (ES-116) y Alejo o el especialista completan lo que falta antes de publicar.

## De dónde sale
Proyecto de Supabase **PerfiladorV2**, tabla `skill_taxonomy` (8 filas), consultada por Dev el 29-oct-2026 **en solo lectura**. Solo se copió la taxonomía (clave, dominio, nombre, descripción y anclas de la rúbrica). No se tocó ningún dato de personas (`developers`, `evaluation_signals`) ni se importó `seniority_benchmarks` / `gap_vs_target` (objetivos y distancias por seniority), que chocan con la regla de Elevation de no mostrar déficits ni comparar.

## Las 8 habilidades (escala original de PerfiladorV2: 1 a 5, anclas en 1, 3 y 5; texto original en inglés)
| Clave en Elevation | Nombre ES (traducción provisional) / EN | Dominio original | Descripción (original) | Anclas de la rúbrica original |
|---|---|---|---|---|
| `clean_architecture` | Arquitectura limpia / Clean Architecture | Architecture | Designs modular boundaries, keeps domain logic isolated, and applies dependency inversion pragmatically. | 1: Tangled responsibilities and framework-coupled domain logic · 3: Mostly separated layers with occasional leakage · 5: Clear boundaries, testable core, and pragmatic dependency direction |
| `system_design_scalability` | Diseño de sistemas y escalabilidad / System Design & Scalability | Architecture | Reasons about scale, trade-offs, data ownership, failure modes, and operational constraints. | 1: Proposes single-node or vague designs · 3: Covers basic scaling and persistence trade-offs · 5: Models load, consistency, resilience, observability, and cost trade-offs |
| `api_contracts` | Contratos de API / API Contracts | Backend | Designs stable API boundaries with validation, versioning, compatibility, and useful errors. | 1: Breaks clients with ad-hoc payloads · 3: Documents and validates core contracts · 5: Versioned contracts with compatibility and consumer-aware error design |
| `sql_optimization_concurrency` | Optimización SQL y concurrencia / SQL Optimization & Concurrency | Backend | Uses transactions, locking, indexing, query plans, and isolation levels to protect data correctness and performance. | 1: Unsafe string SQL or non-atomic updates · 3: Uses parameterized queries and basic transactions · 5: Handles isolation, locks, indexes, and contention deliberately |
| `code_review_rigor` | Rigor en la revisión de código / Code Review Rigor | Collaboration | Reviews code for correctness, maintainability, security, tests, and architectural fit. | 1: Reviews mostly style or approves superficially · 3: Finds correctness and maintainability issues · 5: Surfaces systemic risks and teaches through clear, actionable feedback |
| `observability_incidents` | Observabilidad e incidentes / Observability & Incidents | Operations | Designs logs, metrics, traces, alerts, and incident feedback loops for production systems. | 1: Debugs mostly by logs after failures · 3: Adds useful metrics and basic alerts · 5: Defines SLOs, traces critical flows, and improves systems after incidents |
| `testing_strategy` | Estrategia de pruebas / Testing Strategy | Quality | Balances unit, integration, contract, and edge-case tests around business risk. | 1: Little or no meaningful coverage · 3: Covers happy paths and important edge cases · 5: Risk-based test pyramid with deterministic integration and regression coverage |
| `owasp_input_validation` | Validación de entradas (OWASP) / OWASP Input Validation | Security | Prevents injection and unsafe input paths with validation, encoding, and least privilege. | 1: Trusts raw input or concatenates untrusted data · 3: Validates common cases and parameterizes queries · 5: Applies layered validation, safe encoding, and abuse-case thinking |

## Qué se carga y qué falta
| Dato | Estado |
|---|---|
| Clave, tipo `domain`, nombre EN | Tomado de PerfiladorV2 (la clave en minúsculas) |
| Nombre ES | **Traducción provisional de Dev**: Alejo la valida |
| Territorio | **Provisional**: todas en «Ingeniería y Sistemas» (PerfiladorV2 no tiene territorios); Alejo la corrige |
| Criterios de los niveles 1 a 4 (ES y EN) | **Falta**. La escala original es de 1 a 5 con anclas en 1, 3 y 5; no se convierte automáticamente ni se inventan los niveles 2 y 4. Alejo o el especialista los escriben (las anclas de arriba sirven de punto de partida) |
| Fuente, verificador y fecha | **Falta** (los completa quien verifica) |
| Descripción | El catálogo de Elevation hoy **no tiene campo de descripción**: queda aquí como referencia. Si se quiere mostrar, hay que añadir el campo (cambio de backend y pantalla, historia aparte) |

## Cómo se carga
1. **Orden recomendado:** primero publicar la versión del catálogo con los territorios; después abrir el borrador de las técnicas. **Publicar exige todas las habilidades completas**: un borrador con estas 8 incompletas bloquea publicar cualquier otro cambio.
2. Con confirmación de Mauricio, en el entorno destino: `cd backend && DATABASE_URL='<destino>' node scripts/seedSkillCatalogTechnicalDraft.js`. Crea un borrador copiando el catálogo vigente y añade las 8 claves nuevas; se niega, sin escribir nada, si alguna ya existe o si hay un borrador abierto. Nunca publica.
3. Alejo abre el borrador en «Catálogo de habilidades», completa cada habilidad (la pantalla muestra «Falta: N») y publica cuando no falte nada.
4. Alternativa sin script: añadirlas a mano desde la pantalla con «Añadir habilidad».

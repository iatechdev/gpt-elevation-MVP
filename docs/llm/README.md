# Agentes LLM del proyecto Elevation + Skill Map

Reglas y arranque de los agentes que trabajan en este repositorio (Dev-Claude, Dev-Codex, QA-Claude e Infra-Claude).

| Archivo | Para qué sirve |
|---|---|
| [`PROMPTS-LLM-ES.md`](PROMPTS-LLM-ES.md) | Reglas fijas: contexto común y rol de cada agente. Es la fuente de los dos archivos de la raíz. |
| [`KICKOFF-LLM-ES.md`](KICKOFF-LLM-ES.md) | Estado del ambiente al 21-oct-2026, lista previa, orden de arranque y primer mensaje de cada sesión. |
| [`../../CLAUDE.md`](../../CLAUDE.md) | Instrucciones que leen las sesiones de Claude Code (contexto común + roles Infra, QA y Dev). |
| [`../../AGENTS.md`](../../AGENTS.md) | Instrucciones que lee Codex (contexto común + rol Dev full-stack). |

`CLAUDE.md` y `AGENTS.md` deben quedar en la raíz del repositorio para que las herramientas los encuentren. Se derivan de los bloques de
`PROMPTS-LLM-ES.md`: si cambia un rol, se actualizan los tres archivos.

El tablero de trabajo está en Jira (proyecto ES). Esta carpeta es la fuente de verdad de las reglas; Jira enlaza aquí.

# Desarrollo, Jira y evidencia

Definiciones consolidadas el 22-oct-2026. Consultar [índice](00-LEEME.md) y ticket vigente antes de implementar.

- Repo central: `iatechdev/gpt-elevation-MVP`. Nuevas ramas desde main; clave ES en rama, commit y PR. Actualizar ramas mediante merge de origin/main, sin reescribir ramas compartidas.
- La base autorizada es main; esto no incorpora código de PRs aún abiertos. Si falta una dependencia, registrarla antes de implementar. Preservar WIP ajeno.
- El [mapeo](09-MAPEO-HUS-Y-PENDIENTES.md) es propuesta documental, no creación de tickets ni cambio de responsables.
- Por hacer → En DEV → En QA → En despliegue → Listo. Leer ticket y transiciones disponibles antes de cada actualización. No cerrar una HU por escribir un documento o por un test con dobles.
- PR con alcance, criterios cubiertos, resultados reales, riesgos y límites de verificación. QA acepta; Mauricio realiza el merge. Altos/Críticos corregidos y validados antes del merge y producción.
- Comentarios de Codex firmados `[Dev-Codex]`; registrar evidencias sin conversaciones, credenciales o datos personales. No afirmar que existe sincronización automática permanente entre Jira y GitHub.
- Alejo con Codex prepara el PR documental; Mauricio revisa coherencia técnica. La revisión humana especializada no se sustituye con IA.
- Los cambios de frontend requieren el diseño y revisión que exija el ticket y las instrucciones aprobadas del repositorio; este PR documental no implementa pantallas.

La conexión MCP del IDE es una capacidad operativa, no evidencia de que una HU esté implementada. Este paquete no modifica estados de Jira ni configura conectores o infraestructura.

# Elevation — Hoja de Ruta de Producto (Roadmap)

> **Fuente oficial:** Migrado desde Google Drive. Última actualización: Marzo 2026.

---

## Fase 1: MVP Core ✅ (Completado)

**Objetivo:** Validar la interacción del usuario con la IA y establecer una arquitectura técnica segura.

| Módulo | Estado |
|--------|--------|
| Interfaz de usuario minimalista y responsiva | ✅ |
| Autenticación (email/password + OAuth) con seguridad OWASP | ✅ |
| Motor de IA con proxy seguro (API key nunca en frontend) | ✅ |
| Anonimización de PII antes de enviar al LLM | ✅ |
| Sistema de sesiones con mood pre/post | ✅ |
| Protocolo de detección de crisis | ✅ |
| Sistema de reflexiones con etiquetas | ✅ |
| Insights con gráficos de evolución emocional | ✅ |
| Recordatorios personalizados | ✅ |
| Exportación CSV + PDF | ✅ |
| Derecho al olvido | ✅ |
| Panel admin de configuración del acompañante | ✅ |
| 56 tests Vitest pasando | ✅ |

---

## Fase 2: MVP de Datos y Escalabilidad 🔄 (En progreso — Q2 2026)

**Objetivo:** Reducir fricción de entrada y extraer valor analítico para el bienestar.

| Módulo | Estado | HU Relacionada |
|--------|--------|----------------|
| Check-in de ánimo obligatorio antes del chat (RN-004) | ⏳ Pendiente | HU-020 |
| Check-out de ánimo al finalizar conversación (RN-005) | ⏳ Pendiente | HU-021 |
| Calificación de experiencia con estrellas (RN-009) | ⏳ Pendiente | HU-022 |
| Búsqueda de reflexiones por palabra clave (RN-015) | ⏳ Pendiente | HU-023 |
| Bloqueo de acceso tras 3 intentos fallidos (RN-002) | ⏳ Pendiente | HU-024 |
| Pantalla de bienvenida primer acceso (RN-003) | ⏳ Pendiente | HU-025 |
| Scroll automático en chat (UX) | ⏳ Pendiente | HU-026 |
| Dashboard B2B corporativo (métricas anónimas) | ⏳ Pendiente | HU-016 |
| Bot de Telegram | 🔄 En progreso | HU-017 |
| Refinamiento del prompt ACT basado en datos reales | ⏳ Pendiente | PROMPT-007 |

---

## Fase 3: Escalabilidad B2B (Q3-Q4 2026)

**Objetivo:** Plataforma SaaS multi-empresa con panel corporativo completo.

| Módulo | Estado |
|--------|--------|
| Multi-tenancy (una instancia por empresa cliente) | 📋 Planificado |
| SSO corporativo (Google Workspace, Microsoft 365) | 📋 Planificado |
| Dashboard ejecutivo con métricas de bienestar por equipo | 📋 Planificado |
| API pública para integración con HRIS corporativos | 📋 Planificado |
| Módulo de directorio de profesionales de salud mental | 📋 Planificado |
| App móvil nativa (iOS + Android) | 📋 Planificado |

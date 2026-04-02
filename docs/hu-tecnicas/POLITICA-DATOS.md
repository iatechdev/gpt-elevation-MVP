# Elevation — Política de Datos
> Documentada: 2 de abril de 2026
> Autores: Claude (Tech Lead AI) + Mauro Roldán
> Referencia: MANIFIESTO-ETICO-v1.md

---

## 1. Almacenamiento de datos

### Infraestructura
- **Proveedor:** Google Cloud SQL (PostgreSQL)
- **Región:** `us-central1` (Iowa, Estados Unidos)
- **Encriptación en tránsito:** SSL/TLS obligatorio en todas las conexiones
- **Encriptación en reposo (a nivel de aplicación):** AES-256-CBC para datos sensibles

### Tablas y qué contienen

| Tabla | Contenido | Encriptación |
|---|---|---|
| `Users` | Nombre, email, rol, estado | En claro — necesario para login y búsquedas |
| `Messages` | Conversaciones con la IA de Elevation | ✅ AES-256 — ilegibles en BD |
| `MoodLogs` | Check-in y check-out emocional | En claro — valores numéricos 1-5 |
| `SessionRatings` | Calificación de sesiones 1-5 | En claro — valores numéricos |
| `PromptVaults` | Prompts del sistema | ✅ AES-256 — ilegibles en BD |
| `LandingContent` | Contenido de páginas públicas | En claro — contenido público |
| `ClinicalNotes` (Sprint 5) | Notas clínicas del terapeuta | ✅ AES-256 — ilegibles en BD |
| `WellnessRecommendations` (Sprint 5) | Recomendaciones IA de bienestar | ✅ AES-256 — ilegibles en BD |

---

## 2. Separación de espacios: IA vs Terapeuta Humano

Elevation opera con dos espacios **completamente separados e independientes:**

### Espacio 1 — Conversaciones con la IA de Elevation
- Almacenadas en tabla `Messages`
- Encriptadas con AES-256 — solo la aplicación puede leerlas
- **El terapeuta NO tiene acceso a estas conversaciones bajo ninguna circunstancia por defecto**
- El usuario es el único que puede decidir compartir capturas de pantalla con su terapeuta voluntariamente

### Espacio 2 — Historia clínica con el terapeuta humano
- Almacenada en tabla `ClinicalNotes` (Sprint 5)
- Notas escritas por el terapeuta sobre el paciente
- Encriptadas con AES-256
- **La IA de Elevation NO tiene acceso a estas notas**
- Solo el terapeuta asignado puede leer las notas de sus pacientes

### Regla de oro
```
Conversaciones IA  ←→  Historia clínica con terapeuta
        ↑                          ↑
   Espacios NUNCA se mezclan automáticamente
   Solo el usuario decide si comparte algo entre ellos
```

---

## 3. Acceso del terapeuta al historial del usuario

| Información | ¿Puede verla el terapeuta? | Condición |
|---|---|---|
| Conversaciones con la IA | ❌ NUNCA por defecto | — |
| Capturas que el usuario comparte | ✅ Sí | Solo si el usuario las comparte voluntariamente |
| Historial emocional (mood check-in/out) | ✅ Sí | Siempre — es parte del dashboard del terapeuta |
| Ratings de sesión | ✅ Sí | Siempre — es parte del dashboard del terapeuta |
| Notas clínicas propias | ✅ Sí | Solo las notas que él mismo escribió |
| Notas de un terapeuta anterior | ✅ Sí | Solo en caso de reasignación formal aprobada por la Junta |
| Investigación por la Junta Ética | ✅ Sí | Solo con proceso formal documentado ante caso grave |

### Cambio de terapeuta
Cuando un usuario cambia de terapeuta:
- El **historial emocional** (mood logs, ratings) sí es visible para el nuevo terapeuta
- Las **notas clínicas** del terapeuta anterior son visibles para el nuevo terapeuta — el paciente no pierde su historia clínica
- Las **conversaciones con la IA** siguen siendo privadas — nunca accesibles para ningún terapeuta

---

## 4. Retención de datos

| Situación | Tiempo de retención |
|---|---|
| Membresía activa | Indefinido mientras la membresía esté activa |
| Membresía cancelada | 3 meses adicionales post-cancelación |
| Solicitud de eliminación por el usuario | Eliminación completa e irreversible — sin copias ocultas |

### Implementación técnica pendiente
- **Estado actual:** La política está definida pero el job automático de limpieza aún no está implementado
- **Sprint pendiente:** Crear un proceso programado que elimine datos de usuarios inactivos después de 3 meses
- **Solicitud manual:** El usuario puede pedir eliminación contactando soporte — se ejecuta manualmente hasta que el proceso automático esté implementado

---

## 5. Uso de datos para IA e investigación

### Lo que SÍ hacemos
- Medimos el **impacto de los prompts en el bienestar** — comparando mood check-in vs check-out de forma agregada y anónima
- Esto permite evaluar si un prompt terapéutico está ayudando a los usuarios
- Los datos son **agregados y nunca vinculados a un usuario específico** en este análisis

### Lo que NO hacemos
- ❌ No usamos conversaciones individuales para entrenar modelos de IA
- ❌ No vendemos datos a terceros
- ❌ No creamos perfiles comerciales basados en información emocional
- ❌ No realizamos investigación con datos identificables sin consentimiento explícito y separado

### Relación con Anthropic (proveedor de la IA)
- Las conversaciones pasan por la API de Anthropic para generar respuestas
- **Anthropic NO usa los datos de la API para entrenar sus modelos** — esto está garantizado en el contrato de API estándar de Anthropic
- Referencia: [Anthropic API Terms of Service](https://www.anthropic.com/policies/api-terms)

---

## 6. Variables de entorno y secretos

Los siguientes secretos nunca deben estar en el código fuente:

| Variable | Uso | Estado |
|---|---|---|
| `JWT_SECRET` | Firma de tokens de sesión | ✅ En `.env` — nunca en código |
| `ANTHROPIC_API_KEY` | Acceso a la API de Claude | ✅ En `.env` — nunca en código |
| `DB_PASS` | Clave AES-256 para encriptación | ✅ En `.env` — nunca en código |
| `DATABASE_URL` | Conexión a Cloud SQL | ✅ En `.env` — nunca en código |

**Regla:** Si un secreto aparece hardcodeado en el código, es un bug de seguridad crítico.

---

## 7. Preguntas frecuentes del equipo técnico

**¿Por qué encriptamos los mensajes si ya tenemos SSL?**
SSL protege los datos en tránsito (de la app al servidor). La encriptación AES-256 protege los datos en reposo (en la base de datos). Si alguien obtiene acceso directo a la BD, los mensajes siguen siendo ilegibles.

**¿Por qué el email no está encriptado?**
El email es necesario para buscar usuarios en el login (`WHERE email = ?`). Encriptarlo rompería las búsquedas. La protección del email viene del control de acceso a la BD, no de la encriptación a nivel de campo.

**¿Qué pasa si perdemos la clave AES (`DB_PASS`)?**
Los datos encriptados se vuelven irrecuperables. Por eso `DB_PASS` debe estar en Google Secret Manager en producción y tener backup seguro. Esto es una acción pendiente para el hardening de producción.

**¿Los admins pueden ver las conversaciones de los usuarios?**
No. Los mensajes están encriptados en la BD y solo se desencriptan en el contexto del usuario autenticado. Un admin con acceso al backoffice no ve las conversaciones — solo ve métricas agregadas.

---

## 8. Cumplimiento normativo

| Regulación | Jurisdicción | Estado |
|---|---|---|
| GDPR | Unión Europea | Política definida — implementación en progreso |
| HIPAA | Estados Unidos | Política definida — implementación en progreso |
| Ley 1581 de 2012 | Colombia | Política definida — implementación en progreso |

*Nota: La certificación formal (ISO 27001, SOC 2) está en evaluación y se implementará según el crecimiento de la plataforma.*

---

*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Referencia directa: MANIFIESTO-ETICO-v1.md*

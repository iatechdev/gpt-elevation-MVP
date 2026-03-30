# Elevation — Junta de Elevation y Marco Ético
> Documentado: 30 de marzo de 2026
> Autor: Claude (Tech Lead AI) + Mauro Roldán + Alejo Roldán

---

## ¿Qué es la Junta de Elevation?

La Junta de Elevation es el órgano de validación, ética y calidad de la plataforma. No es un rol técnico — es un cuerpo humano compuesto por profesionales de salud mental, ética y tecnología que garantiza que Elevation opere con los más altos estándares.

### Sus tres funciones principales

**1. Validación académica de terapeutas**
Ningún terapeuta puede activarse en Elevation sin pasar por la Junta. La Junta verifica:
- Certificaciones académicas y títulos profesionales
- Corrientes terapéuticas que puede ejercer
- Temas específicos que está habilitado para trabajar
- Experiencia demostrable en su especialidad

**2. Revisión y aprobación de prompts terapéuticos**
Cada prompt que un terapeuta propone pasa por dos filtros:
1. Filtro técnico: el superadmin verifica que funcione correctamente con la IA
2. Filtro ético: la Junta verifica que el prompt esté alineado con el Manifiesto Ético de Elevation

La Junta también ofrece **templates de prompts** para terapeutas que no tienen experiencia con IA, permitiendo que cualquier profesional calificado pueda integrarse a la plataforma sin conocimiento previo de inteligencia artificial.

**3. Jurado ético de la plataforma**
La Junta actúa como guardián permanente de lo que ocurre en Elevation:
- Revisa casos reportados de uso inapropiado
- Puede suspender a un terapeuta si detecta conductas contrarias al Manifiesto
- Propone actualizaciones al Manifiesto según evoluciona la plataforma
- Revisa incidentes donde la IA haya respondido de forma inapropiada

---

## El Manifiesto Ético de Elevation

El Manifiesto es un documento vivo que define los principios no negociables de la plataforma. Vive en el backoffice y puede ser actualizado por la Junta con aprobación del superadmin.

### Principios fundacionales (versión 1.0)

**1. Autonomía del usuario**
Elevation nunca toma decisiones por el usuario. La IA y los terapeutas acompañan, sugieren y orientan — nunca dirigen ni controlan. El usuario siempre tiene la última palabra sobre su proceso.

**2. No manipulación**
Ningún prompt en Elevation puede estar diseñado para crear dependencia, manipular emociones con fines comerciales, o influir sobre el usuario más allá de su bienestar. Cualquier prompt que viole este principio será rechazado inmediatamente.

**3. Transparencia**
El usuario siempre sabe que está hablando con una IA. Elevation nunca finge ser humana. Los terapeutas son presentados con sus credenciales reales y verificadas.

**4. Privacidad absoluta**
Las conversaciones del usuario son suyas. Ningún terapeuta puede leer las conversaciones privadas del usuario con la IA sin su consentimiento explícito. Los datos nunca se venden ni comparten con terceros.

**5. Evidencia y rigor académico**
Todas las corrientes terapéuticas en Elevation deben tener respaldo académico o práctica profesional demostrable. No se admiten enfoques pseudocientíficos o que puedan generar daño.

**6. Diversidad de enfoques**
Elevation reconoce que el bienestar tiene múltiples caminos. Se admiten enfoques diversos — desde la TCC hasta el tantra — siempre que cumplan con los principios anteriores.

**7. Protección de poblaciones vulnerables**
Elevation tiene protocolos especiales para usuarios en crisis. La IA siempre redirige a recursos de emergencia cuando detecta riesgo. Ningún prompt puede desactivar estos protocolos.

---

## El rol `junta` en la plataforma

La Junta de Elevation tendrá su propio rol en el sistema:

| Función | Junta | Superadmin |
|---|---|---|
| Validar certificaciones de terapeutas | ✅ | ❌ |
| Aprobar corrientes terapéuticas | ✅ | ❌ |
| Revisar prompts desde perspectiva ética | ✅ | ❌ |
| Aprobar prompts técnicamente | ❌ | ✅ |
| Actualizar el Manifiesto Ético | ✅ propone | ✅ aprueba |
| Suspender terapeutas | ✅ propone | ✅ ejecuta |
| Ver métricas de la plataforma | ✅ | ✅ |
| Gestionar usuarios técnicos | ❌ | ✅ |

---

## Flujo de activación de un terapeuta

```
1. Terapeuta solicita ingreso a Elevation
   → Llena formulario con datos académicos y especializaciones

2. Superadmin crea la cuenta del terapeuta (inactiva)

3. La Junta revisa las certificaciones
   → Aprueba: el terapeuta puede proponer su prompt
   → Rechaza: se notifica al terapeuta con razón

4. Terapeuta propone su prompt terapéutico
   (o usa un template de la Junta si no tiene experiencia con IA)

5. Revisión en paralelo:
   → Superadmin: revisa funcionamiento técnico del prompt
   → Junta: revisa alineación con el Manifiesto Ético

6. Ambos aprueban → terapeuta se activa en la plataforma
   Alguno rechaza → terapeuta recibe feedback y puede proponer ajustes

7. Terapeuta activo puede recibir pacientes asignados
```

---

## Templates de prompts para terapeutas

La Junta mantiene una biblioteca de templates para diferentes corrientes:

```
template_mayeutica
template_tcc
template_dbt
template_mindfulness
template_motivacion_disciplina
template_tantra_bienestar_sexual
template_coaching_vital
[...]
```

Cada template es un prompt base ya aprobado por la Junta que el terapeuta puede:
- Usar tal cual
- Personalizar con su enfoque específico (requiere re-aprobación)

---

## Sobre videollamadas — decisión técnica

**Google Meet en iframe no es posible** — Google lo bloquea por política de seguridad en todos los navegadores modernos.

**Solución propuesta para Sprint 6:**
- **Agendamiento:** Integración con Google Calendar API — el terapeuta agenda la sesión desde Elevation, se crea el evento automáticamente en ambos calendarios
- **Videollamada:** Daily.co o Jitsi Meet — ambos permiten iframe dentro de Elevation, son open source y de alta calidad
- **Experiencia del usuario:** El botón "Unirse a la sesión" abre la videollamada dentro de Elevation sin salir de la app
- **Post-sesión:** El usuario puede dejar su estado emocional y notas justo después de la llamada, sin salir de la plataforma

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán + Alejo Roldán*

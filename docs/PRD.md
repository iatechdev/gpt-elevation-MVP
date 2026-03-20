# PRD: Elevation — Espacio de Bienestar y Reflexión Personal

> **Fuente oficial:** Este documento es la migración del PRD original de Google Drive al repositorio.
> A partir de ahora, este archivo es la fuente de verdad del producto.

---

## 1. Resumen Ejecutivo

### Problema

Los jóvenes y adultos entre 18-45 años en Paraguay experimentan altos niveles de estrés, soledad y sobrecarga emocional sin espacios seguros para procesar sus pensamientos.

**Ejemplos concretos:**
- Lucía (28) llega a casa angustiada por una discusión con su jefe, sin nadie con quien hablar sin sentirse juzgada.
- Martín (34) necesita ordenar sus ideas antes de tener una conversación difícil con su pareja, pero no sabe por dónde empezar.
- Ana (22) se siente abrumada por la soledad un domingo a la noche, con sus amigos ocupados.

### Propuesta de Valor

Elevation es un espacio de refugio personal donde cualquier persona puede explorar sus pensamientos y emociones a través del diálogo reflexivo, sin juicio ni agenda, acompañado por una presencia que ayuda a desplegar el pensamiento con calma.

### Impacto Esperado

- 70% de usuarios reportan mejoría en su estado de ánimo (entrada vs salida)
- 60% de usuarios regresan al menos 2 veces en la primera semana
- 50% califican la experiencia con 4 o 5 estrellas
- 40% guardan al menos una reflexión significativa por sesión

---

## 2. Objetivos de Producto (SMART)

| ID | Objetivo | Meta |
|----|----------|------|
| O1 | Validar propuesta de valor | 100 usuarios completan al menos 1 conversación en 4 semanas |
| O2 | Generar bienestar medible | 70% reportan igual o mejor ánimo al salir vs entrar |
| O3 | Crear hábito de reflexión | 40% de usuarios activos regresan 2+ veces en su primera semana |
| O4 | Capturar valor percibido | Calificación promedio 4.0/5.0 |

### KPIs con Targets

| Métrica | Target Semana 2 | Target Semana 4 |
|---------|----------------|-----------------|
| Usuarios registrados | 50 | 100 |
| Tasa de completación 1ª conversación | 60% | 70% |
| Mejora en estado de ánimo | 65% | 70% |
| Usuarios que regresan 2+ veces | 30% | 40% |
| Calificación promedio | 3.8/5 | 4.0/5 |
| Reflexiones guardadas por usuario activo | 0.8 | 1.2 |

### Hipótesis a Validar

- **H1:** Si los usuarios registran su estado de ánimo antes y después de conversar, el 70% reportará mejoría o estabilidad.
- **H2:** Si Elevation mantiene un tono sereno y sin agenda, los usuarios calificarán con 4+ estrellas en el 60% de los casos.
- **H3:** Si los usuarios pueden guardar reflexiones significativas, el 50% guardará al menos una en su primera sesión.
- **H4:** Si el diario emocional muestra patrones visuales claros, el 40% lo consultará al menos 1 vez por semana.

---

## 3. Usuarios y Necesidades

### Usuario Primario: El Reflexivo en Búsqueda

**Persona: Lucía Martínez**
- 28 años, coordinadora de proyectos, empresa mediana
- Vive sola en Asunción, familia en el interior
- Trabaja 9+ horas diarias
- Tiende a guardarse sus preocupaciones para no "molestar"

**Jobs to Be Done:**
- "Necesito procesar lo que siento sin que alguien me diga qué hacer"
- "Quiero preparar conversaciones difíciles antes de tenerlas"
- "Necesito calmar mi mente antes de dormir"

**Momento Clave:** Domingo 10pm, ansiosa por la semana que viene, no quiere llamar a nadie. Abre Instagram, se siente peor. Necesita *algo*.

---

### Usuario Secundario: El Sobrecargado Emocional

**Persona: Martín Benítez**
- 34 años, emprendedor (cafetería), casado, 1 hijo de 3 años
- Le cuesta expresar vulnerabilidad ("tiene que ser fuerte")

**Jobs to Be Done:**
- "Necesito un espacio para admitir que estoy cansado sin sentirme débil"
- "Quiero ensayar cómo hablar con mi esposa sobre temas delicados"

**Momento Clave:** Jueves 11pm, cierra la cafetería después de un día difícil. Llega a casa, su esposa ya durmió. Necesita desahogarse.

---

## 4. Reglas de Negocio

### 4.1 Registro y Acceso

**RN-001: Requisitos de Registro**
- Todo usuario debe registrarse antes de acceder
- Datos mínimos: nombre, correo electrónico, contraseña (mín. 8 caracteres)
- No se requiere verificación de correo para el MVP
- Un usuario = un correo único
- Si el correo ya existe: *"Este correo ya está registrado. ¿Olvidaste tu contraseña?"*

**RN-002: Inicio de Sesión**
- Después de 3 intentos fallidos → bloqueo de 15 minutos
- Mensaje: *"Por seguridad, espera 15 minutos antes de intentar nuevamente"*

**RN-003: Primera Experiencia**
- Pantalla de bienvenida solo en el primer acceso (máx. 3 oraciones)
- El usuario puede saltarla
- Solo se muestra una vez

### 4.2 Estados de Ánimo

**RN-004: Check-in de Entrada (OBLIGATORIO)**
- Cada nueva conversación REQUIERE check-in de ánimo antes de chatear
- Pregunta: *"¿Cómo llegas hoy?"* (tono cálido)
- Opciones: 😊 Bien (4) · 🙂 Tranquilo (3) · 😐 Neutral (2) · 😔 Inquieto (1) · 😞 Mal (0)
- El botón "Comenzar" está bloqueado hasta que se seleccione una opción
- Se registra: fecha, hora, valor numérico

**RN-005: Check-out de Salida (OPCIONAL)**
- Al finalizar conversación: *"¿Cómo te sientes ahora?"*
- Mismas 5 opciones
- Si el usuario cierra sin finalizar → salida queda NULL

**RN-006: Comparación de Estados**
- Cálculo: Salida - Entrada → positivo = mejoría, 0 = estabilidad, negativo = desmejora
- El usuario NO ve números, solo emojis
- Los datos alimentan métricas internas

**RN-007: Frecuencia**
- Sin límite de conversaciones por día
- Cada conversación = 1 par de estados (entrada + salida opcional)

### 4.3 Conversaciones

**RN-008: Una Conversación Activa**
- Solo 1 conversación activa por usuario a la vez
- Si regresa con conversación abierta: *"¿Quieres continuar donde lo dejaste o empezar de nuevo?"*

**RN-009: Finalización**
- Se finaliza cuando: usuario presiona "Finalizar" O no interactúa por 24 horas
- Al finalizar → check-out de ánimo → calificación 1-5 estrellas (opcional)

**RN-010: Límites del MVP**
- Sin límite de mensajes por conversación
- Sin límite de tiempo por conversación
- El sistema NO interrumpe al usuario

**RN-011: Tono y Comportamiento de Elevation**
- ❌ NUNCA da consejos directos ("deberías hacer X")
- ✅ Usa preguntas abiertas para profundizar
- ✅ Valida emociones sin minimizarlas
- ✅ Sostiene pausas, no llena espacios con texto innecesario
- ❌ NO usa emojis
- ✅ Escribe en párrafos cortos (máximo 3 líneas)
- ✅ Usa "tú" (cercanía) con serenidad

*Ejemplos correctos:*
- ✅ "Mencionás que sentís presión. ¿De dónde viene esa presión?"
- ✅ "Parece que hay algo importante en esa incomodidad. ¿Qué creés que te está mostrando?"
- ❌ "¡No te preocupes! Todo va a estar bien"
- ❌ "Deberías hacer ejercicio para sentirte mejor"

**RN-012: Protocolo de Crisis**
- Si Elevation detecta lenguaje de riesgo (suicidio, autolesión, violencia):
  1. Pausa el diálogo reflexivo
  2. Muestra mensaje de derivación
  3. Ofrece recursos profesionales locales
  4. Ofrece contactar persona de apoyo (si configurada)

*Mensaje de derivación:*
> "Lo que me contás me preocupa. Elevation no está diseñado para situaciones que requieren atención inmediata. Necesitás hablar con un profesional que pueda ayudarte realmente. ¿Te parece si te comparto algunos contactos?"

**RN-013: Límites de Elevation**
- NO diagnostica condiciones de salud mental
- NO recomienda medicación
- NO reemplaza terapia
- NO promete "curar" nada
- Cada 5 conversaciones incluye recordatorio sutil de sus límites

### 4.4 Reflexiones Guardadas

**RN-014: Guardar Reflexiones**
- El usuario puede guardar mensajes de Elevation O escribir reflexión propia
- Sin límite de reflexiones guardadas
- Cada reflexión: texto + fecha/hora + etiqueta opcional

**RN-015: Acceso a Reflexiones**
- Sección dedicada, ordenadas de más reciente a más antigua
- Búsqueda por palabra clave
- El usuario puede editar o eliminar sus reflexiones

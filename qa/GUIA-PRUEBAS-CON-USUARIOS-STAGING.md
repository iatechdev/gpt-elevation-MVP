# Elevation + Skill Map — Guía para pruebas con usuarios en staging

Preparada por QA-Claude-2 · 3-nov-2026 · Entorno de pruebas (no producción) · Todo dato es sintético.

## 1. Dónde probar

| | |
|---|---|
| **URL de staging** | https://backend-staging-e3a6.up.railway.app |
| Estado al preparar esta guía | La página responde (salud: 200). Staging equivale a `main`: lo que aún no se haya fusionado y desplegado no aparece. |
| Idiomas | Español e inglés (selector ES / EN arriba a la derecha). Prueben ambos. |
| Dispositivos | Computador y celular (el diseño es responsive). |

**Reglas para las personas probadoras**
1. Usen solo las cuentas de esta guía y datos inventados: no escriban información personal real, ni de clientes, ni de salud.
2. Es un entorno de pruebas: puede cambiar o reiniciarse sin aviso.
3. Anoten cada hallazgo con: cuenta usada, pantalla, pasos, qué esperaban, qué pasó y una captura (sin datos reales).
4. La contraseña de las cuentas se entrega por canal privado (WhatsApp/llamada). No va en Jira, GitHub, correo masivo ni en este documento.

## 2. De qué trata la plataforma

**Elevation** es un espacio de **acompañamiento emocional NO clínico** y autoconocimiento. Ayuda a una persona a ordenar lo que piensa y siente mediante una conversación reflexiva con una IA (Claude), un diario y herramientas de reflexión, sin juicio y sin decirle qué hacer.

**Skill Map** conecta ese autoconocimiento con la vida profesional: la persona registra evidencia de lo que ha hecho, obtiene un **mapa de competencias**, explora **rutas de carrera** y diseña **pequeños experimentos** para avanzar. Está pensado para personas en **reconversión profesional**. El piloto es de seis personas (cinco en español, una en inglés).

**Lo que Elevation NO es (reglas no negociables del producto)**
- No diagnostica, no prescribe, no hace promesas terapéuticas ni de empleabilidad. No reemplaza a un profesional de salud mental.
- Privacidad: las conversaciones y el diario son privados de su dueño. Un profesional solo ve lo que la persona decide compartir (consentimiento, revocable). Ninguna señal de crisis se comparte con terceros.
- No inventa datos: si no hay evidencia, el nivel de una competencia queda vacío («sin evaluar»), no se rellena.
- Textos de usuario siempre en español (tuteo) e inglés.

**Módulos que verán** (el estado visible en la página principal puede decir «Disponible» o «En preparación»; si algo se ve «En preparación», es esperado):
| Módulo | Para qué sirve |
|---|---|
| Conversación (chat) | Dialogar con la IA; tiene un límite de uso por persona y avisa cuándo se renueva. |
| Diario | Escribir entradas con fecha; paso «Al Puente» para decidir qué compartir con un profesional. |
| Brújula | Reflexión guiada sobre valores y dirección. |
| Skill Map | Evidencia → competencias → mapa; rutas de carrera y experimentos («Siguiente paso»). |
| Ejercicios | Prácticas guiadas bilingües. |
| Mis datos | Exportar los propios datos y solicitar eliminar la cuenta (si está habilitado en staging). |
| Mi terapeuta / Puente | Vínculo con un profesional y qué se comparte con él. |
| Panel de profesional (`/facilitation`) | Lo que ve un terapeuta de sus personas asignadas. |
| Panel de administración (`/admin`) | Usuarios, contenidos, prompts, métricas y catálogos. |

## 3. Las 4 cuentas de prueba (una por rol)

| # | Rol | Correo (sintético) | Qué puede hacer |
|---|---|---|---|
| 1 | **Persona** (`user`) | qa.persona@example.test | Todo el espacio personal: chat, diario, Skill Map, rutas, datos propios. Está asignada al terapeuta de prueba. |
| 2 | **Terapeuta / profesional** (`therapist`) | qa.terapeuta@example.test | Ver solo a sus personas asignadas y solo lo que ellas comparten. No ve conversaciones ni diario privados. |
| 3 | **Administrador** (`admin`) | qa.admin@example.test | Crear y gestionar personas y terapeutas, contenidos y prompts. No crea ni promueve administradores. |
| 4 | **Superadmin** (`superadmin`) | qa.superadmin@example.test | Todo lo anterior más cuentas privilegiadas y configuración global. |

Contraseña: la define quien crea las cuentas y se entrega en privado (ver sección 6). Las cuentas usan `example.test`: **no reciben correos** (no hay recuperación de contraseña por correo; es una función pendiente).

## 4. Qué probar con cada cuenta

**Persona (ES y EN)**
1. Entrar, completar la presentación inicial (onboarding) y revisar el panel.
2. Conversación: escribir 3–4 mensajes. Verificar tono respetuoso, sin diagnósticos ni promesas. Si aparece el aviso de límite, debe indicar cuándo se renueva y estar en el idioma activo.
3. Diario: «Nueva entrada» debe traer la fecha de hoy; guardar, editar y volver a abrir.
4. Skill Map: agregar una evidencia (algo que la persona hizo), ver cómo aparece la competencia y que **no se inventan niveles** donde no hay evidencia.
5. Rutas / siguiente paso: explorar una ruta, crear un experimento y ver el plan.
6. Mis datos: exportar y revisar que solo trae sus propios datos.
7. Cerrar sesión desde cualquier pantalla.
8. Cambiar el idioma a mitad de camino: nada debe quedar a medias ni verse con claves crudas.

**Terapeuta**
1. Entrar; debe ver únicamente a «QA Persona».
2. Confirmar que **no** puede abrir su chat ni su diario; solo lo que ella decida compartir en el Puente.
3. Intentar abrir a una persona no asignada (cambiando el número en la URL): debe negarse.

**Administrador**
1. Crear una persona y un terapeuta de prueba nuevos; asignar la persona al terapeuta.
2. Intentar crear un administrador: debe negarse (solo el superadmin).
3. Revisar contenidos (landing), prompts y métricas; desactivar y reactivar una cuenta de prueba.

**Superadmin**
1. Crear un administrador de prueba y volverlo a desactivar.
2. Revisar catálogos de competencias y rutas.

**Pruebas de abuso (con cualquier cuenta; no deben romper nada)**
- Registrarse con una contraseña débil: debe explicar qué falta (mín. 8 caracteres con mayúscula, minúscula, número y especial; si esa regla ya está desplegada).
- Escribir en el chat o diario texto con símbolos, HTML (`<b>hola</b>`), emojis y mensajes muy largos: se muestra como texto, sin errores.
- Con la persona A abierta, no debe verse nada de la persona B (probar con dos navegadores).

## 5. Qué ya sabemos (para no reportarlo de nuevo)
- El inicio de sesión se bloquea tras varios intentos fallidos: es intencional.
- No existe «¿Olvidaste tu contraseña?» todavía (ticket ES-132).
- Hay módulos marcados «En preparación»: ejercicios y rutas pueden estar parcialmente disponibles.
- La IA tiene presupuesto por persona; al agotarse muestra un aviso (esperado).
- Cambios aprobados por QA pueden no estar aún en staging hasta que Mauricio los fusione y se despliegue.
- No verificado por QA: lector de pantalla real, Safari/Firefox, celular físico.

## 6. Cómo se crean las cuentas (lo hace Mauricio o Infra, ~2 minutos)
QA no maneja secretos, así que las cuentas se crean con un script que usa credenciales del superadmin que **solo tú** conoces:

```bash
STAGING_URL=https://backend-staging-e3a6.up.railway.app SUPERADMIN_EMAIL=<tu correo> SUPERADMIN_PASSWORD=<tu clave> TEST_PASSWORD=<clave nueva de 12+ caracteres con mayúscula, minúscula, número y especial> node qa/staging-usuarios.cjs
```

El script (`qa/staging-usuarios.cjs`): solo acepta la URL de staging, es repetible (no duplica cuentas ni cambia contraseñas existentes), crea las 4 cuentas, asigna la persona al terapeuta y no imprime claves. Después entreguen `TEST_PASSWORD` a las personas probadoras por un canal privado.

## 7. Contactos
- Producto / alcance: Alejo Roldan (PO). Técnico: Mauricio Roldán.
- Tablero: proyecto ES en Jira (https://iatech-team-xqxmjki1.atlassian.net/jira/software/projects/ES/boards/2). Reporten hallazgos con las pautas de la sección 1.

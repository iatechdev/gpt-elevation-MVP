# Backoffice & Prompt Vault — Solicitud de Aprobación

**Para:** Alejo Roldán (Product Owner / Stakeholder)  
**De:** Mauricio Roldán (Tech Lead)  
**Fecha:** Marzo 2026  
**Estado:** 🔵 Esperando aprobación para incluir en MVP 2

---

## Resumen ejecutivo (sin jerga técnica)

Hoy los textos que definen cómo habla y piensa el acompañante de Elevation están escritos directamente en el código del programa. Esto tiene un problema grande: si alguien accede al código (sea porque el repositorio se hace público, o porque un desarrollador lo clona), puede leer, copiar o modificar esos textos.

Lo que proponemos es crear una **bóveda segura de prompts** — un sistema donde esos textos viven protegidos dentro de la base de datos, encriptados (como una caja fuerte digital), y solo el servidor puede abrirlos cuando los necesita.

Además, te damos a ti como administrador una **interfaz propia** para editar esos textos cuando quieras, sin necesidad de saber programar ni pedirle a Mauricio que haga un deploy.

---

## ¿Qué puedes hacer tú como admin con esto?

✅ **Editar el prompt del acompañante** desde tu navegador, en cualquier momento  
✅ **Ver el historial** de todos los cambios que has hecho  
✅ **Enviar un cambio a revisión** antes de que llegue a los usuarios  
✅ **Aprobar o rechazar** cambios de prompt (los tuyos o de otro admin)  
✅ **Hacer rollback** en segundos si un cambio no funcionó bien  
✅ **Ver el estado** de la plataforma desde un panel de control  

---

## ¿Qué apruebas con este documento?

Con tu aprobación, Mauricio y yo comenzamos a construir:

1. **Tu acceso de administrador** al backoffice (HU-027)
2. **La bóveda encriptada** donde vivirán los prompts (HU-028)
3. **El editor de prompts** para que puedas editarlos visualmente (HU-029)
4. **El flujo de aprobación** para revisar cambios antes de publicarlos (HU-030)
5. **El historial de versiones** para ver la evolución del acompañante (HU-031)

---

## ¿Cuánto tiempo toma?

Estimamos **26 story points** distribuidos en el Sprint 1 y Sprint 2, trabajando en paralelo con las otras HU del backlog.

---

## Tu aprobación

Para aprobar, simplemente responde o comenta en el Issue de GitHub correspondiente, o confírmale a Mauricio directamente.

**Opciones:**
- ✅ **Aprobado** — comenzamos en el Sprint 1
- 🔄 **Aprobado con cambios** — indica qué ajustar
- ❌ **No aprobado** — indica el motivo

---

*Este documento fue generado como parte del proceso de gestión de producto de Elevation.*  
*Repositorio: [iatechdev/gpt-elevation-MVP](https://github.com/iatechdev/gpt-elevation-MVP)*

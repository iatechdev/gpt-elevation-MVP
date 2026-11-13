# Diseño aprobado como base de desarrollo · Landing pública · Fase 2 (ES-65 y ES-68 a ES-74)

Registro: instrucción de Mauricio Roldán (Tech Lead), 28-oct-2026, para que el diseño no frene el desarrollo. Complementa `docs/landing/DISENO-FASE1.md` (cabecera, héroe, dos puertas, franja de ejemplo), que ya está construida.

## Fuentes

| Qué | Dónde |
| --- | --- |
| Diseño visual (prototipo de Figma, 84 pantallas, móvil de 390 px) | https://www.figma.com/proto/dbhSGDHaqnE4m5YoOhpV2M/Sin-t%C3%ADtulo (página 0:1). Pídele acceso a Mauricio si no lo ves. |
| Textos ES/EN de todas las secciones | `docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md` (fuente única) |
| Reglas y estructura de información | `docs/landing/ARQUITECTURA-Y-TEXTOS-LANDING.md` |
| Tokens, daisyUI y contraste | `docs/landing/DISENO-FASE1.md` §1 y ES-61 |

## Qué sección corresponde a cada historia

Los números de sección salen del documento de arquitectura y aparecen en el propio diseño ("03 · El problema", "07 · Qué ofrece a las personas").

| Historia | Secciones | Nota |
| --- | --- | --- |
| ES-68 | S3 El problema · S4 Dos módulos · S5 Cómo funciona | |
| ES-69 | S6 Privacidad y límites · S14 Preguntas frecuentes | Recursos de ayuda por país: marcador visible hasta decidir D-08 |
| ES-70 | S7 Qué ofrece a las personas · S9 Skill Map | Cada bloque con chip de estado; los valores los confirma Dev (D-03) |
| ES-71 | S8 Para psicólogos | El botón "Unirme como profesional" se muestra solo si existe su destino |
| ES-72 | S11 Objetivos y estado | Sin tamaño, países ni idiomas del piloto (D-06) |
| ES-73 | S12 Planes y precios | Datos desde `GET /api/plans`; estados cargando, error y vacío; sin precios escritos |
| ES-74 | S13 Cómo vincularte + destino de las dos puertas | Definir con D-09 y D-04 |
| ES-65 | S15 Cierre y pie | Enlaces de privacidad, términos y contacto: marcadores hasta D-08 |
| (ya hecha) | S10 Ejemplo ilustrativo | ES-64, oculta hasta aprobar el texto |

La navegación (Cómo funciona, Skill Map, Para psicólogos, Planes) se activa por ancla **solo cuando su sección existe** (criterio de ES-62).

## Condiciones de la aprobación

1. **Los textos mandan.** Si el diseño y `TEXTOS-LANDING-FASE2-ES-EN.md` difieren, vale el documento de textos. El diseño trae frases que no están en él ("A tu ritmo. Bajo tu control.", "Tu experiencia no desaparece"): **no se publican** hasta que Mauricio o Alejo las aprueben. Dev lista cualquier otra que encuentre.
2. **Revisión completa antes de codificar.** Infra solo recorrió 2 de las 84 pantallas (S3 y S7). Dev revisa todas y reporta en la historia lo que se aparte del documento de textos, de las reglas no clínicas o de los tokens, antes de abrir el PR.
3. **Móvil y escritorio.** El prototipo es de 390 px. Para escritorio, Dev sigue el sistema de la fase 1 (rejilla, tokens y componentes) y lo documenta en el PR. Si existen frames de escritorio en Figma, prevalecen.
4. **Estilo.** Papel, tinta y ocre. El ocre `#B8963E` solo decora; el texto en ocre usa `#7D6218` (claro) o `#D9B861` (oscuro). daisyUI con el tema de ES-61; sin dependencias nuevas.
5. **Reglas de contenido no negociables.** Producto no clínico; sin promesas de empleo ni de resultados; sin cifras de eficacia, testimonios ni logos; ES y EN completos; textos por claves `landing.*` con respaldo por defecto (ES-66).
6. **Marcadores pendientes** (`[...]` en el documento de textos) se ven como marcador o la sección/botón se oculta. Nunca se inventa el contenido.

## Lo que no está verificado

- La traducción al inglés no la revisó una persona nativa.
- Los textos de privacidad y eliminación deben pasar por el especialista antes de publicarse.
- No se verificó el prototipo fuera de las pantallas 3 y 18.

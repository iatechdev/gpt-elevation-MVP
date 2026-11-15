// ES-153 (paso 1): el marco de persona vive en un layout de ruta (PersonLayout) que envuelve /app/*. Este módulo guarda lo que comparten el layout y el marco.
import { createContext } from 'react'

/** true dentro de PersonLayout: ahí PersonFrame no dibuja otro marco (solo deja pasar el contenido). */
export const PersonLayoutContext = createContext(false)

/**
 * MECANISMO «esta pantalla ya migró a Cartografía»: se agrega su ruta a esta lista en el PR de su historia.
 * El layout pide entonces tema claro/oscuro del sistema y quita el ámbito de tokens antiguos (elv-theme) del área principal.
 * Una pantalla que no está en la lista conserva el lienzo claro heredado. Una ruta con parámetros se escribe como prefijo («/app/evidence/new»).
 * La prueba es-153-persona-layout.test.mjs verifica que cada ruta de la lista existe en App.tsx.
 */
export const MIGRATED_PERSON_PATHS: readonly string[] = ['/app/skill-map', '/app/checkin', '/app/onboarding', '/app/data', '/app/plan', '/app/space/tools', '/app/exercises']

export const isMigratedPersonPath = (pathname: string) => MIGRATED_PERSON_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))

/** El chat no lleva pie: el compositor ocupa el fondo y el chat muestra siempre sus propios «Límites del asistente». */
export const personFooterHidden = (pathname: string) => pathname === '/app/chat'

// ES-309: mismo mecanismo que MIGRATED_PERSON_PATHS (ES-153) para el área Profesional. Cada pantalla que migra a Cartografía agrega su ruta en el PR de su historia;
// el marco pide entonces tema claro/oscuro del sistema y quita el ámbito de tokens antiguos (elv-theme). Una pantalla que no está en la lista conserva el lienzo claro heredado.
// La prueba es-309-panel.test.mjs verifica que cada ruta de la lista existe en App.tsx.
export const MIGRATED_PROFESSIONAL_PATHS: readonly string[] = ['/therapist/dashboard']

export const isMigratedProfessionalPath = (pathname: string) => MIGRATED_PROFESSIONAL_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))

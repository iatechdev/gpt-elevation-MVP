// ES-346: «Mis datos» cierra la sesión local ANTES de mostrar el aviso de eliminación. Sin sesión, la compuerta de acceso mandaría a /login y el aviso
// no se vería; esta marca EN MEMORIA (no se guarda en el navegador) deja a la compuerta mostrar solo esa pantalla de resultado, en la ruta marcada.
// Recargar, navegar a otra ruta o salir de la pantalla la borra: no concede acceso a nada más.
let path: string | null = null

export function startFarewell(pathname: string) { path = pathname }
export function endFarewell() { path = null }
export function isFarewell(pathname: string) { return path !== null && path === pathname }

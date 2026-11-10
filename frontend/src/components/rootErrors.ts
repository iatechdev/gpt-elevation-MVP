// ES-256 (E250-1): en producción React 19 imprime POR DEFECTO el mensaje y la pila de cada error que atrapa un límite de error. Ese mensaje puede llevar datos de la
// persona (un correo, un valor de un formulario) hacia la consola de su propio navegador. Los límites (<RouteErrorBoundary>, <SectionBoundary>) ya imprimen una línea
// segura en componentDidCatch (nombre del error, ruta sin query y nombres de componentes; nunca message, props ni estado), así que aquí se silencia el registro nativo.
// En desarrollo se deja el comportamiento por defecto de React para poder depurar. Los errores NO atrapados por ningún límite siguen su camino normal (onUncaughtError no se toca).
export const rootErrorOptions = import.meta.env.DEV ? {} : { onCaughtError: () => { /* ver arriba: la línea segura la imprime el límite */ } }

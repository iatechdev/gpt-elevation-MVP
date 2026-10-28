// La franja de ejemplo (ES-64) solo se publica cuando el texto fue revisado por el especialista (D-07/ES-17)
// y aprobado por Mauricio o Alejo. Bandera de compilación apagada por defecto: VITE_LANDING_EXAMPLE_APPROVED=true.
export function exampleApproved(value: unknown): boolean {
  return value === 'true'
}

// Nombre accesible de la línea "Acciones → posibles capacidades": la flecha se lee como pausa, en cualquier idioma.
export function exampleAccessibleTitle(title: string): string {
  return title.replace(/\s*→\s*/g, ', ')
}

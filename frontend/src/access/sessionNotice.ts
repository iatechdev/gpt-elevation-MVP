// ES-359 (PR6): pone el nombre guardado en el texto del aviso de sesión abierta. Con una FUNCIÓN como reemplazo el nombre es texto literal: un nombre como «$&», «$1», «$$» o «$'»
// no se interpreta como patrón de reemplazo (con una cadena, «$&» insertaría el propio «{name}» y «$'» un fragmento del texto).
export const withName = (template: string, name: string): string => template.replace('{name}', () => name)

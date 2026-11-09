// ES-143: ninguna pantalla de /admin/* puede dejar texto de interfaz en español fuera del traductor `tr()`.
// Recorre el árbol sintáctico real de cada archivo (no una expresión regular sobre el texto) y falla si encuentra
// un texto visible o un mensaje en español que no pase por `tr(...)`; además exige que todo texto pasado a `tr`
// tenga su inglés en `adminCopy.ts` (o una regla con patrón en `adminText`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { adminText, adminEnglish } from '../src/i18n/adminCopy.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/pages/admin')
const files = readdirSync(dir).filter(f => f.endsWith('.tsx')).sort()

// Palabras que delatan un texto en español (en minúsculas, palabra completa).
const SPANISH = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'para', 'por', 'con', 'sin', 'que', 'no', 'hay',
  'cargando', 'guardar', 'cancelar', 'crear', 'editar', 'nuevo', 'nueva', 'aún', 'este', 'esta', 'solo', 'sobre', 'todos', 'todas',
  'activo', 'activa', 'versión', 'versiones', 'usuario', 'usuarios', 'contenido', 'propuesta', 'aprobado', 'rechazado', 'rechazar',
  'aprobar', 'conexión', 'requerido', 'requerida', 'fecha', 'nombre', 'estado', 'ver', 'ocultar', 'enviar', 'enviando', 'confirmar',
  'eliminar', 'procesando', 'pendiente', 'pendientes', 'historial', 'caracteres', 'minúsculas', 'escribe', 'explica', 'motivo'])
// Un texto que ya tiene inglés en el diccionario se traduce al mostrarse (patrón de las demás pantallas: se guarda
// el texto en español y se muestra con tr(estado)); lo que no está en el diccionario es un hueco real.
const translatable = text => text in adminEnglish || adminText(text, 'en') !== text
const looksSpanish = text => /[áéíóúñ¿¡]/i.test(text) || (text.toLowerCase().match(/[a-záéíóúñ]+/g) ?? []).some(w => SPANISH.has(w))

// Textos que son identificadores técnicos o nombres propios y no se traducen.
const ALLOWED = new Set(['Inter, sans-serif', 'Playfair Display, serif', 'elevation_token', 'elevation_role', 'Content-Type', 'no-store', 'Ana García'])

function scan(file) {
  const source = readFileSync(resolve(dir, file), 'utf8')
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const found = []
  const where = node => { const { line } = sf.getLineAndCharacterOfPosition(node.getStart()); return `${file}:${line + 1}` }
  const insideTr = node => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'tr') return true
    }
    return false
  }
  const skipContext = node => {
    const p = node.parent
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true
    if (ts.isPropertyAssignment(p) && p.name === node) return true // clave de objeto
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true // STATUS_BADGE['x']
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return true // v.status === 'x'
    if (ts.isCaseClause(p)) return true
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'startsWith', 'endsWith'].includes(p.expression.name.text)) return true // lógica, no texto visible
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.expression.getText() === 'localStorage') return true
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.expression.getText() === 'console') return true
    return false
  }
  const visit = node => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (/[A-Za-záéíóúñÁÉÍÓÚÑ]{2,}/.test(text) && looksSpanish(text)) found.push(`${where(node)}  texto JSX: «${text}»`)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text
      if (!ALLOWED.has(text) && !text.startsWith('/') && !skipContext(node) && !insideTr(node) && looksSpanish(text) && !translatable(text)) found.push(`${where(node)}  literal: «${text}»`)
    } else if (ts.isTemplateExpression(node)) {
      // Se reconstruye la plantilla con «X» en lugar de cada ${...}; si adminText tiene una regla para esa forma, está cubierta.
      const text = node.head.text + node.templateSpans.map(sp => 'X' + sp.literal.text).join('')
      if (!insideTr(node) && !text.startsWith('/') && !text.startsWith('X/') && !text.endsWith('.pdf') && looksSpanish(text) && !translatable(text)) found.push(`${where(node)}  plantilla: «${text}»`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  // Claves pasadas a tr(): deben estar traducidas.
  const keys = []
  const collect = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr' && node.arguments.length === 1) {
      const arg = node.arguments[0]
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) keys.push({ key: arg.text, at: where(node) })
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)
  return { found, keys }
}

test('ES-143: ninguna pantalla de /admin/* deja texto en español fuera de tr()', () => {
  const problems = files.flatMap(f => scan(f).found)
  assert.deepEqual(problems, [], `Texto fijo en español sin pasar por tr():\n${problems.join('\n')}`)
})

test('ES-143: todo texto que pasa por tr() tiene su inglés en adminCopy.ts', () => {
  const missing = []
  for (const f of files) {
    for (const { key, at } of scan(f).keys) {
      // Valores iguales en ambos idiomas se declaran explícitamente en el diccionario (p. ej. 'Email', 'Prompts').
      if (!(key in adminEnglish) && adminText(key, 'en') === key) missing.push(`${at}  «${key}»`)
    }
  }
  assert.deepEqual(missing, [], `Sin traducción al inglés:\n${missing.join('\n')}`)
})

test('ES-143: AdminPrompts usa el traductor y no deja Spanish al cambiar a inglés', () => {
  const { found, keys } = scan('AdminPrompts.tsx')
  assert.deepEqual(found, [])
  assert.ok(keys.length >= 50, `AdminPrompts debería pasar ≥50 textos por tr(); pasa ${keys.length}`)
  assert.equal(adminText('Historial de versiones', 'en'), 'Version history')
  assert.equal(adminText('Historial de versiones', 'es'), 'Historial de versiones')
})

test('ES-143: la prueba detecta texto fijo si reaparece (guardia de la propia guardia)', () => {
  const bad = ts.createSourceFile('x.tsx', "export const A = () => <p>No hay prompts configurados aún.</p>", ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let hits = 0
  const walk = n => { if (ts.isJsxText(n) && looksSpanish(n.text)) hits++; ts.forEachChild(n, walk) }
  walk(bad)
  assert.equal(hits, 1)
})

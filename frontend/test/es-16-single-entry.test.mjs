// ES-16 + ES-15: la entrada a los ejercicios es UNA (el enlace del menú de «Mi espacio»). #39 no repite en el chat la identificación de IA ni el enlace
// que #40 ya muestra; el dashboard conserva solo la identificación de IA. Decisión de Mauricio al integrar las dos HU.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-16: el chat no monta ExerciseTools (la identificación de IA del chat es la nota de Mi espacio)', () => {
  const chat = read('../src/pages/ChatPage.tsx')
  assert.doesNotMatch(chat, /ExerciseTools/)
  assert.match(chat, /<SpaceNav \/>/)
})

test('ES-16: ExerciseTools solo identifica a la IA; no trae enlace propio a los ejercicios', () => {
  const tools = read('../src/exercises/ExerciseTools.tsx')
  assert.doesNotMatch(tools, /<Link\b/)
  assert.doesNotMatch(tools, /\/app\/exercises/)
  assert.match(tools, /exercise\.ai/)
  assert.match(read('../src/pages/UserDashboard.tsx'), /<ExerciseTools \/>/) // el dashboard sigue identificando a la IA
})

test('ES-15/16: el enlace del menú de Mi espacio es el único y lleva el origen para que «volver» regrese al chat', () => {
  const nav = read('../src/space/SpaceNav.tsx')
  assert.equal((nav.match(/<(?:Link|NavLink|a)\b[^>]*(?:to|href)=(?:\{`|\{'|")\/app\/exercises/g) || []).length, 1) // un solo enlace (el routes.has('/app/exercises') solo comprueba que la ruta exista)
  assert.match(nav, /from=\$\{pathname === '\/app\/chat' \? 'chat' : 'dashboard'\}/)
  assert.match(nav, /VITE_ENABLE_COMPANION_EXERCISES === 'true'/) // sigue detrás de la bandera, apagada por defecto
  assert.match(read('../src/exercises/ExercisePage.tsx'), /params\.get\('from'\) === 'chat' \? '\/app\/chat' : '\/app\/dashboard'/)
})

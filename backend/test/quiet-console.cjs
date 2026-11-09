// ES-144: silencia console.* en los procesos de prueba (se carga con `node --require`, ver "test" en package.json).
// Con el ejecutor de pruebas de Node, cada archivo corre en un proceso hijo cuyo stdout lleva los eventos serializados del ejecutor.
// El código bajo prueba escribe sus propios avisos (console.log/warn/error con emojis) al mismo flujo, y bajo carga el ejecutor
// a veces los mezcla con un evento y falla con «Unable to deserialize cloned data due to invalid or unsupported version».
// Una prueba que necesite ver o comprobar un aviso lo captura reemplazando console.* en su propio cuerpo; eso sigue funcionando.
// Para ver los avisos al depurar: TEST_VERBOSE=1 npm test
if (!process.env.TEST_VERBOSE) {
  const silent = () => {};
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) console[level] = silent;
}

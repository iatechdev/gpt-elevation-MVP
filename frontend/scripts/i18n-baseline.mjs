// ES-154: regenera el tope de textos fijos (test/fixtures/es-154-texto-fijo.json) tras migrar pantallas a claves. Solo debe bajar.
process.env.WRITE_BASELINE = '1'
await import('../test/es-154-sin-texto-fijo.test.mjs')

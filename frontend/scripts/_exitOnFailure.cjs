// ES-292 (E271-1) · Una comprobación fallida SIEMPRE termina con código ≠ 0. Algunos scripts de navegador (los que levantan PostgreSQL embebido) pisaban `process.exitCode = 1`
// con un `process.exit(0)` de la limpieza del `finally`: el error se imprimía pero el proceso salía con 0 (la guarda de build «no fallaba»). El gancho de 'exit' fija el código al final,
// pase lo que pase en la limpieza. Uso, en el `catch` del script:  `console.error('… falló:', error); require('./_exitOnFailure.cjs').fail();`
let failed = false;
process.on('exit', () => { if (failed) process.exitCode = 1; });
module.exports = { fail() { failed = true; process.exitCode = 1; } };

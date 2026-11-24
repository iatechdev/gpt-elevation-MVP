// Genera elevation-prototipo.html: un solo archivo (CSS, JS y fuentes en línea) para enviar por correo o publicar.
const fs = require('fs')
let css = fs.readFileSync('styles.css', 'utf8')
css = css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (m, p) => 'url(data:font/woff2;base64,' + fs.readFileSync(p).toString('base64') + ')')
const js = fs.readFileSync('app.js', 'utf8')
const html = fs.readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + css + '</style>')
  .replace('<script src="app.js"></script>', () => '<script>' + js.replace(/<\/script>/g, '<\\/script>') + '</script>')
fs.writeFileSync('elevation-prototipo.html', html)
console.log('elevation-prototipo.html', Math.round(html.length / 1024) + ' KB')
// Variante para publicar como Artifact (sin doctype/html/head/body: el publicador pone el esqueleto).
const art = '<title>Elevation Prototipo</title>\n<style>' + css + '</style>\n<a class="skip" href="#main">Saltar al contenido / Skip to content</a>\n<div class="proto" role="region" aria-label="Prototipo"></div>\n<div id="app"></div>\n<script>' + js.replace(/<\/script>/g, '<\/script>') + '</script>\n'
fs.writeFileSync('elevation-prototipo.artifact.html', art)
console.log('elevation-prototipo.artifact.html', Math.round(art.length / 1024) + ' KB')

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ES-199 (PERF-05): daisyUI genera, por cada tema registrado en landing.css, el selector `:root:has(input.theme-controller[value=…]:checked)`. Con `:has()` sobre la raíz y un selector de atributo `value`,
// cada vez que React actualiza el atributo `value` de CUALQUIER campo del documento el navegador vuelve a calcular el estilo de toda la página (una tecla en «Textos públicos», con 340 campos, cuesta ~0,75 s a CPU ×4).
// Nadie usa `theme-controller` (los temas se eligen con `data-theme`): se quita solo ese selector de la lista y queda `[data-theme=…]`. Los estilos de cada tema no cambian.
const THEME_CONTROLLER = /:root:has\(input\.theme-controller\[[^\]]*\]:checked\)\s*,\s*/g
const dropThemeController = (): Plugin => ({
  name: 'es199-drop-theme-controller',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'asset' && file.fileName.endsWith('.css') && typeof file.source === 'string' && file.source.includes('theme-controller')) file.source = file.source.replace(THEME_CONTROLLER, '')
    }
  },
})

// ES-196: vendors estables en bloques propios. Cambian solo al actualizar la dependencia, así el navegador los reutiliza entre despliegues
// (el bloque de entrada cambia en cada despliegue). React y el enrutador van separados; React vive en UN solo bloque.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dropThemeController(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[/](react|react-dom|scheduler)[/]/, priority: 20 },
            { name: 'vendor-router', test: /node_modules[/](react-router|react-router-dom|cookie|set-cookie-parser)[/]/, priority: 10 },
          ],
        },
      },
    },
  },
})

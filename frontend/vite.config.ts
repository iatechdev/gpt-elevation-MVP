import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ES-196: vendors estables en bloques propios. Cambian solo al actualizar la dependencia, así el navegador los reutiliza entre despliegues
// (el bloque de entrada cambia en cada despliegue). React y el enrutador van separados; React vive en UN solo bloque.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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

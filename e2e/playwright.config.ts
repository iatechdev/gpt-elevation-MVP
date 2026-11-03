import { defineConfig, devices } from '@playwright/test'
import { resolveBaseUrl } from './lib/target'

// ES-147 · Pruebas de UX/UI. Destino: E2E_BASE_URL (solo localhost o staging; ver lib/target.ts).
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: resolveBaseUrl(),
    // Solo ante fallo: no se guardan trazas ni videos de ejecuciones correctas.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
})

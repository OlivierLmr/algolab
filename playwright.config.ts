import { defineConfig } from '@playwright/test'

const E2E_PORT = 4321

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}/algolab/`,
    headless: true,
  },
  webServer: {
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    port: E2E_PORT,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})

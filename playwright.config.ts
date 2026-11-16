import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'off' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Run with: pnpm exec playwright test --project=firefox   (needs `playwright install firefox webkit`, and system libraries for WebKit)
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
})

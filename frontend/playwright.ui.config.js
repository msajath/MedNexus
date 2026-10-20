import { defineConfig, devices } from '@playwright/test'

// UI contract tests run without a database. Real API tests use playwright.config.js.
export default defineConfig({
  testDir: './e2e-ui', timeout: 60000, expect: { timeout: 10000 }, workers: 1, reporter: [['list'], ['html', { outputFolder: 'playwright-report-ui', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5175', channel: process.env.QA_BROWSER_CHANNEL || undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort', url: 'http://127.0.0.1:5175', timeout: 60000, reuseExistingServer: false },
})

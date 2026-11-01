import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './e2e/helpers'

// End-to-end tests: the built app against a real PocketBase, in an iPhone-sized
// Chromium. Run with `npm run e2e` (needs ./pocketbase/install.sh first).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  // One database for every test, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'sh e2e/start-pocketbase.sh',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})

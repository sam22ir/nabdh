import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:19006',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile-web',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
});

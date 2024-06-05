import {defineConfig, devices} from '@playwright/test';

const isCI = Boolean(process.env.CI);
const isEditor = Boolean(process.env.VSCODE_PLAYWRIGHT);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test',

  /* Run tests in files in parallel */
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source
  // code.
  forbidOnly: isCI,

  /* Retry on CI only */
  // retries: isCI ? 2 : 0,
  retries: 0,

  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: isCI ? [['github'], ['html']] : [['list'], ['html']],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'https://localhost:5500/cbor2/',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },

  expect: {
    timeout: isEditor ? 500 : 5000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },

    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },

    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run start -- --open=false',
    url: 'https://localhost:5500/cbor2/',
    reuseExistingServer: !isCI,
    ignoreHTTPSErrors: true,
  },
});

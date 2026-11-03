import type { ReporterDescription } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.FRONTEND_URL ?? 'http://localhost:4200';
const reportPortalSettings = {
  apiKey: process.env.RP_API_KEY,
  endpoint: process.env.RP_ENDPOINT,
  project: process.env.RP_PROJECT,
  launch: process.env.RP_LAUNCH || 'Restaurant AQA',
  includeTestSteps: true,
  uploadTrace: true,
  uploadVideo: true,
};
const hasAnyReportPortalSetting = Boolean(
  reportPortalSettings.apiKey || reportPortalSettings.endpoint || reportPortalSettings.project
);
const hasCompleteReportPortalSettings = Boolean(
  reportPortalSettings.apiKey && reportPortalSettings.endpoint && reportPortalSettings.project
);

if (hasAnyReportPortalSetting && !hasCompleteReportPortalSettings) {
  throw new Error('ReportPortal requires RP_API_KEY, RP_ENDPOINT, and RP_PROJECT together.');
}

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],
];

if (hasCompleteReportPortalSettings) {
  reporters.push(['@reportportal/agent-js-playwright', reportPortalSettings]);
}

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  reporter: reporters,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});

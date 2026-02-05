const { defineConfig, devices } = require('@playwright/test');

if (process.env.PUBLIC_FIREBASE_USE_EMULATORS === undefined) {
    process.env.PUBLIC_FIREBASE_USE_EMULATORS = 'true';
}
if (process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC === undefined) {
    process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC = 'true';
}

module.exports = defineConfig({
    testDir: './tests',
    // Ignore unit tests for Firestore rules and integration tests from E2E runs
    testIgnore: ['**/firestore.rules.spec.mjs', '**/integration/**'],
    testMatch: '**/*.spec.js',
    timeout: 30000,
    // Use HTML reporter on CI for easier debugging and artifact inspection
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
    // Retry flaky tests in CI, but not locally for faster feedback
    retries: process.env.CI ? 2 : 0,
    globalSetup: require.resolve('./tests/global-setup.cjs'),
    use: {
        headless: true,
        // Enable video autoplay in tests
        launchOptions: {
            args: [
            ]
        },
        // Disable service workers in tests for stability
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
        },
        {
            name: 'mobile',
            use: { ...devices['iPhone 13'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        port: 5173,
        // Default to false so Playwright boots a server with emulator envs.
        reuseExistingServer: process.env.PW_REUSE_SERVER === 'true',
        env: {
            ...process.env,
            PUBLIC_FIREBASE_USE_EMULATORS: process.env.PUBLIC_FIREBASE_USE_EMULATORS,
            PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC: process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC,
        },
    },
});

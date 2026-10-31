const { defineConfig, devices } = require('@playwright/test');

if (process.env.PUBLIC_FIREBASE_USE_EMULATORS === undefined) {
    process.env.PUBLIC_FIREBASE_USE_EMULATORS = 'true';
}
if (process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC === undefined) {
    process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC = 'true';
}

module.exports = defineConfig({
    // Suites live in tests/e2e/<route> so CI can run one route directory at a time.
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 30000,
    // Use HTML reporter on CI for easier debugging and artifact inspection
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
    // Retry flaky tests in CI, but not locally for faster feedback
    retries: process.env.CI ? 2 : 0,
    globalSetup: require.resolve('./tests/global-setup.cjs'),
    // Use an OS-agnostic snapshot path so the same baseline PNGs work on macOS (local) and Linux (CI).
    snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
    use: {
        headless: true,
        // Enable video autoplay in tests
        launchOptions: {
            args: [
            ]
        },
        // Disable service workers in tests for stability
        serviceWorkers: 'block',
        // The analytics banner sits over the page until a choice is stored.
        // Tests reject it up front so it does not cover controls or count as a dialog.
        storageState: {
            cookies: [],
            origins: [
                {
                    origin: 'http://localhost:5173',
                    localStorage: [
                        { name: 'pure-reactions:analytics-consent', value: 'reject' }
                    ]
                },
                {
                    origin: 'http://127.0.0.1:5173',
                    localStorage: [
                        { name: 'pure-reactions:analytics-consent', value: 'reject' }
                    ]
                }
            ]
        },
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
            // Automatically propagate emulator host/port from firebase-tools to the web app
            PUBLIC_FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0],
            PUBLIC_FIRESTORE_EMULATOR_PORT: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1],
            PUBLIC_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST?.split(':')[0],
            PUBLIC_AUTH_EMULATOR_PORT: process.env.FIREBASE_AUTH_EMULATOR_HOST?.split(':')[1],
            PUBLIC_DATABASE_EMULATOR_HOST: process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(':')[0],
            PUBLIC_DATABASE_EMULATOR_PORT: process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(':')[1],
        },
    },
});

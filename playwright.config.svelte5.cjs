const { defineConfig, devices } = require('@playwright/test');

if (process.env.PUBLIC_FIREBASE_USE_EMULATORS === undefined) {
    process.env.PUBLIC_FIREBASE_USE_EMULATORS = 'true';
}
if (process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC === undefined) {
    process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC = 'true';
}

module.exports = defineConfig({
    testDir: './tests',
    testIgnore: ['**/firestore.rules.spec.mjs', '**/integration/**'],
    testMatch: '**/*.spec.js',
    timeout: 30000,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    retries: process.env.CI ? 2 : 0,
    globalSetup: require.resolve('./tests/global-setup.cjs'),
    snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
    use: {
        headless: true,
        launchOptions: {
            args: []
        },
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
        command: 'npm run dev -- --port 5174',
        port: 5174,
        reuseExistingServer: false,
        env: {
            ...process.env,
            PUBLIC_FIREBASE_USE_EMULATORS: process.env.PUBLIC_FIREBASE_USE_EMULATORS,
            PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC: process.env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC,
            PUBLIC_FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0],
            PUBLIC_FIRESTORE_EMULATOR_PORT: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1],
            PUBLIC_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST?.split(':')[0],
            PUBLIC_AUTH_EMULATOR_PORT: process.env.FIREBASE_AUTH_EMULATOR_HOST?.split(':')[1],
            PUBLIC_DATABASE_EMULATOR_HOST: process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(':')[0],
            PUBLIC_DATABASE_EMULATOR_PORT: process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(':')[1],
        },
    },
});

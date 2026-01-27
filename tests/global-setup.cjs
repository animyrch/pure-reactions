const { spawnSync } = require('node:child_process');

/**
 * Playwright global setup: best-effort seed Firestore fixtures (idempotent).
 *
 * Behavior:
 * - If PUBLIC_FIREBASE_USE_EMULATORS=true (recommended for e2e), seeds the Firestore emulator.
 * - If FIREBASE_SEED_TARGET=prod, requires ALLOW_PROD_SEED=1 and credentials.
 * - Otherwise it no-ops (so contributors don't accidentally write to prod).
 */
module.exports = async () => {
  const wantsEmulator = String(process.env.PUBLIC_FIREBASE_USE_EMULATORS || '').toLowerCase() === 'true';
  const explicitTarget = process.env.FIREBASE_SEED_TARGET;

  // Default safety: only auto-seed when emulators are enabled.
  if (!wantsEmulator && !explicitTarget) {
    // eslint-disable-next-line no-console
    console.log('[global-setup] Skipping Firestore seeding (set PUBLIC_FIREBASE_USE_EMULATORS=true or FIREBASE_SEED_TARGET=...)');
    return;
  }

  const result = spawnSync('node', ['scripts/seed-twin-player-fixtures.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      FIREBASE_SEED_OVERWRITE: 'true'
    }
  });

  if (result.status !== 0) {
    throw new Error(`[global-setup] Firestore seeding failed (exit ${result.status})`);
  }
};

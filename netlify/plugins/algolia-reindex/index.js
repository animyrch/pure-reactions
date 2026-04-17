/**
 * Netlify Build Plugin – Algolia Reindex on Production Deploy
 *
 * Runs the existing algolia-index.mjs script with --apply after a successful
 * production deploy.  Preview / branch / local builds are skipped.
 *
 * Required Netlify env vars (private, server-side only):
 *   ALGOLIA_ADMIN_KEY
 *   FIREBASE_SERVICE_ACCOUNT        (file path or full service-account JSON string)
 *   PUBLIC_ALGOLIA_APP_ID
 *   PUBLIC_ALGOLIA_REACTIONS_INDEX
 */

import { execSync } from 'node:child_process';

const REQUIRED_ENV = [
  'PUBLIC_ALGOLIA_APP_ID',
  'ALGOLIA_ADMIN_KEY',
  'PUBLIC_ALGOLIA_REACTIONS_INDEX',
  'FIREBASE_SERVICE_ACCOUNT'
];

export default {
  onSuccess({ utils }) {
    const context = process.env.CONTEXT;

    if (context !== 'production') {
      console.log(
        `[algolia-reindex] Skipping – deploy context is "${context}", not "production".`
      );
      return;
    }

    // Verify required env vars exist (never log their values)
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    if (missing.length) {
      return utils.build.failPlugin(
        `[algolia-reindex] Missing required env vars: ${missing.join(', ')}. ` +
          'Configure them as private environment variables in Netlify.'
      );
    }

    console.log('[algolia-reindex] Production deploy detected – starting Algolia reindex…');

    try {
      execSync('node scripts/algolia-index.mjs --apply', {
        stdio: 'inherit',
        env: process.env
      });
      console.log('[algolia-reindex] ✓ Algolia reindex completed successfully.');
    } catch (error) {
      // failPlugin surfaces the error in deploy logs without blocking the release.
      const exitInfo = error.status != null ? ` (exit code ${error.status})` : '';
      return utils.build.failPlugin(
        `[algolia-reindex] Reindex failed${exitInfo}: ${error.message}`
      );
    }
  }
};

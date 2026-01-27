#!/usr/bin/env node

// Usage:
//   node scripts/seed-twin-player-fixtures.mjs [--target emulator|prod] [--allowProd]
//   PUBLIC_FIREBASE_USE_EMULATORS=true node scripts/seed-twin-player-fixtures.mjs
//
// Seeds reaction fixtures into the reaction collection and verification fixtures into
// the channel verification collection for Playwright tests.

import { spawnSync } from 'node:child_process';

const FIXTURES = [
  'tests/fixtures/reactions/twin-basic-sync.json',
  'tests/fixtures/reactions/twin-play-trigger.json',
  'tests/fixtures/reactions/twin-volume-stability.json',
  'tests/fixtures/reactions/twin-resume-after-config-pause.json',
  'tests/fixtures/reactions/twin-overlay-visibility.json',
  'tests/fixtures/reactions/reaction-layout.json'
];

const VERIFICATION_FIXTURES = [
  'tests/fixtures/verifications/reaction-layout.json'
];

function stripFixtureArgs(argv) {
  const cleaned = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--fixture') {
      i += next ? 1 : 0;
      continue;
    }

    cleaned.push(token);
  }

  return cleaned;
}

const passthrough = stripFixtureArgs(process.argv.slice(2));

for (const fixture of FIXTURES) {
  const result = spawnSync(
    'node',
    ['scripts/seed-firestore-fixtures.mjs', '--fixture', fixture, ...passthrough],
    {
      stdio: 'inherit',
      env: process.env
    }
  );

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (!process.exitCode && VERIFICATION_FIXTURES.length) {
  const verificationCollection =
    process.env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS ||
    'youtubeChannelVerifications_local';

  for (const fixture of VERIFICATION_FIXTURES) {
    const result = spawnSync(
      'node',
      [
        'scripts/seed-firestore-fixtures.mjs',
        '--fixture',
        fixture,
        '--collection',
        verificationCollection,
        ...passthrough
      ],
      {
        stdio: 'inherit',
        env: process.env
      }
    );

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}

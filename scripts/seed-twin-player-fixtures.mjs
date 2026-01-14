#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const FIXTURES = [
  'tests/fixtures/reactions/twin-basic-sync.json',
  'tests/fixtures/reactions/twin-play-trigger.json',
  'tests/fixtures/reactions/twin-volume-stability.json',
  'tests/fixtures/reactions/twin-resume-after-config-pause.json'
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

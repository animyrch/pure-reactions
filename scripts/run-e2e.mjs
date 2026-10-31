#!/usr/bin/env node

// Run Playwright under the Firebase emulators.
// E2E_SUITES=all (default) runs every suite.
// E2E_SUITES=account,playlist runs those route directories on the desktop and mobile projects.
// PW_ARGS is extra Playwright CLI arguments, for example "--project=mobile".

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSuitesManifest } from './e2e-suites.mjs';

const manifest = loadSuitesManifest();
const raw = (process.env.E2E_SUITES ?? 'all').trim();
const args = ['test'];

if (raw === 'none') {
  console.log('E2E_SUITES=none. Skipping Playwright.');
  process.exit(0);
}

if (raw !== 'all') {
  const known = new Map(manifest.suites.map((suite) => [suite.name, suite.dir]));
  const names = raw.split(',').map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) {
    console.error('E2E_SUITES is empty.');
    process.exit(1);
  }
  for (const name of names) {
    const dir = known.get(name);
    if (!dir) {
      console.error(`Unknown E2E suite "${name}". Known suites: ${[...known.keys()].join(', ')}`);
      process.exit(1);
    }
    args.push(dir);
  }
}

const extra = process.env.PW_ARGS?.trim();
if (extra) {
  args.push(...extra.split(/\s+/));
}

const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
console.log(`Running Playwright: ${args.join(' ')}`);
const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);

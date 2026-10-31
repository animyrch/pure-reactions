#!/usr/bin/env node

// Choose Playwright suites from tests/e2e/suites.json.
//
//   node scripts/select-e2e-suites.mjs --base origin/prod
//   node scripts/select-e2e-suites.mjs --files src/routes/account/+page.svelte,docs/TEST_STRATEGY.md
//   node scripts/select-e2e-suites.mjs --all --github-output

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { loadSuitesManifest, pathsFromNameStatus, selectSuites, suitesOutput } from './e2e-suites.mjs';

function parseArgs(argv) {
  const options = {
    files: null,
    base: null,
    head: 'HEAD',
    all: false,
    githubOutput: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--all') {
      options.all = true;
    } else if (token === '--github-output') {
      options.githubOutput = true;
    } else if (token === '--files' && next) {
      options.files = next;
      i += 1;
    } else if (token === '--base' && next) {
      options.base = next;
      i += 1;
    } else if (token === '--head' && next) {
      options.head = next;
      i += 1;
    } else {
      console.error(`Unknown argument: ${token}`);
      process.exit(1);
    }
  }

  return options;
}

function changedFiles(base, head) {
  const result = spawnSync(
    'git',
    ['diff', '-z', '--name-status', '--diff-filter=ACDMRTUXB', `${base}...${head}`],
    { encoding: 'buffer' }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    console.error('git diff failed. Refusing to skip Playwright suites.');
    process.exit(1);
  }
  return pathsFromNameStatus(result.stdout ?? Buffer.alloc(0));
}

function writeGithubOutput(selection) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    console.error('GITHUB_OUTPUT is not set.');
    process.exit(1);
  }
  appendFileSync(file, `run=${selection.run ? 'true' : 'false'}\n`);
  appendFileSync(file, `suites=${suitesOutput(selection)}\n`);
  appendFileSync(file, `mode=${selection.mode}\n`);
}

const options = parseArgs(process.argv);
const manifest = loadSuitesManifest();
const everySuite = {
  mode: 'all',
  suites: manifest.suites.map((suite) => suite.name),
  run: true
};

let selection;
if (options.all) {
  selection = everySuite;
} else if (options.files != null) {
  selection = selectSuites(options.files.split(','), manifest);
} else if (options.base) {
  selection = selectSuites(changedFiles(options.base, options.head), manifest);
} else {
  console.error('Pass --base <ref>, --files <comma-separated paths>, or --all.');
  process.exit(1);
}

if (selection.mode === 'all') {
  console.log('Playwright selection: all suites');
} else if (selection.mode === 'none') {
  console.log('Playwright selection: no route suites affected. Skipping Playwright.');
} else {
  console.log(`Playwright selection: ${selection.suites.join(', ')}`);
}

if (options.githubOutput) {
  writeGithubOutput(selection);
}

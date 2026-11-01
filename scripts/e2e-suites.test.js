import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSuitesManifest, matchesGlob, pathsFromNameStatus, selectSuites } from './e2e-suites.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = loadSuitesManifest();
const globs = [...manifest.suites.flatMap((suite) => suite.paths), ...manifest.shared];

const rel = (file) => relative(root, file).split('\\').join('/');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function classified(file) {
  return globs.some((glob) => matchesGlob(glob, file));
}

test('suite names and directories are unique and populated', () => {
  const names = manifest.suites.map((suite) => suite.name);
  assert.equal(new Set(names).size, names.length);
  const specs = walk(join(root, 'tests/e2e')).filter((file) => file.endsWith('.spec.js'));
  assert.ok(specs.length > 0);

  for (const suite of manifest.suites) {
    assert.equal(suite.dir, `tests/e2e/${suite.name}`);
    assert.ok(suite.paths.includes(`${suite.dir}/**`));
    const owned = specs.filter((file) => rel(file).startsWith(`${suite.dir}/`));
    assert.ok(owned.length > 0, `${suite.name} has no specs`);
  }

  for (const file of specs) {
    const path = rel(file);
    const owner = manifest.suites.find((suite) => path.startsWith(`${suite.dir}/`));
    assert.ok(owner, `${path} is outside every suite directory`);
  }

  const stray = readdirSync(join(root, 'tests')).filter((name) => name.endsWith('.spec.js'));
  assert.deepEqual(stray, []);
});

test('every route directory is mapped to a suite or listed as unmapped', () => {
  const dirs = readdirSync(join(root, 'src/routes'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dir of dirs) {
    const prefix = `src/routes/${dir}/`;
    const covered = globs.some((glob) => glob.startsWith(prefix));
    const unmapped = manifest.unmappedRoutes.includes(dir);
    assert.notEqual(covered, unmapped, `${dir} must be mapped or listed in unmappedRoutes`);
  }
});

test('source files are classified unless their route is unmapped', () => {
  for (const file of walk(join(root, 'src'))) {
    const path = rel(file);
    if (!path.startsWith('src/routes/')) {
      assert.ok(classified(path), `unclassified source file ${path}`);
      continue;
    }

    const rest = path.slice('src/routes/'.length);
    const top = rest.split('/')[0];
    if (!rest.includes('/')) {
      assert.ok(classified(path), `unclassified route root file ${path}`);
      continue;
    }
    if (manifest.unmappedRoutes.includes(top)) continue;
    assert.ok(classified(path), `unclassified route file ${path}`);
  }
});

test('spec imports resolve and the env file path still points at the repo root', () => {
  const specs = walk(join(root, 'tests/e2e')).filter((file) => file.endsWith('.spec.js'));
  const importPattern = /from\s+['"](\.[^'"]+)['"]/g;
  const urlPattern = /new URL\(\s*['"](\.[^'"]+)['"]/g;

  for (const file of specs) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(importPattern)) {
      const target = fileURLToPath(new URL(match[1], pathToFileURL(file)));
      assert.ok(existsSync(target), `${rel(file)} imports missing ${match[1]}`);
    }
    for (const match of text.matchAll(urlPattern)) {
      const target = fileURLToPath(new URL(match[1], pathToFileURL(file)));
      if (match[1].endsWith('.env')) {
        assert.equal(target, join(root, '.env'));
      }
    }
  }
});

test('changed paths select the corresponding suites', () => {
  const cases = [
    ['src/routes/account/+page.svelte', 'subset', ['account', 'my-reactions', 'bookmark']],
    ['src/routes/login/+page.svelte', 'subset', ['account', 'my-reactions', 'bookmark', 'backend']],
    ['src/routes/my-reactions/+page.svelte', 'subset', ['my-reactions']],
    ['src/routes/bookmark/+page.svelte', 'subset', ['bookmark']],
    ['src/routes/reaction/[slug]/+page.svelte', 'subset', ['reaction']],
    ['src/routes/edit-reaction/[slug]/+page.svelte', 'subset', ['reaction', 'edit-reaction']],
    ['src/routes/playlist/[slug]/+page.svelte', 'subset', ['playlist']],
    ['src/routes/backend/+page.svelte', 'subset', ['backend']],
    ['src/routes/test-layout/+page.svelte', 'subset', ['test-layout']],
    ['src/routes/react/+page.svelte', 'subset', ['react']],
    ['src/routes/api/account/delete/+server.js', 'subset', ['account']],
    ['src/routes/api/content/delete/+server.js', 'subset', ['my-reactions']],
    ['src/routes/api/youtube/playlist/[id]/+server.js', 'subset', ['reaction']],
    ['tests/e2e/account/logout-redirect.spec.js', 'subset', ['account']],
    ['src/routes/+layout.js', 'all', manifest.suites.map((suite) => suite.name)],
    ['src/lib/helpers/routing.js', 'all', manifest.suites.map((suite) => suite.name)],
    ['playwright.config.cjs', 'all', manifest.suites.map((suite) => suite.name)],
    ['docs/TEST_STRATEGY.md', 'none', []],
    ['src/routes/about/+page.svelte', 'none', []]
  ];

  const sharedOverride = selectSuites(
    ['src/routes/account/+page.svelte', 'src/lib/helpers/routing.js'],
    manifest
  );
  assert.equal(sharedOverride.mode, 'all');
  assert.equal(sharedOverride.run, true);

  for (const [file, mode, suites] of cases) {
    const selection = selectSuites([file], manifest);
    assert.equal(selection.mode, mode, file);
    assert.deepEqual(selection.suites, suites, file);
    assert.equal(selection.run, mode !== 'none', file);
  }

  assert.equal(selectSuites(['src/routes/account-extra/+page.svelte'], manifest).mode, 'none');
  assert.equal(matchesGlob('src/routes/account/**', 'src/routes/account/+page.svelte'), true);
  assert.equal(matchesGlob('src/routes/account/**', 'src/routes/account-extra/+page.svelte'), false);
});

test('name-status paths keep exact names and both sides of a rename', () => {
  const renamedShared = pathsFromNameStatus(
    'R100\0playwright.config.cjs\0docs/moved-config.cjs\0'
  );
  assert.deepEqual(renamedShared, ['playwright.config.cjs', 'docs/moved-config.cjs']);
  assert.equal(selectSuites(renamedShared, manifest).mode, 'all');

  const renamedRoute = pathsFromNameStatus(
    'R090\0src/routes/account/+page.svelte\0src/routes/about/+page.svelte\0'
  );
  assert.deepEqual(
    selectSuites(renamedRoute, manifest).suites,
    ['account', 'my-reactions', 'bookmark']
  );

  const weirdName = 'src/routes/playlist/weird\nname .svelte';
  assert.deepEqual(
    pathsFromNameStatus(`D\0src/lib/removed.js\0M\0${weirdName}\0`),
    ['src/lib/removed.js', weirdName]
  );
  assert.equal(selectSuites(['src/lib/removed.js'], manifest).mode, 'all');

  const directory = mkdtempSync(join(tmpdir(), 'e2e-suites-'));
  try {
    const git = (args) => {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'buffer' });
      assert.equal(result.status, 0, result.stderr?.toString('utf8'));
      return result;
    };
    git(['init', '-q']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 't']);
    git(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(directory, 'shared.js'), 'a\n');
    git(['add', 'shared.js']);
    git(['commit', '-q', '-m', 'base']);
    git(['mv', 'shared.js', 'renamed.js']);
    git(['commit', '-q', '-m', 'rename']);
    const diff = git([
      'diff',
      '-z',
      '--name-status',
      '--find-renames',
      '--diff-filter=ACDMRTUXB',
      'HEAD^...HEAD'
    ]);
    assert.deepEqual(pathsFromNameStatus(diff.stdout), ['shared.js', 'renamed.js']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

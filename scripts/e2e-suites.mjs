import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const suitesManifestPath = join(root, 'tests/e2e/suites.json');

export function loadSuitesManifest(path = suitesManifestPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/').replace(/^\.\//, '');
}

function escapeRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a repo-relative path. Globs are exact, single-segment `*`, or a trailing `/**`.
 */
export function matchesGlob(glob, filePath) {
  const file = normalizePath(filePath);
  const pattern = normalizePath(glob);
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  if (pattern.includes('**')) {
    throw new Error(`Unsupported glob (only a trailing /** is allowed): ${glob}`);
  }
  const expression = `^${pattern.split('*').map(escapeRegex).join('[^/]*')}$`;
  return new RegExp(expression).test(file);
}

/**
 * Decide which Playwright suites to run for a set of changed paths.
 * A shared path runs every suite. Anything else runs only the suites whose paths match.
 */
export function selectSuites(changedFiles, manifest) {
  const suiteNames = manifest.suites.map((suite) => suite.name);
  const selected = new Set();

  for (const file of changedFiles.map(normalizePath).filter(Boolean)) {
    if (manifest.shared.some((glob) => matchesGlob(glob, file))) {
      return { mode: 'all', suites: suiteNames, run: suiteNames.length > 0 };
    }
    for (const suite of manifest.suites) {
      if (suite.paths.some((glob) => matchesGlob(glob, file))) {
        selected.add(suite.name);
      }
    }
  }

  const suites = suiteNames.filter((name) => selected.has(name));
  if (suites.length === 0) {
    return { mode: 'none', suites: [], run: false };
  }
  return { mode: 'subset', suites, run: true };
}

export function suitesOutput(selection) {
  if (selection.mode === 'all') return 'all';
  if (selection.mode === 'none') return 'none';
  return selection.suites.join(',');
}

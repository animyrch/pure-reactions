#!/usr/bin/env node

// Usage:
//   node scripts/seed-firestore-fixtures.mjs --fixture <path> [--collection <name>]
//     [--target emulator|prod] [--allowProd] [--overwrite]
//
// Environment:
//   FIREBASE_SEED_OVERWRITE=true (overwrite existing docs)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

const DEFAULT_FIXTURE = 'tests/fixtures/reactions/fallback.json';

function parseArgs(argv) {
  const args = {
    fixture: undefined,
    target: undefined, // emulator | prod
    emulatorHost: undefined,
    emulatorPort: undefined,
    collection: undefined,
    projectId: undefined,
    allowProd: false,
    required: false,
    overwrite: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--fixture' && next) {
      args.fixture = next;
      i += 1;
      continue;
    }

    if (token === '--target' && next) {
      args.target = next;
      i += 1;
      continue;
    }

    if (token === '--emulatorHost' && next) {
      args.emulatorHost = next;
      i += 1;
      continue;
    }

    if (token === '--emulatorPort' && next) {
      args.emulatorPort = Number(next);
      i += 1;
      continue;
    }

    if (token === '--collection' && next) {
      args.collection = next;
      i += 1;
      continue;
    }

    if (token === '--projectId' && next) {
      args.projectId = next;
      i += 1;
      continue;
    }

    if (token === '--allowProd') {
      args.allowProd = true;
      continue;
    }

    if (token === '--required') {
      args.required = true;
      continue;
    }

    if (token === '--overwrite') {
      args.overwrite = true;
      continue;
    }
  }

  return args;
}

function loadDotEnvIfPresent(envPath = '.env') {
  const abs = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Read and validate a fixture file. Supports two formats:
 *
 * 1. Single-collection (existing):  { version, description, docs: [{ id, data }] }
 * 2. Multi-collection (prod export): { "collection-name": { version, description, docs }, ... }
 *
 * Returns either:
 *   { mode: 'single', version, description, docs }
 *   { mode: 'multi',  collections: { [name]: { version, description, docs } } }
 */
function readFixture(fixturePath) {
  const abs = path.resolve(process.cwd(), fixturePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const json = JSON.parse(raw);

  if (!json || typeof json !== 'object') {
    throw new Error('Fixture is not a JSON object');
  }

  // ── Single-collection format (has top-level docs array) ──
  if (Array.isArray(json.docs)) {
    const docs = json.docs;
    if (!docs.length) {
      throw new Error(`Fixture has no docs: ${fixturePath}`);
    }
    validateDocs(docs, fixturePath);
    return { mode: 'single', version: json.version ?? 1, description: json.description ?? '', docs };
  }

  // ── Multi-collection format (keys are collection names) ──
  const collections = {};
  for (const [collName, value] of Object.entries(json)) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.docs)) {
      throw new Error(`Multi-collection fixture: key "${collName}" is missing a docs array in ${fixturePath}`);
    }
    if (!value.docs.length) {
      console.log(`  [warn] collection "${collName}" has 0 docs — skipping`);
      continue;
    }
    validateDocs(value.docs, fixturePath);
    collections[collName] = { version: value.version ?? 1, description: value.description ?? '', docs: value.docs };
  }

  if (!Object.keys(collections).length) {
    throw new Error(`Fixture has no docs in any collection: ${fixturePath}`);
  }

  return { mode: 'multi', collections };
}

function validateDocs(docs, fixturePath) {
  for (const doc of docs) {
    if (!doc?.id || typeof doc.id !== 'string') {
      throw new Error(`Fixture doc missing string id: ${fixturePath}`);
    }
    if (!doc?.data || typeof doc.data !== 'object') {
      throw new Error(`Fixture doc missing data object for id=${doc.id}: ${fixturePath}`);
    }
  }
}

function ensureAdminApp({ projectId, target }) {
  if (admin.apps.length) {
    return admin.app();
  }

  if (target === 'emulator') {
    return admin.initializeApp({ projectId });
  }

  // target === 'prod'
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccount?.startsWith('{')) {
    const parsed = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  return admin.initializeApp({ projectId });
}

async function seed() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const target = args.target || process.env.FIREBASE_SEED_TARGET || (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'emulator');
  
  let configProjectId;
  if (process.env.PUBLIC_FIREBASE_CONFIG) {
    try {
        const parsed = JSON.parse(process.env.PUBLIC_FIREBASE_CONFIG);
        configProjectId = parsed.projectId;
    } catch (e) {
        // ignore
    }
  }

  const defaultProjectId = target === 'emulator' ? 'demo-pure-reactions' : 'pure-reactions';
  const projectId = args.projectId || process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || configProjectId || defaultProjectId;
  const collection =
    args.collection ||
    process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES ||
    'reactions-local';

  const fixturePath = args.fixture || process.env.FIREBASE_SEED_FIXTURE || DEFAULT_FIXTURE;

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown seed target: ${target}`);
  }

  if (target === 'prod') {
    const allow = args.allowProd || process.env.ALLOW_PROD_SEED === '1' || process.env.ALLOW_PROD_SEED === 'true';
    if (!allow) {
      throw new Error('Refusing to seed prod: set ALLOW_PROD_SEED=1 or pass --allowProd');
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('Missing prod credentials: set FIREBASE_SERVICE_ACCOUNT');
    }
  }

  if (target === 'emulator') {
    const host = args.emulatorHost || process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port =
      Number(args.emulatorPort) ||
      Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) ||
      Number(process.env.PUBLIC_FIRESTORE_EMULATOR_PORT) ||
      8080;

    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  }

  const fixture = readFixture(fixturePath);

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();

  const overwrite = args.overwrite || String(process.env.FIREBASE_SEED_OVERWRITE || '').toLowerCase() === 'true';

  // Build the list of (collectionName, docs) pairs to seed.
  // Single-collection mode uses the --collection flag; multi-collection mode
  // uses the keys from the fixture file (ignoring --collection).
  const seedPairs =
    fixture.mode === 'multi'
      ? Object.entries(fixture.collections).map(([name, f]) => ({ collection: name, docs: f.docs }))
      : [{ collection, docs: fixture.docs }];

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { collection: coll, docs } of seedPairs) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of docs) {
      const ref = db.collection(coll).doc(entry.id);
      const snap = await ref.get();

      if (snap.exists && !overwrite) {
        skipped += 1;
        continue;
      }

      const payload = {
        ...entry.data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await ref.set(payload, { merge: false });
      if (snap.exists) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    const message = `[seed-firestore-fixtures] target=${target} projectId=${projectId} collection=${coll} fixture=${fixturePath} created=${created} updated=${updated} skipped=${skipped}`;
    // eslint-disable-next-line no-console
    console.log(message);

    // Verification step
    if (created > 0 || updated > 0) {
      const checkId = docs[0].id;
      const checkRef = db.collection(coll).doc(checkId);
      const checkSnap = await checkRef.get();
      if (checkSnap.exists) {
        console.log(`[seed-firestore-fixtures] VERIFICATION SUCCESS: Found doc ${checkId} in ${coll}`);
      } else {
        console.error(`[seed-firestore-fixtures] VERIFICATION FAILED: Could not find doc ${checkId} in ${coll} after write!`);
      }
    }

    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(`[seed-firestore-fixtures] FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}`);
  if (fixture.mode === 'multi') {
    console.log(`[seed-firestore-fixtures] Multi-collection seed complete: ${seedPairs.length} collections, created=${totalCreated} updated=${totalUpdated} skipped=${totalSkipped}`);
  }

  return { created: totalCreated, skipped: totalSkipped };
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[seed-firestore-fixtures] failed', error);
  process.exitCode = 1;
});

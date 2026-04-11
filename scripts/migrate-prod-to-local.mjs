#!/usr/bin/env node

// Usage:
//   node scripts/migrate-prod-to-local.mjs [--dry]
//
// Deletes all documents in local Firestore collections and copies
// the corresponding production documents into them.
//
// --dry   Report what would happen without making changes.
//
// Environment:
//   FIREBASE_SERVICE_ACCOUNT  Path to service account JSON (set by npm script)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

// ─── Helpers (shared pattern with other scripts) ────────────────────────────

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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function ensureAdminApp({ projectId }) {
  if (admin.apps.length) return admin.app();

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  return admin.initializeApp({ projectId });
}

// ─── Collection mapping ─────────────────────────────────────────────────────

function buildCollectionPairs() {
  // Read local names from env vars (with defaults), derive prod by suffix swap.
  const pairs = [
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES',
      defaultLocal: 'reactions-local',
      defaultProd: 'reactions-prod'
    },
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_USER_DATA',
      defaultLocal: 'userdata-local',
      defaultProd: 'userdata-prod'
    },
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_PLAYLISTS',
      defaultLocal: 'playlists-local',
      defaultProd: 'playlists-prod'
    },
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_QUEUES',
      defaultLocal: 'queues-local',
      defaultProd: 'queues-prod'
    },
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS',
      defaultLocal: 'youtubeChannelClaims_local',
      defaultProd: 'youtubeChannelClaims_prod'
    },
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS',
      defaultLocal: 'youtubeChannelVerifications_local',
      defaultProd: 'youtubeChannelVerifications_prod'
    }
  ];

  return pairs.map(({ envKey, defaultLocal, defaultProd }) => {
    const local = process.env[envKey] || defaultLocal;
    // Derive prod name: replace trailing -local / _local with -prod / _prod
    const prod = local.replace(/[-_]local$/, (m) => m[0] + 'prod');
    return { envKey, local, prod, defaultProd };
  });
}

// ─── Firestore operations ───────────────────────────────────────────────────

const BATCH_SIZE = 500;

async function deleteCollection(db, collectionName) {
  const collRef = db.collection(collectionName);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collRef.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snapshot.size;
  }

  return totalDeleted;
}

async function copyCollection(db, source, dest) {
  const sourceRef = db.collection(source);
  let totalCopied = 0;
  let lastDoc = null;

  while (true) {
    let query = sourceRef.orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      const destRef = db.collection(dest).doc(doc.id);
      batch.set(destRef, doc.data());
    }
    await batch.commit();

    totalCopied += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return totalCopied;
}

async function countCollection(db, collectionName) {
  // Use aggregation query for efficiency (Firestore v2)
  try {
    const snap = await db.collection(collectionName).count().get();
    return snap.data().count;
  } catch {
    // Fallback: stream IDs
    const snap = await db.collection(collectionName).select().get();
    return snap.size;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const dry = process.argv.includes('--dry');

  loadDotEnvIfPresent('.env');

  let configProjectId;
  if (process.env.PUBLIC_FIREBASE_CONFIG) {
    try {
      configProjectId = JSON.parse(process.env.PUBLIC_FIREBASE_CONFIG).projectId;
    } catch {
      // ignore
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.PUBLIC_FIREBASE_PROJECT_ID ||
    configProjectId ||
    'pure-reactions';

  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('Missing credentials: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  ensureAdminApp({ projectId });
  const db = admin.firestore();

  const pairs = buildCollectionPairs();
  const mode = dry ? 'DRY RUN' : 'LIVE';

  console.log(`\n  migrate:prod-to-local  [${mode}]`);
  console.log(`  project: ${projectId}`);
  console.log('  ─────────────────────────────────────────\n');

  for (const { local, prod } of pairs) {
    const prodCount = await countCollection(db, prod);
    const localCount = await countCollection(db, local);

    console.log(`  ${prod}  →  ${local}`);
    console.log(`    prod docs:  ${prodCount}`);
    console.log(`    local docs: ${localCount} (to be deleted)`);

    if (dry) {
      console.log(`    [dry] would delete ${localCount}, copy ${prodCount}\n`);
      continue;
    }

    const deleted = await deleteCollection(db, local);
    console.log(`    deleted:    ${deleted}`);

    const copied = await copyCollection(db, prod, local);
    console.log(`    copied:     ${copied}\n`);
  }

  console.log(dry ? '  Dry run complete — no changes made.\n' : '  Migration complete.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

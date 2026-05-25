#!/usr/bin/env node

// Usage:
//   node scripts/migrate-prod-to-local.mjs [--dry]
//   node scripts/migrate-prod-to-local.mjs --export-json <path>
//
// Default mode: Deletes all documents in local Firestore collections
// and copies the corresponding production documents into them.
//
// --dry              Report what would happen without making changes.
// --export-json <p>  Instead of writing to Firestore, export each prod
//                    collection to a JSON file at <p>. The format is
//                    compatible with seed-firestore-fixtures.mjs so
//                    the file can be fed to the emulator seed script.
//                    One file per collection is written, using the
//                    pattern <p> with the collection name inserted
//                    (e.g. tests/fixtures/reactions/prod-export.json
//                    becomes the output path directly).
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

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!serviceAccount) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  let credentials;
  if (serviceAccount.startsWith('{')) {
    credentials = JSON.parse(serviceAccount);
  } else {
    // Assume it's a file path
    credentials = JSON.parse(fs.readFileSync(serviceAccount, 'utf8'));
  }
  return admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: projectId || credentials.project_id
  });
}

// ─── Collection mapping ─────────────────────────────────────────────────────

function buildCollectionPairs() {
  // Read local names from env vars (with defaults), derive prod by suffix swap.
  const pairs = [
    {
      envKey: 'PUBLIC_FIREBASE_COLLECTION_MOMENTS',
      defaultLocal: 'moments-local',
      defaultProd: 'moments-prod'
    },
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

  return pairs.map(({ envKey, defaultLocal, defaultProd: fallbackProd }) => {
    const local = process.env[envKey] || defaultLocal;
    // Derive prod name: replace trailing -local / _local with -prod / _prod
    const prod = local.replace(/[-_]local$/, (m) => m[0] + 'prod');
    return { envKey, local, prod, defaultProd: fallbackProd };
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

// ─── Serialization helpers ──────────────────────────────────────────────────

/**
 * Convert Firestore-specific types (Timestamp, GeoPoint, DocumentReference)
 * into plain JSON-safe values so the exported file can be loaded by
 * seed-firestore-fixtures.mjs without any special handling.
 */
function serializeDocData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  // Firestore Timestamp → ISO string
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // Firestore GeoPoint → { lat, lng }
  if (typeof data.latitude === 'number' && typeof data.longitude === 'number' && Object.keys(data).length === 2) {
    return { lat: data.latitude, lng: data.longitude };
  }

  // Firestore DocumentReference → path string
  if (typeof data.path === 'string' && typeof data.firestore === 'object') {
    return data.path;
  }

  // Array
  if (Array.isArray(data)) {
    return data.map(serializeDocData);
  }

  // Plain object — recurse
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = serializeDocData(value);
  }
  return out;
}

// ─── JSON export ────────────────────────────────────────────────────────────

async function readCollectionDocs(db, collectionName) {
  const docs = [];
  let lastDoc = null;

  while (true) {
    let query = db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      docs.push({ id: doc.id, data: serializeDocData(doc.data()) });
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return docs;
}

async function exportCollectionsToJson(db, pairs, outputPath) {
  const result = {};

  for (const { prod, local } of pairs) {
    const docs = await readCollectionDocs(db, prod);
    console.log(`  ${prod}  →  ${docs.length} docs read`);

    // Store under the local collection name so the seed script can target
    // the correct emulator collection with --collection <name>.
    result[local] = {
      version: 1,
      description: `Prod export from ${prod} (${new Date().toISOString()})`,
      docs
    };
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`\n  Exported to ${outputPath}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const dry = process.argv.includes('--dry');

  // Parse --export-json <path>
  const exportIdx = process.argv.indexOf('--export-json');
  const exportJsonPath = exportIdx !== -1 ? process.argv[exportIdx + 1] : null;
  if (exportIdx !== -1 && !exportJsonPath) {
    console.error('--export-json requires a file path argument');
    process.exit(1);
  }

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

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Missing credentials: set FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }

  ensureAdminApp({ projectId });
  const db = admin.firestore();

  const pairs = buildCollectionPairs();
  const mode = exportJsonPath ? 'EXPORT JSON' : dry ? 'DRY RUN' : 'LIVE';

  console.log(`\n  migrate:prod-to-local  [${mode}]`);
  console.log(`  project: ${projectId}`);
  console.log('  ─────────────────────────────────────────\n');

  // ── Export-JSON branch ──────────────────────────────────────────────────
  if (exportJsonPath) {
    await exportCollectionsToJson(db, pairs, path.resolve(process.cwd(), exportJsonPath));
    return;
  }

  // ── Default: cloud-to-cloud copy ──────────────────────────────────────
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

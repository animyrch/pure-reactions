#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

function parseArgs(argv) {
  const args = {
    target: undefined, // emulator | prod
    emulatorHost: undefined,
    emulatorPort: undefined,
    collection: undefined,
    projectId: undefined,
    allowProd: false,
    apply: false,
    dryRun: false,
    pageSize: undefined,
    maxDocs: undefined,
    force: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

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

    if (token === '--pageSize' && next) {
      args.pageSize = Number(next);
      i += 1;
      continue;
    }

    if (token === '--maxDocs' && next) {
      args.maxDocs = Number(next);
      i += 1;
      continue;
    }

    if (token === '--allowProd') {
      args.allowProd = true;
      continue;
    }

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    if (token === '--dryRun') {
      args.dryRun = true;
      continue;
    }

    if (token === '--force') {
      args.force = true;
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

function ensureAdminApp({ projectId, target }) {
  if (admin.apps.length) {
    return admin.app();
  }

  if (target === 'emulator') {
    return admin.initializeApp({ projectId });
  }

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

function hasNonEmptyTimeline(value) {
  // Treat an empty array as an intentional "new schema" timeline.
  // This allows safely deleting legacy *Configs even when the timeline has no entries yet.
  return Array.isArray(value);
}

function legacyFieldPresent(docData, fieldName) {
  if (!docData || typeof docData !== 'object') {
    return false;
  }

  // We only touch if the field exists on the document (even if null).
  return Object.prototype.hasOwnProperty.call(docData, fieldName);
}

async function migrate() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const target = args.target || process.env.FIREBASE_SEED_TARGET || (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'prod');
  const projectId = args.projectId || process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || 'pure-reactions';
  const collection = args.collection || process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions-local';

  const pageSizeRaw = Number(args.pageSize ?? 250);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 500) : 250;

  const maxDocsRaw = args.maxDocs === undefined ? undefined : Number(args.maxDocs);
  const maxDocs = maxDocsRaw !== undefined && Number.isFinite(maxDocsRaw) && maxDocsRaw > 0 ? Math.floor(maxDocsRaw) : undefined;

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown target: ${target}`);
  }

  // Safety: default to dry-run unless explicitly applying.
  const apply = Boolean(args.apply);
  const dryRun = args.dryRun || !apply;
  const force = Boolean(args.force);

  if (target === 'prod') {
    const allow = args.allowProd || process.env.ALLOW_PROD_MIGRATION === '1' || process.env.ALLOW_PROD_MIGRATION === 'true';
    if (!allow) {
      throw new Error('Refusing to migrate prod: set ALLOW_PROD_MIGRATION=1 or pass --allowProd');
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error('Missing prod credentials: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON');
    }

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log('[migrate-delete-legacy-timelines] prod dry-run (no writes)');
    }
  }

  if (target === 'emulator') {
    const host = args.emulatorHost || process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = Number(args.emulatorPort) || Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) || Number(process.env.PUBLIC_FIRESTORE_EMULATOR_PORT) || 8080;
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  }

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();

  const deleteSentinel = admin.firestore.FieldValue.delete();

  let scanned = 0;
  let eligible = 0;
  let updated = 0;
  let wouldUpdate = 0;
  let skippedNoTimelines = 0;
  let skippedNoLegacyFields = 0;

  let lastDoc = null;

  // eslint-disable-next-line no-console
  console.log(
    `[migrate-delete-legacy-timelines] target=${target} projectId=${projectId} collection=${collection} pageSize=${pageSize} mode=${dryRun ? 'dry-run' : 'apply'} force=${force}`
  );

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log('[migrate-delete-legacy-timelines] DRY RUN: no writes will be performed. Pass --apply to commit changes.');
  }

  while (true) {
    if (maxDocs !== undefined && scanned >= maxDocs) {
      break;
    }

    let query = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    let batch = db.batch();
    let batchOps = 0;

    for (const docSnap of snapshot.docs) {
      if (maxDocs !== undefined && scanned >= maxDocs) {
        break;
      }

      scanned += 1;
      const data = docSnap.data() || {};

      const hasStateTimeline = hasNonEmptyTimeline(data.stateTimeline);
      const hasVolumeTimeline = hasNonEmptyTimeline(data.volumeTimeline);
      const hasPlaybackTimeline = hasNonEmptyTimeline(data.playbackTimeline);
      const hasReactionVolumeTimeline = hasNonEmptyTimeline(data.reactionVolumeTimeline);

      const legacyReactionPresent = legacyFieldPresent(data, 'reactionConfigs');
      const legacyVolumePresent = legacyFieldPresent(data, 'volumeConfigs');
      const legacyPlaybackPresent = legacyFieldPresent(data, 'playbackRateConfigs');
      const legacyReactionVolumePresent = legacyFieldPresent(data, 'reactionVolumeConfigs');

      if (!legacyReactionPresent && !legacyVolumePresent && !legacyPlaybackPresent && !legacyReactionVolumePresent) {
        skippedNoLegacyFields += 1;
        continue;
      }

      const shouldDeleteReaction = legacyReactionPresent && (force || hasStateTimeline);
      const shouldDeleteVolume = legacyVolumePresent && (force || hasVolumeTimeline);
      const shouldDeletePlayback = legacyPlaybackPresent && (force || hasPlaybackTimeline);
      const shouldDeleteReactionVolume = legacyReactionVolumePresent && (force || hasReactionVolumeTimeline);

      if (!shouldDeleteReaction && !shouldDeleteVolume && !shouldDeletePlayback && !shouldDeleteReactionVolume) {
        skippedNoTimelines += 1;
        continue;
      }

      eligible += 1;

      const patch = {
        ...(shouldDeleteReaction ? { reactionConfigs: deleteSentinel } : {}),
        ...(shouldDeleteVolume ? { volumeConfigs: deleteSentinel } : {}),
        ...(shouldDeletePlayback ? { playbackRateConfigs: deleteSentinel } : {}),
        ...(shouldDeleteReactionVolume ? { reactionVolumeConfigs: deleteSentinel } : {})
      };

      if (dryRun) {
        wouldUpdate += 1;
      } else {
        batch.update(docSnap.ref, patch);
        batchOps += 1;

        if (batchOps >= 500) {
          await batch.commit();
          updated += batchOps;
          batch = db.batch();
          batchOps = 0;
        }
      }
    }

    if (!dryRun && batchOps > 0) {
      await batch.commit();
      updated += batchOps;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // eslint-disable-next-line no-console
    console.log(
      `[migrate-delete-legacy-timelines] progress scanned=${scanned} eligible=${eligible} ${dryRun ? `wouldUpdate=${wouldUpdate}` : `updated=${updated}`} skippedNoTimelines=${skippedNoTimelines} skippedNoLegacyFields=${skippedNoLegacyFields}`
    );

    if (snapshot.size < pageSize) {
      break;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[migrate-delete-legacy-timelines] done scanned=${scanned} eligible=${eligible} ${dryRun ? `wouldUpdate=${wouldUpdate}` : `updated=${updated}`} skippedNoTimelines=${skippedNoTimelines} skippedNoLegacyFields=${skippedNoLegacyFields}`
  );

  if (scanned === 0) {
    // eslint-disable-next-line no-console
    console.log('[migrate-delete-legacy-timelines] Note: scanned=0 usually means the collection is empty or the collection name / projectId is wrong.');
  }

  if (dryRun && eligible === 0 && scanned > 0) {
    // eslint-disable-next-line no-console
    console.log('[migrate-delete-legacy-timelines] Note: eligible=0. If docs still have legacy fields but lack timeline arrays, rerun with --force (more dangerous).');
  }
}

migrate().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[migrate-delete-legacy-timelines] failed', error);
  process.exitCode = 1;
});

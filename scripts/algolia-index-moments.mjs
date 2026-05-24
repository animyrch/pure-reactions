#!/usr/bin/env node

/**
 * Index Firestore moments into Algolia.
 *
 * Usage:
 *   node scripts/algolia-index-moments.mjs
 *   node scripts/algolia-index-moments.mjs --apply
 */

import algoliasearch from 'algoliasearch';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = { apply: false, batchSize: 500, target: 'prod', collection: undefined, index: undefined };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--apply') args.apply = true;
    if (token === '--target' && next) {
      args.target = next;
      i += 1;
    }
    if (token === '--batchSize' && next) {
      args.batchSize = Number(next);
      i += 1;
    }
    if (token === '--collection' && next) {
      args.collection = next;
      i += 1;
    }
    if (token === '--index' && next) {
      args.index = next;
      i += 1;
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function momentToAlgoliaRecord(docId, data) {
  return {
    objectID: docId,
    title: data.title || '',
    slug: data.slug || docId,
    originalVideoId: data.originalVideoId || '',
    originalVideoTitle: data.originalVideoTitle || '',
    originalVideoAuthor: data.originalVideoAuthor || '',
    originalVideoThumbnailUrl: data.originalVideoThumbnailUrl || '',
    originalVideoPlatform: data.originalVideoPlatform || 'youtube',
    momentTimeSeconds: Number(data.momentTimeSeconds) || 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    reactionCount: Number(data.reactionCount) || 0,
    creatorId: data.creatorId || '',
    creatorDisplayName: data.creatorDisplayName || '',
    createdAt: data.createdAt?.toMillis?.() || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || Date.now()
  };
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const appId = process.env.PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  // Allow --index to override env/default
  let indexName = args.index || process.env.PUBLIC_ALGOLIA_MOMENTS_INDEX;

  if (!appId || !adminKey || !indexName) {
    throw new Error(
      'Missing Algolia config: PUBLIC_ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, PUBLIC_ALGOLIA_MOMENTS_INDEX (or --index)'
    );
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || 'pure-reactions';
  // Allow --collection to override env/default
  const collection = args.collection || process.env.PUBLIC_FIREBASE_COLLECTION_MOMENTS || 'moments_local';

  if (!admin.apps.length) {
    if (args.target === 'emulator') {
      admin.initializeApp({ projectId });
    } else {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
      if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is required for prod indexing');
      }
      const parsed = serviceAccount.startsWith('{')
        ? JSON.parse(serviceAccount)
        : JSON.parse(fs.readFileSync(path.resolve(process.cwd(), serviceAccount), 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(parsed), projectId });
    }
  }

  const db = admin.firestore();
  console.log(`\n[DEBUG] Using collection: ${collection}`);
  const snapshot = await db.collection(collection).get();
  console.log(`[DEBUG] Firestore returned ${snapshot.size} docs`);
  if (snapshot.size > 0) {
    const firstDoc = snapshot.docs[0];
    console.log(`[DEBUG] First doc id: ${firstDoc.id}`);
    console.log(`[DEBUG] First doc data:`, JSON.stringify(firstDoc.data(), null, 2));
  }
  const records = snapshot.docs.map((doc) => momentToAlgoliaRecord(doc.id, doc.data()));

  console.log(`Prepared ${records.length} moment records for index "${indexName}"`);

  if (!args.apply) {
    console.log('Dry run complete. Re-run with --apply to push records.');
    return;
  }

  const client = algoliasearch(appId, adminKey);
  const index = client.initIndex(indexName);
  await index.saveObjects(records);
  console.log(`Indexed ${records.length} moments.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

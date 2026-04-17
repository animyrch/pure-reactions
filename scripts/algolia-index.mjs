#!/usr/bin/env node

/**
 * Algolia Indexing Script
 *
 * Reindexes reactions from Firestore to Algolia.
 * Supports full reindex, incremental updates, and dry-run mode.
 *
 * Usage:
 *   node scripts/algolia-index.mjs                          # Dry run
 *   node scripts/algolia-index.mjs --apply                  # Apply changes
 *   node scripts/algolia-index.mjs --apply --clear          # Clear and reindex
 *
 * Options:
 *   --apply         Actually push changes to Algolia (default: dry run)
 *   --clear         Clear existing index before reindexing
 *   --target        'emulator' or 'prod' (default: 'prod')
 *   --collection    Override Firestore collection name
 *   --index, --indexName, --index-name
 *                   Override Algolia index name (CLI takes precedence over PUBLIC_ALGOLIA_REACTIONS_INDEX)
 *   --batchSize     Records per batch (default: 1000)
 */

import algoliasearch from 'algoliasearch';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = {
    apply: false,
    clear: false,
    target: 'prod',
    collection: undefined,
    indexName: undefined,
    batchSize: 1000
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    if (token === '--clear') {
      args.clear = true;
      continue;
    }

    if (token === '--target' && next) {
      args.target = next;
      i += 1;
      continue;
    }

    if (token === '--collection' && next) {
      args.collection = next;
      i += 1;
      continue;
    }

    if ((token === '--index' || token === '--indexName' || token === '--index-name') && next) {
      args.indexName = next;
      i += 1;
      continue;
    }

    if (token === '--batchSize' && next) {
      args.batchSize = Number(next);
      i += 1;
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

  // target === 'prod'
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccount) {
    if (!serviceAccount.startsWith('{')) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT must be an inline JSON string in scripts/algolia-index.mjs; file paths are not supported.'
      );
    }

    const parsed = JSON.parse(serviceAccount);

    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  return admin.initializeApp({ projectId });
}

/**
 * Convert Firestore reaction document to Algolia record
 * Keep only essential, searchable fields to minimize index size and cost
 */
function reactionToAlgoliaRecord(docId, data) {
  const record = {
    objectID: docId,
    // Essential metadata
    reactionVideoId: data.reactionVideoId || '',
    reactionVideoTitle: data.reactionVideoTitle || '',
    originalVideoId: data.originalVideoId || '',
    originalVideoTitle: data.originalVideoTitle || '',
    playlistId: data.playlistId || '',
    
    // Reactor/channel information
    reactionVideoAuthor: data.reactionVideoAuthor || '',
    
    // Tags for filtering
    tags: Array.isArray(data.tags) ? data.tags : [],
    
    // Timestamps for sorting
    createdAt: data.createdAt?.toMillis?.() || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
    
    // Status/visibility handled by the Firestore query; not stored in Algolia
    
    // Slugs/IDs for linking
    slug: data.slug || docId,
  };

  // INTENTIONALLY EXCLUDED to minimize cost and payload:
  // - timelines (large arrays)
  // - transcripts (large text)
  // - configs (playback state)
  // - thumbnails (URLs available from video IDs)
  // - descriptions (can be large)

  return record;
}

async function indexReactions() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  console.log('\n=== Algolia Indexing Script ===\n');
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Clear index: ${args.clear ? 'YES' : 'NO'}`);
  console.log(`Batch size: ${args.batchSize}\n`);

  // Algolia config
  const appId = process.env.PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  const indexName = args.indexName || process.env.PUBLIC_ALGOLIA_REACTIONS_INDEX;

  if (!appId || !adminKey || !indexName) {
    throw new Error('Missing Algolia config: PUBLIC_ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, PUBLIC_ALGOLIA_REACTIONS_INDEX');
  }

  // Firebase config
  const target = args.target;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || 'pure-reactions';
  const collection = args.collection || process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions';

  console.log(`Algolia App: ${appId}`);
  console.log(`Algolia Index: ${indexName}`);
  console.log(`Firebase Target: ${target}`);
  console.log(`Firebase Project: ${projectId}`);
  console.log(`Firebase Collection: ${collection}\n`);

  // Setup Firebase emulator if needed
  if (target === 'emulator') {
    const host = process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port =
      Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) ||
      Number(process.env.PUBLIC_FIRESTORE_EMULATOR_PORT) ||
      8080;
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
    console.log(`Using Firestore emulator: ${host}:${port}\n`);
  }

  // Initialize services
  const algoliaClient = algoliasearch(appId, adminKey);
  const algoliaIndex = algoliaClient.initIndex(indexName);

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();

  // Fetch published reactions from Firestore (only index published content)
  console.log('Fetching published reactions from Firestore...');
  const snapshot = await db.collection(collection).where('isPublished', '==', true).get();
  console.log(`Found ${snapshot.size} published reactions\n`);

  if (snapshot.empty) {
    console.log('⚠️  No reactions to index');
    return { indexed: 0, skipped: 0 };
  }

  // Convert to Algolia records
  const records = [];
  let skipped = 0;

  for (const doc of snapshot.docs) {
    try {
      const record = reactionToAlgoliaRecord(doc.id, doc.data());
      records.push(record);
    } catch (error) {
      console.error(`Error converting doc ${doc.id}:`, error.message);
      skipped += 1;
    }
  }

  console.log(`Prepared ${records.length} records for indexing`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} records due to errors\n`);
  }

  // Show sample record
  if (records.length > 0) {
    console.log('Sample record:');
    console.log(JSON.stringify(records[0], null, 2));
    console.log('');
  }

  if (!args.apply) {
    console.log('=== DRY RUN COMPLETE ===');
    console.log('No changes made. Use --apply to push to Algolia.\n');
    return { indexed: 0, skipped, dryRun: true };
  }

  // Clear index if requested
  if (args.clear) {
    console.log('Clearing existing index...');
    await algoliaIndex.clearObjects();
    console.log('✓ Index cleared\n');
  }

  // Configure index settings for optimal search
  console.log('Configuring index settings...');
  await algoliaIndex.setSettings({
    // Searchable attributes in order of importance
    searchableAttributes: [
      'reactionVideoTitle',
      'originalVideoTitle',
      'reactionVideoAuthor',
      'tags'
    ],
    // Attributes to retrieve in search results
    attributesToRetrieve: [
      'reactionVideoId',
      'reactionVideoTitle',
      'originalVideoId',
      'originalVideoTitle',
      'reactionVideoAuthor',
      'tags',
      'slug',
      'createdAt',
      'updatedAt'
    ],
    // Attributes for faceting/filtering
    attributesForFaceting: [
      'searchable(reactionVideoAuthor)',
      'searchable(tags)',
      
    ],
    // Custom ranking
    customRanking: [
      'desc(createdAt)'
    ],
    // Typo tolerance (Note: Algolia API uses these exact names, not camelCase)
    minWordSizefor1Typo: 4,
    minWordSizefor2Typos: 8,
    // Highlighting
    attributesToHighlight: [
      'reactionVideoTitle',
      'originalVideoTitle',
      'reactionVideoAuthor'
    ],
    // Snippet
    attributesToSnippet: [
      'reactionVideoTitle:20',
      'originalVideoTitle:20'
    ]
  });
  console.log('✓ Index settings configured\n');

  // Batch index records
  console.log('Indexing records...');
  let indexed = 0;
  
  for (let i = 0; i < records.length; i += args.batchSize) {
    const batch = records.slice(i, i + args.batchSize);
    await algoliaIndex.saveObjects(batch);
    indexed += batch.length;
    console.log(`  Indexed ${indexed}/${records.length} records`);
  }

  console.log('\n✓ Indexing complete!');
  console.log(`\n=== Summary ===`);
  console.log(`Total indexed: ${indexed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Index: ${indexName}\n`);

  return { indexed, skipped };
}

indexReactions().catch((error) => {
  console.error('[algolia-index] failed', error);
  process.exitCode = 1;
});

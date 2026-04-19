#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

const YOUTUBE_PLATFORM = 'youtube';
const TIKTOK_PLATFORM = 'tiktok';
const BATCH_SIZE = 200;

function parseArgs(argv) {
  const args = {
    target: undefined,
    projectId: undefined,
    playlistCollection: undefined,
    reactionCollection: undefined,
    playlistDocumentId: undefined,
    limit: undefined,
    pageSize: undefined,
    allowProd: false,
    apply: false,
    emulatorHost: undefined,
    emulatorPort: undefined,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--target' && next) {
      args.target = next;
      index += 1;
      continue;
    }

    if (token === '--projectId' && next) {
      args.projectId = next;
      index += 1;
      continue;
    }

    if ((token === '--playlistCollection' || token === '--playlist-collection') && next) {
      args.playlistCollection = next;
      index += 1;
      continue;
    }

    if ((token === '--reactionCollection' || token === '--reaction-collection') && next) {
      args.reactionCollection = next;
      index += 1;
      continue;
    }

    if ((token === '--playlistDocumentId' || token === '--playlistId') && next) {
      args.playlistDocumentId = next;
      index += 1;
      continue;
    }

    if (token === '--limit' && next) {
      args.limit = Number(next);
      index += 1;
      continue;
    }

    if (token === '--pageSize' && next) {
      args.pageSize = Number(next);
      index += 1;
      continue;
    }

    if (token === '--emulatorHost' && next) {
      args.emulatorHost = next;
      index += 1;
      continue;
    }

    if (token === '--emulatorPort' && next) {
      args.emulatorPort = Number(next);
      index += 1;
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

    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printUsage() {
  console.log(`repair-playlist-queue-titles.mjs

Usage:
  node scripts/repair-playlist-queue-titles.mjs [options]

Options:
  --apply                          Commit writes. Default is dry-run.
  --target emulator|prod           Firestore target. Default follows env.
  --allowProd                      Required for prod writes or prod dry-runs.
  --playlistDocumentId <id>        Repair a single playlist document.
  --playlistCollection <name>      Override playlist collection.
  --reactionCollection <name>      Override reaction collection.
  --limit <n>                      Stop after scanning n playlists.
  --pageSize <n>                   Playlist page size. Default 200.
  --projectId <id>                 Override Firebase project id.
  --emulatorHost <host>            Override emulator host.
  --emulatorPort <port>            Override emulator port.

Examples:
  npm run admin:repair-playlist-queue-titles -- --target prod --allowProd
  npm run admin:repair-playlist-queue-titles:apply -- --target prod --allowProd
  npm run admin:repair-playlist-queue-titles -- --target prod --allowProd --playlistDocumentId abc123
`);
}

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
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

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccount?.startsWith('{')) {
    const parsed = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id,
    });
  }

  if (serviceAccount) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), serviceAccount), 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id,
    });
  }

  return admin.initializeApp({ projectId });
}

function resolveTarget(args) {
  return args.target || process.env.FIREBASE_SEED_TARGET || (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'prod');
}

function resolveProjectId(args, target) {
  let configProjectId;
  if (process.env.PUBLIC_FIREBASE_CONFIG) {
    try {
      configProjectId = JSON.parse(process.env.PUBLIC_FIREBASE_CONFIG).projectId;
    } catch {
      configProjectId = undefined;
    }
  }

  return (
    args.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.PUBLIC_FIREBASE_PROJECT_ID ||
    configProjectId ||
    (target === 'emulator' ? 'demo-pure-reactions' : 'pure-reactions')
  );
}

function swapCollectionSuffixForTarget(name, target) {
  const normalizedName = trimString(name);
  if (!normalizedName) {
    return normalizedName;
  }

  if (target === 'prod') {
    return normalizedName
      .replace(/-local$/i, '-prod')
      .replace(/_local$/i, '_prod');
  }

  return normalizedName
    .replace(/-prod$/i, '-local')
    .replace(/_prod$/i, '_local');
}

function resolveCollectionName({ requestedName, envName, target, emulatorDefault, prodDefault }) {
  if (requestedName) {
    return requestedName;
  }

  const normalizedEnvName = trimString(envName);
  if (normalizedEnvName) {
    return swapCollectionSuffixForTarget(normalizedEnvName, target);
  }

  return target === 'emulator' ? emulatorDefault : prodDefault;
}

function resolvePlaylistCollection(args, target) {
  return resolveCollectionName({
    requestedName: args.playlistCollection,
    envName: process.env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS,
    target,
    emulatorDefault: 'playlists-local',
    prodDefault: 'playlists-prod',
  });
}

function resolveReactionCollection(args, target) {
  return resolveCollectionName({
    requestedName: args.reactionCollection,
    envName: process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES,
    target,
    emulatorDefault: 'reactions-local',
    prodDefault: 'reactions-prod',
  });
}

function isDegradedTitle(title, item = {}) {
  const normalizedTitle = trimString(title);
  const originalVideoId = trimString(item.originalVideoId);
  const platform = trimString(item.originalVideoPlatform) || YOUTUBE_PLATFORM;
  const label = platform === TIKTOK_PLATFORM ? 'TikTok' : 'YouTube';

  return (
    !normalizedTitle ||
    normalizedTitle === `${label} video` ||
    (originalVideoId && normalizedTitle === `${label} ${originalVideoId}`)
  );
}

function buildPatchedSequenceItem(sequenceItem = {}, reactionData = {}) {
  const nextSequenceItem = { ...sequenceItem };
  let changed = false;

  const reactionOriginalVideoId = trimString(reactionData.originalVideoId);
  const sequenceOriginalVideoId = trimString(sequenceItem.originalVideoId);
  if (
    reactionOriginalVideoId &&
    sequenceOriginalVideoId &&
    reactionOriginalVideoId !== sequenceOriginalVideoId
  ) {
    return { changed: false, sequenceItem };
  }

  const reactionTitle = trimString(reactionData.originalVideoTitle);
  if (reactionTitle && isDegradedTitle(sequenceItem.title, sequenceItem)) {
    nextSequenceItem.title = reactionTitle;
    changed = true;
  }

  const reactionChannelTitle = trimString(reactionData.originalVideoAuthor);
  if (reactionChannelTitle && !trimString(sequenceItem.channelTitle)) {
    nextSequenceItem.channelTitle = reactionChannelTitle;
    changed = true;
  }

  const reactionThumbnailUrl = trimString(reactionData.originalVideoThumbnailUrl);
  if (reactionThumbnailUrl && !trimString(sequenceItem.thumbnailUrl)) {
    nextSequenceItem.thumbnailUrl = reactionThumbnailUrl;
    changed = true;
  }

  const reactionOriginalVideoUrl = trimString(reactionData.originalVideoUrl);
  if (reactionOriginalVideoUrl && !trimString(sequenceItem.originalVideoUrl)) {
    nextSequenceItem.originalVideoUrl = reactionOriginalVideoUrl;
    changed = true;
  }

  const reactionOriginalVideoPlatform = trimString(reactionData.originalVideoPlatform);
  if (reactionOriginalVideoPlatform && !trimString(sequenceItem.originalVideoPlatform)) {
    nextSequenceItem.originalVideoPlatform = reactionOriginalVideoPlatform;
    changed = true;
  }

  if (reactionOriginalVideoId && !sequenceOriginalVideoId) {
    nextSequenceItem.originalVideoId = reactionOriginalVideoId;
    changed = true;
  }

  return {
    changed,
    sequenceItem: nextSequenceItem,
  };
}

async function fetchReactionMap(db, reactionCollection, reactionIds) {
  const uniqueReactionIds = [...new Set(reactionIds.map(trimString).filter(Boolean))];
  const entries = await Promise.all(
    uniqueReactionIds.map(async (reactionId) => {
      const snapshot = await db.collection(reactionCollection).doc(reactionId).get();
      return [reactionId, snapshot.exists ? snapshot.data() : null];
    }),
  );

  return new Map(entries);
}

function buildLegacySequenceItems({ playlistData = {}, reactionMap = new Map() }) {
  const originalVideoIds = Array.isArray(playlistData?.originalVideoIds)
    ? playlistData.originalVideoIds.map(trimString)
    : [];
  const reactionBinomeIds = Array.isArray(playlistData?.reactionBinomeIds)
    ? playlistData.reactionBinomeIds.map(trimString)
    : [];
  const totalItems = Math.max(originalVideoIds.length, reactionBinomeIds.length);

  return Array.from({ length: totalItems }, (_, index) => {
    const reactionId = reactionBinomeIds[index];
    const reactionData = reactionMap.get(reactionId) || {};
    const originalVideoId =
      trimString(originalVideoIds[index]) || trimString(reactionData.originalVideoId);
    const originalVideoPlatform = trimString(reactionData.originalVideoPlatform) || YOUTUBE_PLATFORM;

    return {
      sourceType: originalVideoPlatform === TIKTOK_PLATFORM ? 'tiktok-video' : 'youtube-video',
      sourceIndex: index,
      playlistItemIndex: null,
      originalVideoId,
      originalVideoPlatform,
      originalVideoUrl: trimString(reactionData.originalVideoUrl),
      youtubePlaylistId: trimString(playlistData.youtubePlaylistId),
      title: trimString(reactionData.originalVideoTitle),
      channelTitle: trimString(reactionData.originalVideoAuthor),
      thumbnailUrl: trimString(reactionData.originalVideoThumbnailUrl),
    };
  }).filter((item) => trimString(item.originalVideoId));
}

async function repairPlaylistDocument({
  db,
  playlistRef,
  playlistData,
  reactionCollection,
  apply,
}) {
  const reactionBinomeIds = Array.isArray(playlistData?.reactionBinomeIds)
    ? playlistData.reactionBinomeIds
    : [];
  const storedSequenceItems = Array.isArray(playlistData?.sequenceItems)
    ? playlistData.sequenceItems.map((item) => ({ ...(item || {}) }))
    : [];

  const sequenceItemsToInspect = storedSequenceItems.length
    ? storedSequenceItems
    : buildLegacySequenceItems({
        playlistData,
        reactionMap: await fetchReactionMap(db, reactionCollection, reactionBinomeIds),
      });

  if (!sequenceItemsToInspect.length) {
    return {
      scanned: 1,
      changed: false,
      repairedItems: 0,
      reason: 'no-sequence-data',
    };
  }

  const candidateReactionIds = sequenceItemsToInspect
    .map((item, index) => (isDegradedTitle(item?.title, item) ? reactionBinomeIds[index] : ''))
    .filter(Boolean);

  if (!candidateReactionIds.length) {
    if (!storedSequenceItems.length) {
      if (apply) {
        await playlistRef.set(
          {
            sequenceItems: sequenceItemsToInspect,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return {
        scanned: 1,
        changed: true,
        repairedItems: sequenceItemsToInspect.length,
        reason: apply ? 'created-sequence-items' : 'would-create-sequence-items',
      };
    }

    return {
      scanned: 1,
      changed: false,
      repairedItems: 0,
      reason: 'no-degraded-titles',
    };
  }

  const reactionMap = await fetchReactionMap(db, reactionCollection, candidateReactionIds);
  let repairedItems = 0;

  const nextSequenceItems = sequenceItemsToInspect.map((sequenceItem, index) => {
    if (!isDegradedTitle(sequenceItem?.title, sequenceItem)) {
      return sequenceItem;
    }

    const reactionId = trimString(reactionBinomeIds[index]);
    const reactionData = reactionMap.get(reactionId);
    if (!reactionData) {
      return sequenceItem;
    }

    const patched = buildPatchedSequenceItem(sequenceItem, reactionData);
    if (!patched.changed) {
      return sequenceItem;
    }

    repairedItems += 1;
    return patched.sequenceItem;
  });

  if (!repairedItems) {
    return {
      scanned: 1,
      changed: false,
      repairedItems: 0,
      reason: 'no-internal-metadata-match',
    };
  }

  if (apply) {
    await playlistRef.set(
      {
        sequenceItems: nextSequenceItems,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    scanned: 1,
    changed: true,
    repairedItems,
    reason: apply ? 'updated' : 'dry-run',
  };
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const target = resolveTarget(args);
  const projectId = resolveProjectId(args, target);
  const playlistCollection = resolvePlaylistCollection(args, target);
  const reactionCollection = resolveReactionCollection(args, target);
  const apply = Boolean(args.apply);
  const pageSizeRaw = Number(args.pageSize ?? BATCH_SIZE);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(pageSizeRaw, 500)) : BATCH_SIZE;
  const limitRaw = args.limit === undefined ? undefined : Number(args.limit);
  const maxPlaylists = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined;

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown target: ${target}`);
  }

  if (target === 'prod') {
    const allowProd = args.allowProd || process.env.ALLOW_PROD_MIGRATION === '1' || process.env.ALLOW_PROD_MIGRATION === 'true';
    if (!allowProd) {
      throw new Error('Refusing to access prod without --allowProd or ALLOW_PROD_MIGRATION=1');
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('Missing prod credentials: set FIREBASE_SERVICE_ACCOUNT');
    }
  }

  if (target === 'emulator') {
    const host = args.emulatorHost || process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = Number(args.emulatorPort) || Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) || Number(process.env.PUBLIC_FIRESTORE_EMULATOR_PORT) || 8080;
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  }

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();

  console.log(`[repair-playlist-queue-titles] mode=${apply ? 'apply' : 'dry-run'} target=${target} projectId=${projectId}`);
  console.log(`[repair-playlist-queue-titles] playlistCollection=${playlistCollection} reactionCollection=${reactionCollection}`);

  let scanned = 0;
  let updated = 0;
  let repairedItems = 0;
  let lastDoc;

  if (args.playlistDocumentId) {
    const playlistRef = db.collection(playlistCollection).doc(args.playlistDocumentId);
    const snapshot = await playlistRef.get();
    if (!snapshot.exists) {
      throw new Error(`Playlist not found: ${args.playlistDocumentId}`);
    }

    const result = await repairPlaylistDocument({
      db,
      playlistRef,
      playlistData: snapshot.data(),
      reactionCollection,
      apply,
    });
    scanned += result.scanned;
    updated += result.changed ? 1 : 0;
    repairedItems += result.repairedItems;
    console.log(`[repair-playlist-queue-titles] ${snapshot.id} ${result.reason} repairedItems=${result.repairedItems}`);
  } else {
    let hasMore = true;
    while (hasMore) {
      let query = db.collection(playlistCollection).orderBy('__name__').limit(pageSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      for (const doc of snapshot.docs) {
        if (maxPlaylists !== undefined && scanned >= maxPlaylists) {
          break;
        }

        const result = await repairPlaylistDocument({
          db,
          playlistRef: doc.ref,
          playlistData: doc.data(),
          reactionCollection,
          apply,
        });
        scanned += result.scanned;
        updated += result.changed ? 1 : 0;
        repairedItems += result.repairedItems;
        if (result.changed) {
          console.log(`[repair-playlist-queue-titles] ${doc.id} ${result.reason} repairedItems=${result.repairedItems}`);
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (maxPlaylists !== undefined && scanned >= maxPlaylists) {
        hasMore = false;
        break;
      }
    }
  }

  console.log(`[repair-playlist-queue-titles] scanned=${scanned} playlistsChanged=${updated} repairedItems=${repairedItems}`);
}

main().catch((error) => {
  console.error('[repair-playlist-queue-titles] failed', error);
  process.exitCode = 1;
});
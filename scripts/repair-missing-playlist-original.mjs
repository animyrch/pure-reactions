#!/usr/bin/env node

// Usage:
//   node scripts/repair-missing-playlist-original.mjs \
//     --playlistDocumentId <id> \
//     --insertIndex <n> \
//     --originalVideoId <youtubeVideoId> \
//     --offsetStartTime <seconds> \
//     --reactionFinishTime <seconds> \
//     [--templateReactionId <reactionDocId>] \
//     [--playlistCollection <name>] \
//     [--reactionCollection <name>] \
//     [--originalVideoTitle "Title"] \
//     [--originalVideoChannelTitle "Channel"] \
//     [--originalVideoUrl <url>] \
//     [--publish] \
//     [--apply] \
//     [--target emulator|prod] [--allowProd]
//
// Notes:
// - Defaults to dry-run unless --apply is passed.
// - If --templateReactionId is omitted, the script chooses the nearest populated
//   reaction doc from the existing playlist slots and clones its reaction-video metadata.
// - This script intentionally does not create sync timelines/config payloads.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

const YOUTUBE_WATCH_BASE_URL = 'https://www.youtube.com/watch?v=';
const YOUTUBE_THUMBNAIL_BASE_URL = 'https://i.ytimg.com/vi';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos';

const REACTION_SOURCE_TYPES = {
  YOUTUBE_VIDEO: 'youtube-video'
};

const ORIGINAL_VIDEO_PLATFORMS = {
  YOUTUBE: 'youtube'
};

function printUsage() {
  console.log(`repair-missing-playlist-original.mjs

Required:
  --playlistDocumentId <id>     Firestore playlist document id
  --insertIndex <n>             Zero-based insertion index in the playlist
  --originalVideoId <id>        Missing YouTube original video id
  --offsetStartTime <seconds>   Segment start in the shared reaction video
  --reactionFinishTime <seconds> Segment end in the shared reaction video

Optional:
  --templateReactionId <id>     Existing reaction doc to clone reaction-video metadata from
  --playlistCollection <name>   Override playlist collection name
  --reactionCollection <name>   Override reaction collection name
  --originalVideoTitle <title>  Override original video title
  --originalVideoChannelTitle <name>
  --originalVideoUrl <url>      Override original video URL
  --publish                     Mark the new reaction doc as published
  --apply                       Commit writes (default is dry-run)
  --target emulator|prod        Firebase target
  --allowProd                   Required with --target prod
  --projectId <id>
  --emulatorHost <host>
  --emulatorPort <port>
  --help                        Show this message

Examples:
  FIREBASE_SERVICE_ACCOUNT=./secrets/pure-reactions-cb457c74bbbf.json \
  node scripts/repair-missing-playlist-original.mjs \
    --playlistDocumentId abc123 \
    --insertIndex 4 \
    --originalVideoId dQw4w9WgXcQ \
    --offsetStartTime 812.4 \
    --reactionFinishTime 954.1 \
    --apply --target prod --allowProd
`);
}

function parseArgs(argv) {
  const args = {
    playlistDocumentId: '',
    insertIndex: undefined,
    originalVideoId: '',
    originalVideoTitle: '',
    originalVideoChannelTitle: '',
    originalVideoUrl: '',
    offsetStartTime: undefined,
    reactionFinishTime: undefined,
    templateReactionId: '',
    playlistCollection: '',
    reactionCollection: '',
    target: undefined,
    emulatorHost: undefined,
    emulatorPort: undefined,
    projectId: undefined,
    allowProd: false,
    apply: false,
    publish: false,
    help: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--playlistDocumentId' && next) {
      args.playlistDocumentId = next;
      index += 1;
      continue;
    }

    if (token === '--insertIndex' && next) {
      args.insertIndex = Number(next);
      index += 1;
      continue;
    }

    if (token === '--originalVideoId' && next) {
      args.originalVideoId = next;
      index += 1;
      continue;
    }

    if (token === '--originalVideoTitle' && next) {
      args.originalVideoTitle = next;
      index += 1;
      continue;
    }

    if (token === '--originalVideoChannelTitle' && next) {
      args.originalVideoChannelTitle = next;
      index += 1;
      continue;
    }

    if (token === '--originalVideoUrl' && next) {
      args.originalVideoUrl = next;
      index += 1;
      continue;
    }

    if (token === '--offsetStartTime' && next) {
      args.offsetStartTime = Number(next);
      index += 1;
      continue;
    }

    if (token === '--reactionFinishTime' && next) {
      args.reactionFinishTime = Number(next);
      index += 1;
      continue;
    }

    if (token === '--templateReactionId' && next) {
      args.templateReactionId = next;
      index += 1;
      continue;
    }

    if (token === '--playlistCollection' && next) {
      args.playlistCollection = next;
      index += 1;
      continue;
    }

    if (token === '--reactionCollection' && next) {
      args.reactionCollection = next;
      index += 1;
      continue;
    }

    if (token === '--target' && next) {
      args.target = next;
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

    if (token === '--projectId' && next) {
      args.projectId = next;
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

    if (token === '--publish') {
      args.publish = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
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

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeIndex(value) {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeSeconds(value, fieldName) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}. Expected a finite number.`);
  }

  const normalized = Math.round(Math.max(0, value) * 10) / 10;
  return normalized;
}

function buildYouTubeVideoUrl(videoId) {
  const cleanedId = trimString(videoId);
  return cleanedId ? `${YOUTUBE_WATCH_BASE_URL}${cleanedId}` : '';
}

function buildYouTubeThumbnailUrl(videoId) {
  const cleanedId = trimString(videoId);
  return cleanedId ? `${YOUTUBE_THUMBNAIL_BASE_URL}/${cleanedId}/hqdefault.jpg` : '';
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => trimString(value)).filter(Boolean))];
}

function deriveCollectionCandidates(collectionName, target) {
  const cleaned = trimString(collectionName);
  if (!cleaned) {
    return [];
  }

  const candidates = [cleaned];
  if (cleaned.endsWith('-local')) {
    candidates.push(cleaned.replace(/-local$/, '-prod'));
    candidates.push(cleaned.replace(/-local$/, '_prod'));
    candidates.push(cleaned.replace(/-local$/, ''));
  }
  if (cleaned.endsWith('_local')) {
    candidates.push(cleaned.replace(/_local$/, '_prod'));
    candidates.push(cleaned.replace(/_local$/, '-prod'));
    candidates.push(cleaned.replace(/_local$/, ''));
  }
  if (cleaned.endsWith('-prod')) {
    candidates.push(cleaned.replace(/-prod$/, '-local'));
    candidates.push(cleaned.replace(/-prod$/, '_local'));
    candidates.push(cleaned.replace(/-prod$/, ''));
  }
  if (cleaned.endsWith('_prod')) {
    candidates.push(cleaned.replace(/_prod$/, '_local'));
    candidates.push(cleaned.replace(/_prod$/, '-local'));
    candidates.push(cleaned.replace(/_prod$/, ''));
  }
  if (!/[-_]prod$/.test(cleaned) && !/[-_]local$/.test(cleaned)) {
    candidates.push(`${cleaned}-prod`);
    candidates.push(`${cleaned}_prod`);
    candidates.push(`${cleaned}-local`);
    candidates.push(`${cleaned}_local`);
  }

  if (target === 'prod') {
    candidates.sort((left, right) => {
      const leftScore = left.includes('prod') ? 0 : left.includes('local') ? 2 : 1;
      const rightScore = right.includes('prod') ? 0 : right.includes('local') ? 2 : 1;
      return leftScore - rightScore;
    });
  }

  return uniqueStrings(candidates);
}

async function resolveCollectionForDocument({ db, requestedName, target, documentId }) {
  const candidates = deriveCollectionCandidates(requestedName, target);
  for (const candidate of candidates) {
    const snapshot = await db.collection(candidate).doc(documentId).get();
    if (snapshot.exists) {
      return { collectionName: candidate, snapshot };
    }
  }

  return {
    collectionName: candidates[0] || requestedName,
    snapshot: null,
    candidates
  };
}

async function resolveReactionCollection({ db, requestedName, target, templateReactionId, playlistCollectionName }) {
  const requestedCandidates = deriveCollectionCandidates(requestedName, target);
  const inferredCandidates = playlistCollectionName
    ? deriveCollectionCandidates(
        playlistCollectionName
          .replace('playlists', 'reactions')
          .replace('playlist', 'reaction'),
        target,
      )
    : [];
  const candidates = uniqueStrings([...requestedCandidates, ...inferredCandidates]);

  if (templateReactionId) {
    for (const candidate of candidates) {
      const snapshot = await db.collection(candidate).doc(templateReactionId).get();
      if (snapshot.exists) {
        return { collectionName: candidate, snapshot };
      }
    }
  }

  return {
    collectionName: candidates[0] || requestedName,
    snapshot: null,
    candidates
  };
}

function normalizeOriginalVideoPlatform() {
  return ORIGINAL_VIDEO_PLATFORMS.YOUTUBE;
}

function buildSequenceItemId({ sourceIndex = 0, playlistItemIndex = null, originalVideoId }) {
  return [
    sourceIndex,
    playlistItemIndex ?? 'single',
    ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
    trimString(originalVideoId) || 'unknown'
  ].join(':');
}

function createSequenceItem({
  sourceType = REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
  sourceIndex = 0,
  playlistItemIndex = null,
  originalVideoId,
  originalVideoUrl,
  title,
  channelTitle,
  thumbnailUrl,
  youtubePlaylistId
}) {
  const cleanedOriginalVideoId = trimString(originalVideoId);
  return {
    id: buildSequenceItemId({
      sourceIndex,
      playlistItemIndex,
      originalVideoId: cleanedOriginalVideoId
    }),
    sourceType,
    sourceIndex,
    playlistItemIndex,
    originalVideoId: cleanedOriginalVideoId,
    originalVideoPlatform: normalizeOriginalVideoPlatform(),
    originalVideoUrl: trimString(originalVideoUrl) || buildYouTubeVideoUrl(cleanedOriginalVideoId),
    youtubePlaylistId: trimString(youtubePlaylistId),
    title: trimString(title),
    channelTitle: trimString(channelTitle),
    thumbnailUrl: trimString(thumbnailUrl) || buildYouTubeThumbnailUrl(cleanedOriginalVideoId)
  };
}

function getPlaylistSequenceItems(playlistDocument = {}) {
  if (Array.isArray(playlistDocument.sequenceItems) && playlistDocument.sequenceItems.length) {
    return playlistDocument.sequenceItems.map((item, index) => {
      const sourceIndex = Number.isFinite(Number(item?.sourceIndex)) ? Number(item.sourceIndex) : index;
      const playlistItemIndex = Number.isFinite(Number(item?.playlistItemIndex)) ? Number(item.playlistItemIndex) : null;
      return createSequenceItem({
        sourceType: trimString(item?.sourceType) || REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
        sourceIndex,
        playlistItemIndex,
        originalVideoId: item?.originalVideoId,
        originalVideoUrl: item?.originalVideoUrl,
        title: item?.title,
        channelTitle: item?.channelTitle,
        thumbnailUrl: item?.thumbnailUrl,
        youtubePlaylistId: item?.youtubePlaylistId
      });
    });
  }

  if (Array.isArray(playlistDocument.originalVideoIds) && playlistDocument.originalVideoIds.length) {
    return playlistDocument.originalVideoIds
      .map((originalVideoId, index) =>
        createSequenceItem({
          sourceIndex: index,
          originalVideoId
        })
      )
      .filter((item) => item.originalVideoId);
  }

  return [];
}

function pickNearestTemplateReactionId(reactionIds, insertIndex) {
  if (!Array.isArray(reactionIds) || !reactionIds.length) {
    return '';
  }

  for (let distance = 0; distance <= reactionIds.length; distance += 1) {
    const previousIndex = insertIndex - distance;
    if (previousIndex >= 0) {
      const candidate = trimString(reactionIds[previousIndex]);
      if (candidate) {
        return candidate;
      }
    }

    const nextIndex = insertIndex + distance;
    if (nextIndex < reactionIds.length) {
      const candidate = trimString(reactionIds[nextIndex]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return '';
}

async function fetchYouTubeMetadata(videoId) {
  const apiKey = trimString(process.env.YOUTUBE_API_KEY);
  if (!apiKey) {
    return null;
  }

  const url = new URL(YOUTUBE_API_URL);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`YouTube API request failed (${response.status}): ${details.slice(0, 200)}`);
    }

    const payload = await response.json();
    const item = payload?.items?.[0];
    const snippet = item?.snippet;
    if (!snippet) {
      return null;
    }

    return {
      title: trimString(snippet.title),
      channelTitle: trimString(snippet.channelTitle),
      description: trimString(snippet.description),
      thumbnailUrl:
        trimString(snippet?.thumbnails?.maxres?.url) ||
        trimString(snippet?.thumbnails?.standard?.url) ||
        trimString(snippet?.thumbnails?.high?.url) ||
        trimString(snippet?.thumbnails?.medium?.url) ||
        trimString(snippet?.thumbnails?.default?.url) ||
        buildYouTubeThumbnailUrl(videoId)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildNewReactionData({
  playlistDocumentId,
  playlistData,
  templateReactionId,
  templateReactionData,
  originalMetadata,
  originalVideoId,
  offsetStartTime,
  reactionFinishTime,
  publish
}) {
  const reactionVideoId = trimString(templateReactionData?.reactionVideoId);
  if (!reactionVideoId) {
    throw new Error(`Template reaction ${templateReactionId} is missing reactionVideoId.`);
  }

  const data = {
    originalVideoId,
    originalVideoTitle: trimString(originalMetadata.title),
    originalVideoAuthor: trimString(originalMetadata.channelTitle),
    originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
    originalVideoUrl: trimString(originalMetadata.originalVideoUrl) || buildYouTubeVideoUrl(originalVideoId),
    originalVideoThumbnailUrl: trimString(originalMetadata.thumbnailUrl) || buildYouTubeThumbnailUrl(originalVideoId),
    reactionVideoId,
    reactionVideoTitle: trimString(templateReactionData?.reactionVideoTitle),
    reactionVideoAuthor: trimString(templateReactionData?.reactionVideoAuthor),
    reactionVideoDescription: trimString(templateReactionData?.reactionVideoDescription),
    reactorId: trimString(templateReactionData?.reactorId),
    reactorDisplayName: trimString(templateReactionData?.reactorDisplayName),
    playlistId: playlistDocumentId,
    youtubePlaylistId:
      trimString(templateReactionData?.youtubePlaylistId) || trimString(playlistData?.youtubePlaylistId),
    offsetStartTime,
    reactionFinishTime,
    reactionConfigs: {},
    playbackRateConfigs: {},
    isPublished: Boolean(publish),
    fullscreenPrimaryVideo: trimString(templateReactionData?.fullscreenPrimaryVideo) || 'original',
    fullscreenOverlayWidthPercent:
      typeof templateReactionData?.fullscreenOverlayWidthPercent === 'number'
        ? templateReactionData.fullscreenOverlayWidthPercent
        : 35,
    fullscreenOverlayCorner: trimString(templateReactionData?.fullscreenOverlayCorner) || 'top-right',
    globalGain:
      typeof templateReactionData?.globalGain === 'number' && Number.isFinite(templateReactionData.globalGain)
        ? templateReactionData.globalGain
        : 1,
    muteReactionWhileOriginalPlays: Boolean(templateReactionData?.muteReactionWhileOriginalPlays),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const description = trimString(originalMetadata.description);
  if (description) {
    data.originalVideoDescription = description;
  }

  const authorUrl = trimString(originalMetadata.authorUrl);
  if (authorUrl) {
    data.originalVideoAuthorUrl = authorUrl;
  }

  return data;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  loadDotEnvIfPresent('.env');

  const target = args.target || process.env.FIREBASE_SEED_TARGET || (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'prod');
  const defaultProjectId = target === 'emulator' ? 'demo-pure-reactions' : 'pure-reactions';
  const projectId = args.projectId || process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || defaultProjectId;
  const requestedPlaylistCollection = trimString(args.playlistCollection) || process.env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS || 'playlists_local';
  const requestedReactionCollection = trimString(args.reactionCollection) || process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions-local';

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown target: ${target}`);
  }

  if (target === 'prod') {
    const allow = args.allowProd || process.env.ALLOW_PROD_MIGRATION === '1' || process.env.ALLOW_PROD_MIGRATION === 'true';
    if (!allow) {
      throw new Error('Refusing to write to prod: pass --allowProd or set ALLOW_PROD_MIGRATION=1');
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

  const playlistDocumentId = trimString(args.playlistDocumentId);
  const originalVideoId = trimString(args.originalVideoId);
  const insertIndex = normalizeIndex(args.insertIndex);
  const offsetStartTime = normalizeSeconds(args.offsetStartTime, 'offsetStartTime');
  const reactionFinishTime = normalizeSeconds(args.reactionFinishTime, 'reactionFinishTime');

  if (!playlistDocumentId) {
    throw new Error('Missing --playlistDocumentId');
  }
  if (insertIndex === undefined) {
    throw new Error('Missing or invalid --insertIndex');
  }
  if (!originalVideoId) {
    throw new Error('Missing --originalVideoId');
  }
  if (reactionFinishTime <= offsetStartTime) {
    throw new Error('--reactionFinishTime must be greater than --offsetStartTime');
  }

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();
  const playlistResolution = await resolveCollectionForDocument({
    db,
    requestedName: requestedPlaylistCollection,
    target,
    documentId: playlistDocumentId
  });
  const playlistCollection = playlistResolution.collectionName;
  const playlistSnapshot = playlistResolution.snapshot;

  if (!playlistSnapshot?.exists) {
    const suffix = Array.isArray(playlistResolution.candidates) && playlistResolution.candidates.length
      ? ` Tried collections: ${playlistResolution.candidates.join(', ')}`
      : '';
    throw new Error(`Playlist document not found: ${playlistDocumentId}.${suffix}`);
  }

  const playlistRef = db.collection(playlistCollection).doc(playlistDocumentId);

  const playlistData = playlistSnapshot.data() || {};
  const sequenceItems = getPlaylistSequenceItems(playlistData);
  const reactionBinomeIds = Array.isArray(playlistData.reactionBinomeIds) ? [...playlistData.reactionBinomeIds] : [];
  const originalVideoIds = Array.isArray(playlistData.originalVideoIds) ? [...playlistData.originalVideoIds] : sequenceItems.map((item) => item.originalVideoId).filter(Boolean);

  if (insertIndex > sequenceItems.length) {
    throw new Error(`Insert index ${insertIndex} is out of bounds for playlist length ${sequenceItems.length}`);
  }

  const explicitTemplateReactionId = trimString(args.templateReactionId);
  const templateReactionId = explicitTemplateReactionId || pickNearestTemplateReactionId(reactionBinomeIds, insertIndex);
  if (!templateReactionId) {
    throw new Error('Could not determine a template reaction. Pass --templateReactionId explicitly.');
  }

  const reactionResolution = await resolveReactionCollection({
    db,
    requestedName: requestedReactionCollection,
    target,
    templateReactionId,
    playlistCollectionName: playlistCollection
  });
  const reactionCollection = reactionResolution.collectionName;
  const templateReactionSnapshot = reactionResolution.snapshot;
  if (!templateReactionSnapshot?.exists) {
    const suffix = Array.isArray(reactionResolution.candidates) && reactionResolution.candidates.length
      ? ` Tried collections: ${reactionResolution.candidates.join(', ')}`
      : '';
    throw new Error(`Template reaction not found: ${templateReactionId}.${suffix}`);
  }
  const templateReactionData = templateReactionSnapshot.data() || {};

  const fetchedOriginalMetadata = await fetchYouTubeMetadata(originalVideoId).catch((error) => {
    console.warn(`[repair-missing-playlist-original] failed to fetch YouTube metadata: ${error.message}`);
    return null;
  });

  const originalMetadata = {
    title: trimString(args.originalVideoTitle) || trimString(fetchedOriginalMetadata?.title),
    channelTitle: trimString(args.originalVideoChannelTitle) || trimString(fetchedOriginalMetadata?.channelTitle),
    description: trimString(fetchedOriginalMetadata?.description),
    thumbnailUrl: trimString(fetchedOriginalMetadata?.thumbnailUrl) || buildYouTubeThumbnailUrl(originalVideoId),
    originalVideoUrl: trimString(args.originalVideoUrl) || buildYouTubeVideoUrl(originalVideoId),
    authorUrl: ''
  };

  const newReactionRef = db.collection(reactionCollection).doc();
  const newReactionData = buildNewReactionData({
    playlistDocumentId,
    playlistData,
    templateReactionId,
    templateReactionData,
    originalMetadata,
    originalVideoId,
    offsetStartTime,
    reactionFinishTime,
    publish: args.publish
  });

  const newSequenceItem = createSequenceItem({
    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
    sourceIndex: insertIndex,
    originalVideoId,
    originalVideoUrl: originalMetadata.originalVideoUrl,
    title: originalMetadata.title,
    channelTitle: originalMetadata.channelTitle,
    thumbnailUrl: originalMetadata.thumbnailUrl,
    youtubePlaylistId: trimString(playlistData?.youtubePlaylistId)
  });

  const nextSequenceItems = [...sequenceItems];
  nextSequenceItems.splice(insertIndex, 0, newSequenceItem);

  const nextReactionBinomeIds = [...reactionBinomeIds];
  nextReactionBinomeIds.splice(insertIndex, 0, newReactionRef.id);

  const nextOriginalVideoIds = [...originalVideoIds];
  nextOriginalVideoIds.splice(insertIndex, 0, originalVideoId);

  const nextPlaylistData = {
    ...playlistData,
    sequenceItems: nextSequenceItems,
    reactionBinomeIds: nextReactionBinomeIds,
    originalVideoIds: nextOriginalVideoIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const dryRun = !args.apply;

  console.log('[repair-missing-playlist-original] plan');
  console.log(JSON.stringify({
    target,
    dryRun,
    projectId,
    playlistCollection,
    reactionCollection,
    playlistDocumentId,
    insertIndex,
    templateReactionId,
    newReactionDocumentId: newReactionRef.id,
    originalVideoId,
    originalVideoTitle: originalMetadata.title,
    reactionVideoId: newReactionData.reactionVideoId,
    offsetStartTime,
    reactionFinishTime,
    publish: args.publish
  }, null, 2));

  if (dryRun) {
    console.log('[repair-missing-playlist-original] dry-run only. Re-run with --apply to commit writes.');
    return;
  }

  const batch = db.batch();
  batch.set(newReactionRef, newReactionData, { merge: false });
  batch.set(playlistRef, nextPlaylistData, { merge: false });
  await batch.commit();

  console.log(`[repair-missing-playlist-original] wrote reaction ${newReactionRef.id} and updated playlist ${playlistDocumentId}`);
}

main().catch((error) => {
  console.error('[repair-missing-playlist-original] failed');
  console.error(error);
  process.exitCode = 1;
});
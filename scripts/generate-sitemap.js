#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const OUTPUT_PATH = path.resolve(process.cwd(), 'static/sitemap.xml');
const DEFAULT_THUMBNAIL_PATH = '/icon-512.png';
const CANONICAL_BASE_URL = 'https://purereactions.com';
const YOUTUBE_EMBED_BASE_URL = 'https://www.youtube.com/embed/';

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

function parseServiceAccount(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const absolutePath = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(absolutePath)) {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  }

  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function resolveServiceAccount() {
  const fromEnv = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (fromEnv) {
    return fromEnv;
  }

  const fromGoogleCredentialsPath = parseServiceAccount(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fromGoogleCredentialsPath) {
    return fromGoogleCredentialsPath;
  }

  throw new Error(
    'Firebase Admin credentials are required. Set FIREBASE_SERVICE_ACCOUNT to a JSON string, a file path, or a base64-encoded JSON payload, or set GOOGLE_APPLICATION_CREDENTIALS to a file path.'
  );
}

function ensureBaseUrl(raw) {
  if (!raw) {
    throw new Error('PUBLIC_BASE_URL is required.');
  }
  const url = new URL(raw);
  return url.origin;
}

function ensureAbsoluteUrl(value, baseUrl) {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapCdata(value) {
  const safe = value.replaceAll(']]>', ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  return null;
}

function pickLastmod(values) {
  const dates = values.map(toDate).filter(Boolean);
  if (!dates.length) return null;
  dates.sort((a, b) => b - a);
  return dates[0].toISOString();
}

function buildYoutubePlayerUrl(videoId) {
  if (!videoId) return null;
  return `${YOUTUBE_EMBED_BASE_URL}${encodeURIComponent(videoId)}`;
}

function pickReactionVideoId(data) {
  return pickText(
    data.reactionVideoId,
    data.youtube?.id,
    data.youtubeId,
    data.youtube?.meta?.videoId
  );
}

function buildReactionSitemapEntry({ docId, data, baseUrl }) {
  const slug = pickText(data.slug, docId);
  const loc = new URL(`/reaction/${slug}`, baseUrl).toString();
  const reactionVideoId = pickReactionVideoId(data);
  const playerLoc = buildYoutubePlayerUrl(reactionVideoId);

  const title = pickText(data.title, data.reactionVideoTitle, data.youtube?.meta?.title, slug);
  const description = pickText(
    data.description,
    data.youtube?.meta?.description,
    data.reactionVideoTitle,
    'Reaction video on Pure Reactions.'
  );

  const posterUrl = ensureAbsoluteUrl(data.posterUrl || data.thumbnailUrl, baseUrl);
  const youtubeThumbnail = ensureAbsoluteUrl(data.youtube?.meta?.thumbnail, baseUrl);
  const defaultThumbnail = new URL(DEFAULT_THUMBNAIL_PATH, baseUrl).toString();
  const thumbnail = posterUrl || youtubeThumbnail || defaultThumbnail;

  const lastmod = pickLastmod([data.updatedAt, data.lastEnrichedAt, data.youtube?.meta?.publishedAt]);
  const durationSeconds = Number.isFinite(data.youtube?.meta?.durationSeconds)
    ? Math.round(data.youtube.meta.durationSeconds)
    : null;
  const publicationDate = pickLastmod([data.youtube?.meta?.publishedAt]);

  const lines = [];
  lines.push('  <url>');
  lines.push(`    <loc>${escapeXml(loc)}</loc>`);
  if (lastmod) {
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
  }

  if (thumbnail && playerLoc) {
    lines.push('    <video:video>');
    lines.push(`      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>`);
    lines.push(`      <video:title>${wrapCdata(title)}</video:title>`);
    lines.push(`      <video:description>${wrapCdata(description)}</video:description>`);
    lines.push(`      <video:player_loc>${escapeXml(playerLoc)}</video:player_loc>`);
    if (durationSeconds && durationSeconds > 0) {
      lines.push(`      <video:duration>${durationSeconds}</video:duration>`);
    }
    if (publicationDate) {
      lines.push(`      <video:publication_date>${publicationDate}</video:publication_date>`);
    }
    lines.push('    </video:video>');
  }

  lines.push('  </url>');
  return {
    docId,
    slug,
    loc,
    lines: lines.join('\n')
  };
}

function pickOriginalVideoThumbnail(data, baseUrl) {
  return (
    ensureAbsoluteUrl(data.originalVideoThumbnailUrl, baseUrl) ||
    ensureAbsoluteUrl(data.originalYoutube?.meta?.thumbnail, baseUrl) ||
    ensureAbsoluteUrl(data.originalTikTok?.meta?.thumbnail, baseUrl) ||
    new URL(DEFAULT_THUMBNAIL_PATH, baseUrl).toString()
  );
}

function pickOriginalVideoDurationSeconds(data) {
  const durationSeconds =
    data.originalYoutube?.meta?.durationSeconds ?? data.originalTikTok?.meta?.durationSeconds;

  return Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null;
}

function pickBestReactionForMetadata(reactions) {
  let bestReaction = null;
  let bestTimestamp = -Infinity;

  for (const reaction of reactions) {
    const lastmod = pickLastmod([
      reaction.data?.updatedAt,
      reaction.data?.lastEnrichedAt,
      reaction.data?.createdAt,
      reaction.data?.youtube?.meta?.publishedAt
    ]);
    const timestamp = lastmod ? new Date(lastmod).valueOf() : -Infinity;

    if (timestamp > bestTimestamp) {
      bestTimestamp = timestamp;
      bestReaction = reaction;
    }
  }

  return bestReaction ?? reactions[0] ?? null;
}

function pickTopReactorNames(reactions, limit = 3) {
  const names = [];
  for (const r of reactions) {
    const data = r?.data ?? {};
    const name = pickText(data.reactorDisplayName, data.reactionVideoAuthor);
    if (!name) continue;
    if (!names.includes(name)) names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

function buildOriginalVideoSeoDescription(data, reactions) {
  const title = pickText(
    data.originalVideoTitle,
    data.originalYoutube?.meta?.title,
    data.title
  );

  const author = pickText(
    data.originalVideoAuthor,
    data.originalYoutube?.meta?.author,
    data.originalVideoAuthorHandle
  );

  const topNames = pickTopReactorNames(reactions, 3);
  const namesFragment = topNames.length
    ? ` from creators like ${topNames.join(', ')}${topNames.length === 3 ? '' : ''}`
    : '';

  // Craft a concise, SEO-friendly description that highlights the original video and a few reactors
  const base = title
    ? `Watch reactions to ${title}${author ? ` by ${author}` : ''}.` 
    : 'Watch a collection of reactions.';

  const extra = ` Energetic reactions, watchalongs, and first-time experiences${namesFragment}.`;

  // Prefer any existing explicit description if present, otherwise use generated text
  const existing = pickText(
    data.originalVideoDescription,
    data.originalYoutube?.meta?.description,
    data.originalTikTok?.meta?.description
  );

  const combined = existing || `${base}${extra}`;
  // Keep description reasonably short
  return combined.trim();
}

function buildOriginalVideoEntry({ originalVideoId, originalVideoSlug, reactions, baseUrl }) {
  if (!originalVideoId || !originalVideoSlug || reactions.length < 2) {
    return null;
  }

  const representativeReaction = pickBestReactionForMetadata(reactions);
  const data = representativeReaction?.data ?? {};
  const slug = pickText(originalVideoSlug);

  if (!slug) {
    return null;
  }

  const loc = new URL(`/reactions/${encodeURIComponent(slug)}`, baseUrl).toString();
  const playerLoc =
    ensureAbsoluteUrl(data.originalVideoUrl, baseUrl) ||
    buildYoutubePlayerUrl(data.originalVideoId || originalVideoId);

  const title = pickText(
    data.originalVideoTitle,
    data.originalYoutube?.meta?.title,
    data.originalTikTok?.meta?.title,
    data.title,
    slug
  );
  const description = buildOriginalVideoSeoDescription(data, reactions) || 'Reaction collection on Pure Reactions.';
  const thumbnail = pickOriginalVideoThumbnail(data, baseUrl);
  const lastmod = pickLastmod(
    reactions.flatMap(({ data: reactionData }) => [
      reactionData?.updatedAt,
      reactionData?.lastEnrichedAt,
      reactionData?.createdAt,
      reactionData?.originalYoutube?.lastEnrichedAt,
      reactionData?.originalTikTok?.lastEnrichedAt,
      reactionData?.youtube?.meta?.publishedAt
    ])
  );
  const durationSeconds = pickOriginalVideoDurationSeconds(data);
  const publicationDate = pickLastmod([
    data.originalYoutube?.meta?.publishedAt,
    data.originalTikTok?.meta?.publishedAt,
    data.youtube?.meta?.publishedAt
  ]);

  const lines = [];
  lines.push('  <url>');
  lines.push(`    <loc>${escapeXml(loc)}</loc>`);
  if (lastmod) {
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
  }

  if (thumbnail && playerLoc) {
    lines.push('    <video:video>');
    lines.push(`      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>`);
    lines.push(`      <video:title>${wrapCdata(title)}</video:title>`);
    lines.push(`      <video:description>${wrapCdata(description)}</video:description>`);
    lines.push(`      <video:player_loc>${escapeXml(playerLoc)}</video:player_loc>`);
    if (durationSeconds && durationSeconds > 0) {
      lines.push(`      <video:duration>${durationSeconds}</video:duration>`);
    }
    if (publicationDate) {
      lines.push(`      <video:publication_date>${publicationDate}</video:publication_date>`);
    }
    lines.push('    </video:video>');
  }

  lines.push('  </url>');
  return {
    originalVideoId,
    slug,
    loc,
    lines: lines.join('\n')
  };
}

export function buildOriginalVideoSitemapEntries(reactionDocs, baseUrl) {
  const groupedReactions = new Map();

  for (const doc of reactionDocs) {
    const data = doc?.data ?? {};
    const originalVideoId = pickText(data.originalVideoId);
    const originalVideoSlug = pickText(data.originalVideoSlug);

    if (!originalVideoId || !originalVideoSlug) {
      continue;
    }

    if (!groupedReactions.has(originalVideoId)) {
      groupedReactions.set(originalVideoId, {
        originalVideoId,
        originalVideoSlug,
        reactions: []
      });
    }

    const group = groupedReactions.get(originalVideoId);
    if (!group.originalVideoSlug && originalVideoSlug) {
      group.originalVideoSlug = originalVideoSlug;
    }

    group.reactions.push(doc);
  }

  return [...groupedReactions.values()]
    .filter(({ reactions }) => reactions.length >= 2)
    .map((group) => buildOriginalVideoEntry({ ...group, baseUrl }))
    .filter(Boolean)
    .sort((a, b) => a.loc.localeCompare(b.loc));
}

export function buildReactionSitemapEntries(reactionDocs, baseUrl) {
  return reactionDocs
    .map((doc) => buildReactionSitemapEntry({ docId: doc.id, data: doc.data, baseUrl }))
    .filter(Boolean)
    .sort((a, b) => a.loc.localeCompare(b.loc));
}

async function fetchPublishedReactions(db, collection) {
  let snapshot = await db.collection(collection).where('isPublished', '==', true).get();

  if (snapshot.empty) {
    snapshot = await db.collection(collection).where('published', '==', true).get();
  }

  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function generate() {
  loadDotEnvIfPresent('.env');

  ensureBaseUrl(process.env.PUBLIC_BASE_URL);
  const baseUrl = CANONICAL_BASE_URL;
  const serviceAccount = resolveServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
    });
  }

  const db = admin.firestore();
  const collection = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions';
  const reactions = await fetchPublishedReactions(db, collection);
  const entries = [
    ...buildReactionSitemapEntries(reactions, baseUrl),
    ...buildOriginalVideoSitemapEntries(reactions, baseUrl)
  ]
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(({ lines }) => lines);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');

  console.log(`[generate-sitemap] Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  generate().catch((error) => {
    console.error('[generate-sitemap] Failed to generate sitemap:', error);
    process.exitCode = 1;
  });
}

export { fetchPublishedReactions, generate, pickBestReactionForMetadata, buildOriginalVideoEntry };

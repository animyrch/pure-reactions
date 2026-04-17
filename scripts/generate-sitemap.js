#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const OUTPUT_PATH = path.resolve(process.cwd(), 'static/sitemap.xml');
const DEFAULT_THUMBNAIL_PATH = '/icon-512.png';
const MAX_ENTRIES = 5000;
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

function resolveServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is required (JSON string or file path).');
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is empty.');
  }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const abs = path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(abs)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT path not found: ${abs}`);
  }

  const content = fs.readFileSync(abs, 'utf8');
  return JSON.parse(content);
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

function pickReactionVideoId(data) {
  return pickText(
    data.reactionVideoId,
    data.youtube?.id,
    data.youtubeId,
    data.youtube?.meta?.videoId
  );
}

function buildYoutubePlayerUrl(videoId) {
  if (!videoId) return null;
  return `${YOUTUBE_EMBED_BASE_URL}${encodeURIComponent(videoId)}`;
}

function buildEntry({ docId, data, baseUrl }) {
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
  return lines.join('\n');
}

async function generate() {
  loadDotEnvIfPresent('.env');

  const baseUrl = ensureBaseUrl(process.env.PUBLIC_BASE_URL);
  const serviceAccount = resolveServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
    });
  }

  const db = admin.firestore();
  const collection = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions';

  let snapshot = await db.collection(collection).where('isPublished', '==', true).limit(MAX_ENTRIES).get();
  if (snapshot.empty) {
    snapshot = await db.collection(collection).where('published', '==', true).limit(MAX_ENTRIES).get();
  }

  const entries = snapshot.docs.map((doc) => buildEntry({ docId: doc.id, data: doc.data(), baseUrl }));

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

generate().catch((error) => {
  console.error('[generate-sitemap] Failed to generate sitemap:', error);
  process.exitCode = 1;
});

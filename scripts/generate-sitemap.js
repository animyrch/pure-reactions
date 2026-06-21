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
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function getPublishedReactions(db) {
  const collectionName = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions';
  console.log(`Querying collection: ${collectionName}`);
  const reactionsSnapshot = await db.collection(collectionName).where('isPublished', '==', true).get();
  if (reactionsSnapshot.empty) {
    return [];
  }
  return reactionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function groupReactionsByOriginalVideo(reactions) {
  return reactions.reduce((acc, reaction) => {
    const { originalVideoId } = reaction;
    if (!acc[originalVideoId]) {
      acc[originalVideoId] = [];
    }
    acc[originalVideoId].push(reaction);
    return acc;
  }, {});
}

async function generateSitemap() {
  loadDotEnvIfPresent();
  loadDotEnvIfPresent('.env.local');

  const serviceAccount = resolveServiceAccount();
  const baseUrl = ensureBaseUrl(process.env.PUBLIC_BASE_URL);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();

  const staticRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
    { path: '/terms', priority: '0.5', changefreq: 'monthly' },
    { path: '/about', priority: '0.7', changefreq: 'monthly' },
    { path: '/search', priority: '0.8', changefreq: 'weekly' }
  ];

  const allReactions = await getPublishedReactions(db);
  const reactionsByOriginal = groupReactionsByOriginalVideo(allReactions);

  const reactionUrls = [];
  for (const originalVideoId in reactionsByOriginal) {
    const group = reactionsByOriginal[originalVideoId];
    if (group.length > 1) {
      for (const reaction of group) {
        const slug = reaction.slug || reaction.id;
        const lastMod = reaction.updatedAt?.toDate()?.toISOString() || new Date().toISOString();
        reactionUrls.push({
          path: `/reaction/${slug}`,
          priority: '0.9',
          changefreq: 'weekly',
          lastmod: lastMod,
          image: ensureAbsoluteUrl(reaction.thumbnailUrl || DEFAULT_THUMBNAIL_PATH, baseUrl),
          video: {
            thumbnail_loc: ensureAbsoluteUrl(reaction.thumbnailUrl || DEFAULT_THUMBNAIL_PATH, baseUrl),
            title: reaction.reactionVideoTitle,
            description: reaction.description || `Reaction to ${reaction.originalVideoTitle}`,
            player_loc: `${YOUTUBE_EMBED_BASE_URL}${reaction.reactionVideoId}`,
            duration: reaction.duration,
            publication_date: reaction.createdAt?.toDate()?.toISOString()
          }
        });
      }
    }
  }

  console.log(`Found ${allReactions.length} published reactions.`);
  console.log(`Grouped into ${Object.keys(reactionsByOriginal).length} original videos.`);
  console.log(`Adding ${reactionUrls.length} reaction pages to sitemap (from groups with >1 reaction).`);

  const urls = [...staticRoutes, ...reactionUrls].slice(0, MAX_ENTRIES);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  for (const route of urls) {
    const loc = ensureAbsoluteUrl(route.path, baseUrl);
    if (!loc) continue;

    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    if (route.priority) xml += `    <priority>${route.priority}</priority>\n`;
    if (route.changefreq) xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    if (route.lastmod) xml += `    <lastmod>${route.lastmod}</lastmod>\n`;

    if (route.image) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(route.image)}</image:loc>\n`;
      xml += `    </image:image>\n`;
    }

    if (route.video) {
      xml += `    <video:video>\n`;
      if (route.video.thumbnail_loc)
        xml += `      <video:thumbnail_loc>${escapeXml(route.video.thumbnail_loc)}</video:thumbnail_loc>\n`;
      if (route.video.title) xml += `      <video:title>${escapeXml(route.video.title)}</video:title>\n`;
      if (route.video.description)
        xml += `      <video:description>${escapeXml(route.video.description)}</video:description>\n`;
      if (route.video.player_loc) xml += `      <video:player_loc>${escapeXml(route.video.player_loc)}</video:player_loc>\n`;
      if (route.video.duration) xml += `      <video:duration>${route.video.duration}</video:duration>\n`;
      if (route.video.publication_date)
        xml += `      <video:publication_date>${route.video.publication_date}</video:publication_date>\n`;
      xml += `    </video:video>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  fs.writeFileSync(OUTPUT_PATH, xml);
  console.log(`Sitemap with ${urls.length} entries written to ${OUTPUT_PATH}`);
}

generateSitemap().catch((error) => {
  console.error('Error generating sitemap:', error);
  process.exit(1);
});

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

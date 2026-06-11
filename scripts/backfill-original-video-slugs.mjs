#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Minimal copy of generateOriginalVideoSlug used by the app
const generateOriginalVideoSlug = (title, author) => {
  const slugifyPart = (part, isTitle = false) => {
    if (!part || typeof part !== 'string') {
      return '';
    }

    let slug = part.toLowerCase();

    if (isTitle) {
      slug = slug
        .replace(/\s*\(?m\/v\)?|\s*\(?m-v\)?|\s*\(?mv\)?|\s*\[?official\s+video\]?|\s*\[?official\s+music\s+video\]?|\s*\[?official\s+lyric\s+video\]?\s*$/gi, '')
        .trim();
    }

    slug = slug.replace(/[^a-z0-9]+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');

    return slug;
  };

  const titleSlug = slugifyPart(title, true);
  const authorSlug = slugifyPart(author, false);

  const parts = [];
  if (titleSlug) parts.push(titleSlug);
  if (authorSlug) parts.push(authorSlug);

  if (parts.length === 0) return 'original-content';
  return parts.join('-');
};

// Resolve service account from env or GOOGLE_APPLICATION_CREDENTIALS
function resolveServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw?.trim()) {
    try {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) return JSON.parse(trimmed);
      const absolutePath = path.resolve(process.cwd(), trimmed);
      if (fs.existsSync(absolutePath)) return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath?.trim()) {
    const absolutePath = path.resolve(process.cwd(), credentialsPath.trim());
    if (fs.existsSync(absolutePath)) return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  }

  return null;
}

(async function main() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT_ID;
  const collection = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions-prod';
  const batchSize = Number(process.env.BACKFILL_BATCH_SIZE || 500);

  if (!projectId) {
    console.error('Missing PUBLIC_FIREBASE_PROJECT_ID (or GCLOUD_PROJECT). Set it and retry.');
    process.exit(1);
  }

  // Safety: require explicit confirmation when targeting the real prod project
  const prodNames = ['pure-reactions', 'pure-reactions-prod', 'prod'];
  if (prodNames.includes(String(projectId)) && process.env.CONFIRM_BACKFILL !== 'true') {
    console.error(`Target project is "${projectId}". To run against production set CONFIRM_BACKFILL=true in the environment (and ensure you have backups). Aborting.`);
    process.exit(1);
  }

  const serviceAccount = resolveServiceAccount();

  let adminApp = getApps()[0];
  if (!adminApp) {
    if (serviceAccount) {
      adminApp = initializeApp({ credential: cert(serviceAccount), projectId });
    } else if (process.env.PUBLIC_FIREBASE_USE_EMULATORS === 'true') {
      // Use emulator host env if available
      process.env.FIRESTORE_EMULATOR_HOST = process.env.PUBLIC_FIRESTORE_EMULATOR_HOST
        ? `${process.env.PUBLIC_FIRESTORE_EMULATOR_HOST}:${process.env.PUBLIC_FIRESTORE_EMULATOR_PORT || 8086}`
        : '127.0.0.1:8086';
      adminApp = initializeApp({ projectId });
    } else {
      console.error('No service account provided and not using emulators. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
      process.exit(1);
    }
  }

  const db = getFirestore(adminApp);
  console.log('Connected to project:', projectId, 'collection:', collection);

  let lastDoc = null;
  let totalUpdated = 0;
  let page = 0;

  while (true) {
    page++;
    let q = db.collection(collection).orderBy('__name__').limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    console.log(`Processing page ${page} (${snap.size} docs)`);

    const updates = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data) continue;
      if (!data.originalVideoSlug) {
        const title = data.originalVideoTitle || '';
        const author = data.originalVideoAuthor || '';
        const slug = generateOriginalVideoSlug(title, author);
        updates.push(
          doc.ref.set({ originalVideoSlug: slug }, { merge: true }).then(() => {
            totalUpdated++;
            console.log('Updated', doc.id, '->', slug);
          }).catch((err) => {
            console.error('Failed to update', doc.id, err.message || err);
          })
        );
      }
    }

    await Promise.all(updates);

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < batchSize) break;
  }

  console.log('Done. Total documents updated:', totalUpdated);
  process.exit(0);
})();

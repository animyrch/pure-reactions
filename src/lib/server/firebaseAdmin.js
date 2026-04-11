import fs from 'node:fs';
import path from 'node:path';
import { FIREBASE_CONFIG } from '$lib/constants/firebase';

let adminDb = null;
let adminFieldValue = null;
let adminInitialized = false;

function resolveServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw?.trim()) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }

    const absolutePath = path.resolve(process.cwd(), trimmed);
    if (fs.existsSync(absolutePath)) {
      return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath?.trim()) {
    const absolutePath = path.resolve(process.cwd(), credentialsPath.trim());
    if (fs.existsSync(absolutePath)) {
      return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }
  }

  return null;
}

export async function initializeFirebaseAdmin() {
  if (adminInitialized) {
    return { adminDb, adminFieldValue };
  }

  try {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    let adminApp;
    if (!getApps().length) {
      const serviceAccount = resolveServiceAccount();
      if (serviceAccount) {
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: FIREBASE_CONFIG.projectId
        });
      } else {
        adminApp = initializeApp({
          projectId: FIREBASE_CONFIG.projectId
        });
      }
    } else {
      adminApp = getApps()[0];
    }

    adminDb = getFirestore(adminApp);
    adminFieldValue = FieldValue;
    adminInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }

  return { adminDb, adminFieldValue };
}

/**
 * Fetch a reaction document by its slug (document ID) using Firebase Admin.
 * Returns a plain object with the fields needed for SSR/SEO, or null if not found.
 */
export async function getReactionBySlug(slug) {
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) {
    return null;
  }

  try {
    const docRef = adminDb.collection(COLLECTION_REACTION_BINOMES).doc(slug);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return null;
    }
    const data = docSnap.data();
    // Return only the fields consumed by the SEO component in +page.svelte.
    // Additional fields can be added here as noscript/SSR usage grows.
    return {
      id: docSnap.id,
      reactionVideoId: data.reactionVideoId ?? null,
      reactionVideoTitle: data.reactionVideoTitle ?? null,
      reactionVideoAuthor: data.reactionVideoAuthor ?? null,
      originalVideoTitle: data.originalVideoTitle ?? null,
      originalVideoDescription: data.originalVideoDescription ?? null,
      reactorDisplayName: data.reactorDisplayName ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      description: data.description ?? null,
    };
  } catch (error) {
    console.error('Failed to fetch reaction by slug:', error);
    return null;
  }
}
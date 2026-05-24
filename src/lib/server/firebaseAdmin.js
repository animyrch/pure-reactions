import fs from 'node:fs';
import path from 'node:path';
import { FIREBASE_CONFIG } from '$lib/constants/firebase';
import { env } from '$env/dynamic/private';

let adminAuth = null;
let adminDb = null;
let adminFieldValue = null;
let adminInitialized = false;
let adminMissingConfigurationLogged = false;

function isUsingEmulators() {
  return process.env.PUBLIC_FIREBASE_USE_EMULATORS === 'true';
}

function getAdminProjectId() {
  return FIREBASE_CONFIG.projectId || process.env.PUBLIC_FIREBASE_PROJECT_ID || 'demo-pure-reactions';
}

function applyAdminEmulatorEnvironment() {
  process.env.FIRESTORE_EMULATOR_HOST = `${process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1'}:${process.env.PUBLIC_FIRESTORE_EMULATOR_PORT || '8086'}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${process.env.PUBLIC_AUTH_EMULATOR_HOST || '127.0.0.1'}:${process.env.PUBLIC_AUTH_EMULATOR_PORT || '9099'}`;
}

function resolveServiceAccount() {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
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

  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath?.trim()) {
    const absolutePath = path.resolve(process.cwd(), credentialsPath.trim());
    if (fs.existsSync(absolutePath)) {
      return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }
  }

  return null;
}

function logMissingAdminConfiguration() {
  if (adminMissingConfigurationLogged) {
    return;
  }

  adminMissingConfigurationLogged = true;
  console.warn(
    'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS, or enable PUBLIC_FIREBASE_USE_EMULATORS=true. Server-side admin features will fall back to empty responses.'
  );
}

export async function initializeFirebaseAdmin() {
  if (adminInitialized) {
    return { adminAuth, adminDb, adminFieldValue };
  }

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    let adminApp = getApps()[0];
    if (!adminApp) {
      const projectId = getAdminProjectId();
      if (isUsingEmulators()) {
        applyAdminEmulatorEnvironment();
        adminApp = initializeApp({ projectId });
      } else {
        const serviceAccount = resolveServiceAccount();
        if (!serviceAccount) {
          logMissingAdminConfiguration();
          adminInitialized = true;
          return { adminAuth, adminDb, adminFieldValue };
        }

        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId
        });
      }
    }

    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    adminFieldValue = FieldValue;
    adminInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }

  return { adminAuth, adminDb, adminFieldValue };
}

/**
 * Fetch a reaction document by its slug (document ID) using Firebase Admin.
 * Returns a plain object with the fields needed for SSR/SEO, or null if not found.
 */
export async function getReactionBySlug(slug) {
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  console.log('[getReactionBySlug] COLLECTION_REACTION_BINOMES:', COLLECTION_REACTION_BINOMES, 'slug:', slug);
  if (!adminDb) {
    console.error('[getReactionBySlug] Missing adminDb');
    return null;
  }

  try {
    const docRef = adminDb.collection(COLLECTION_REACTION_BINOMES).doc(slug);
    const docSnap = await docRef.get();
    console.log('[getReactionBySlug] docSnap.exists:', docSnap.exists);
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
      isPublished: data.isPublished ?? null,
    };
  } catch (error) {
    console.error('[getReactionBySlug] Error:', error);
    return null;
  }
}

/**
 * Recursively convert Firebase Admin Timestamp objects to plain millisecond numbers
 * so the data can be serialized safely across the server/client boundary.
 * @param {unknown} value
 * @returns {unknown}
 */
function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return value;
  // Firebase Admin Timestamp objects expose toMillis()
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }
  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeFirestoreValue(v);
    }
    return result;
  }
  return value;
}

/**
 * Fetch a paginated first page of published reactions using Firebase Admin SDK.
 * Only supports sort = 'new' (createdAt desc) because FOLLOWING sort requires
 * user-specific data that is not available during server-side rendering.
 *
 * @param {number|null} cursor - Millisecond timestamp of the last reaction's createdAt, or null for the first page.
 * @param {number} limitBy - Number of reactions to fetch.
 * @param {string} sort - Sort key (only 'new' is used server-side).
 * @returns {Promise<{ reactions: Array, lastCursorMs: number|null }>}
 */
export async function getReactionsByPageServer(cursor, limitBy, _sort) {
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();

  if (!adminDb) {
    return { reactions: [], lastCursorMs: null };
  }

  try {
    let q = adminDb
      .collection(COLLECTION_REACTION_BINOMES)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limitBy);

    if (cursor) {
      const { Timestamp } = await import('firebase-admin/firestore');
      q = q.startAfter(Timestamp.fromMillis(cursor));
    }

    const snapshot = await q.get();

    const reactions = snapshot.docs.map((doc) => {
      const raw = doc.data();
      return {
        id: doc.id,
        data: serializeFirestoreValue(raw),
        type: 'reaction',
      };
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const lastCursorMs = lastDoc?.data()?.createdAt?.toMillis?.() ?? null;

    return { reactions, lastCursorMs };
  } catch (error) {
    console.error('Failed to fetch reactions by page (server):', error);
    return { reactions: [], lastCursorMs: null };
  }
}

/**
 * Fetch all published reactions for a given reactor (by reactionVideoAuthor) using Firebase Admin.
 * Returns an array of { id, data } plain objects with Timestamps serialized to milliseconds.
 *
 * @param {string} name - The reactor's channel name (reactionVideoAuthor field value).
 * @returns {Promise<Array<{ id: string, data: object }>>}
 */
export async function getReactionsByReactorServer(name) {
  if (!name) return [];
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) return [];

  try {
    const snapshot = await adminDb
      .collection(COLLECTION_REACTION_BINOMES)
      .where('reactionVideoAuthor', '==', name)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: serializeFirestoreValue(doc.data()),
    }));
  } catch (error) {
    console.error('Failed to fetch reactions by reactor (server):', error);
    return [];
  }
}

/**
 * Fetch all published reactions for a given creator (by originalVideoAuthor) using Firebase Admin.
 * Returns an array of { id, data } plain objects with Timestamps serialized to milliseconds.
 *
 * @param {string} name - The creator's channel name (originalVideoAuthor field value).
 * @returns {Promise<Array<{ id: string, data: object }>>}
 */
export async function getReactionsByCreatorServer(name) {
  if (!name) return [];
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) return [];

  try {
    const snapshot = await adminDb
      .collection(COLLECTION_REACTION_BINOMES)
      .where('originalVideoAuthor', '==', name)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: serializeFirestoreValue(doc.data()),
    }));
  } catch (error) {
    console.error('Failed to fetch reactions by creator (server):', error);
    return [];
  }
}

/**
 * Fetch a playlist document by its slug (document ID) using Firebase Admin.
 * Returns a plain object with the fields needed for SSR/SEO, or null if not found.
 */
export async function getPlaylistBySlug(slug) {
  const { COLLECTION_PLAYLISTS, COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) {
    return null;
  }

  try {
    const docRef = adminDb.collection(COLLECTION_PLAYLISTS).doc(slug);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return null;
    }
    const data = docSnap.data();

    const firstItemThumbnail = Array.isArray(data.sequenceItems)
      ? (data.sequenceItems.find((i) => i.thumbnailUrl)?.thumbnailUrl ?? null)
      : null;
    const firstOriginalVideoId = Array.isArray(data.originalVideoIds)
      ? (data.originalVideoIds[0] ?? null)
      : null;

    // Fetch the reaction video title from the first reaction document.
    const firstReactionId = Array.isArray(data.reactionBinomeIds)
      ? (data.reactionBinomeIds[0] ?? null)
      : null;
    let firstReactionVideoTitle = null;
    let firstReactionDescription = null;
    let firstReactionThumbnailUrl = null;
    let firstReactionVideoId = null;
    if (firstReactionId) {
      const reactionSnap = await adminDb.collection(COLLECTION_REACTION_BINOMES).doc(firstReactionId).get();
      if (reactionSnap.exists) {
        const rd = reactionSnap.data();
        firstReactionVideoTitle = rd.reactionVideoTitle ?? null;
        firstReactionDescription = rd.description ?? null;
        firstReactionThumbnailUrl = rd.thumbnailUrl ?? null;
        firstReactionVideoId = rd.reactionVideoId ?? null;
      }
    }

    return {
      id: docSnap.id,
      title: data.title ?? null,
      description: data.description ?? null,
      thumbnailUrl: firstItemThumbnail,
      firstOriginalVideoId,
      firstReactionVideoTitle,
      firstReactionDescription,
      firstReactionThumbnailUrl,
      firstReactionVideoId,
    };
  } catch (error) {
    console.error('Failed to fetch playlist by slug:', error);
    return null;
  }
}

/**
 * Fetch a moment document by id (or stored slug field matching route param).
 */
export async function getMomentByRouteId(routeId) {
  const { COLLECTION_MOMENTS } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  console.log('[getMomentByRouteId] COLLECTION_MOMENTS:', COLLECTION_MOMENTS, 'routeId:', routeId);
  if (!adminDb || !routeId) {
    console.error('[getMomentByRouteId] Missing adminDb or routeId');
    return null;
  }

  try {
    const directRef = adminDb.collection(COLLECTION_MOMENTS).doc(routeId);
    const directSnap = await directRef.get();
    console.log('[getMomentByRouteId] directSnap.exists:', directSnap.exists);
    if (directSnap.exists) {
      return { id: directSnap.id, ...serializeFirestoreValue(directSnap.data()) };
    }

    const slugSnap = await adminDb
      .collection(COLLECTION_MOMENTS)
      .where('slug', '==', routeId)
      .limit(1)
      .get();
    console.log('[getMomentByRouteId] slugSnap.empty:', slugSnap.empty);
    if (!slugSnap.empty) {
      const doc = slugSnap.docs[0];
      return { id: doc.id, ...serializeFirestoreValue(doc.data()) };
    }
  } catch (error) {
    console.error('[getMomentByRouteId] Error:', error);
  }

  return null;
}

/**
 * Published moment reactions for feed ordering (newest first).
 */
export async function getPublishedMomentReactionsServer(momentId) {
  const { COLLECTION_REACTION_BINOMES } = await import('$lib/constants/firebase');
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb || !momentId) {
    return [];
  }

  try {
    const snapshot = await adminDb
      .collection(COLLECTION_REACTION_BINOMES)
      .where('momentId', '==', momentId)
      .where('isMomentReaction', '==', true)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: serializeFirestoreValue(doc.data())
    }));
  } catch (error) {
    console.error('Failed to fetch moment reactions (server):', error);
    return [];
  }
}
import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { COLLECTION_RATE_LIMITS } from '$lib/constants/firebase';
import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  TEN_MINUTES_MS,
  exportCooldownDecision,
  rateLimitDecision,
  visitorKey,
} from '$lib/helpers/rateLimit';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';

/**
 * Shared fixed-window counter. Each route passes its own bucket, limit, and window.
 * Public routes pass request headers and are counted by visitor.
 * Signed-in routes pass the Firebase uid.
 * A counter outage allows the request. Only an over-limit result blocks it.
 * Account export claims a 24-hour stamp on this collection before the file is built.
 */

export const RATE_LIMITS = {
  originalVideoMetadata: {
    bucket: 'original-video-metadata',
    limit: 30,
    windowMs: TEN_MINUTES_MS,
  },
  youtubeComments: {
    bucket: 'youtube-comments',
    limit: 60,
    windowMs: TEN_MINUTES_MS,
  },
  youtubePlaylist: {
    bucket: 'youtube-playlist',
    limit: 30,
    windowMs: TEN_MINUTES_MS,
  },
  reactionEnrich: {
    bucket: 'reaction-enrich',
    limit: 20,
    windowMs: TEN_MINUTES_MS,
  },
  contentDelete: {
    bucket: 'content-delete',
    limit: 30,
    windowMs: TEN_MINUTES_MS,
  },
  accountDelete: {
    bucket: 'account-delete',
    limit: 5,
    windowMs: ONE_HOUR_MS,
  },
  ageConfirmation: {
    bucket: 'age-confirmation',
    limit: 10,
    windowMs: ONE_HOUR_MS,
  },
  accountExport: {
    bucket: 'account-export',
    limit: 1,
    windowMs: ONE_DAY_MS,
  },
};

let loggedMissingAdmin = false;
let loggedMissingVisitor = false;

function logOnce(slot, message) {
  if (slot === 'admin') {
    if (loggedMissingAdmin) return;
    loggedMissingAdmin = true;
  } else {
    if (loggedMissingVisitor) return;
    loggedMissingVisitor = true;
  }
  console.warn(message);
}

export function rateLimitDocumentId(bucket, id) {
  const digest = createHash('sha256').update(`${bucket}\0${id}`).digest('hex').slice(0, 40);
  return `${bucket}_${digest}`;
}

export const USER_RATE_LIMIT_BUCKETS = [
  RATE_LIMITS.reactionEnrich.bucket,
  RATE_LIMITS.contentDelete.bucket,
  RATE_LIMITS.accountDelete.bucket,
  RATE_LIMITS.ageConfirmation.bucket,
  RATE_LIMITS.accountExport.bucket,
];

export function createFirestoreRateLimitStore(adminDb, collectionName = COLLECTION_RATE_LIMITS) {
  return {
    async consume({ bucket, id, limit, windowMs, now }) {
      const ref = adminDb.collection(collectionName).doc(rateLimitDocumentId(bucket, id));
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const decision = rateLimitDecision({
          snapshot: snap.exists ? snap.data() : null,
          now,
          limit,
          windowMs,
        });
        if (decision.allowed) {
          transaction.set(ref, {
            bucket,
            count: decision.count,
            windowStart: decision.windowStart,
            updatedAt: now,
          });
        }
        return decision;
      });
    },
    async claimExport({ bucket, id, windowMs, now }) {
      const ref = adminDb.collection(collectionName).doc(rateLimitDocumentId(bucket, id));
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const raw = snap.exists ? Number(snap.data()?.lastExportAt) : NaN;
        const previousLastExportAt = Number.isFinite(raw) && raw > 0 ? raw : null;
        const decision = exportCooldownDecision({
          lastExportAtMs: previousLastExportAt,
          nowMs: now,
          windowMs,
        });
        if (!decision.allowed) {
          return { ...decision, claimedAt: null, previousLastExportAt };
        }
        transaction.set(ref, {
          bucket,
          lastExportAt: now,
          updatedAt: now,
        });
        return {
          allowed: true,
          claimedAt: now,
          previousLastExportAt,
          retryAfterSeconds: 0,
          nextAllowedAt: null,
        };
      });
    },
    async releaseExport({ bucket, id, claimedAt, previousLastExportAt }) {
      const ref = adminDb.collection(collectionName).doc(rateLimitDocumentId(bucket, id));
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists ? Number(snap.data()?.lastExportAt) : NaN;
        if (!Number.isFinite(current) || current !== Number(claimedAt)) return false;
        const previous = Number(previousLastExportAt);
        if (Number.isFinite(previous) && previous > 0) {
          transaction.set(ref, {
            bucket,
            lastExportAt: previous,
            updatedAt: previous,
          });
        } else {
          transaction.delete(ref);
        }
        return true;
      });
    },
    async deleteForUser(userId) {
      if (!userId) return 0;
      const batch = adminDb.batch();
      for (const bucket of USER_RATE_LIMIT_BUCKETS) {
        batch.delete(adminDb.collection(collectionName).doc(rateLimitDocumentId(bucket, userId)));
      }
      await batch.commit();
      return USER_RATE_LIMIT_BUCKETS.length;
    },
  };
}

export async function deleteUserRateLimits({ adminDb, userId, store } = {}) {
  if (!userId) return 0;
  const activeStore = store || (adminDb ? createFirestoreRateLimitStore(adminDb) : null);
  if (!activeStore) return 0;
  return activeStore.deleteForUser(userId);
}

function blockedResponse(retryAfterSeconds) {
  return json(
    { error: 'Too many requests. Try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function enforceRateLimit({
  bucket,
  limit,
  windowMs,
  id,
  headers,
  now = Date.now(),
  store,
} = {}) {
  const identity = id || visitorKey(headers);
  if (!bucket || !Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    return null;
  }
  if (!identity) {
    logOnce(
      'visitor',
      'Rate limit skipped because the request had no trustworthy visitor or user id.',
    );
    return null;
  }

  try {
    const activeStore = store || (await openStore());
    if (!activeStore) return null;
    const decision = await activeStore.consume({ bucket, id: identity, limit, windowMs, now });
    if (decision.allowed) return null;
    return blockedResponse(decision.retryAfterSeconds);
  } catch (error) {
    console.error('Rate limit check failed', { bucket, error });
    return null;
  }
}

async function openStore() {
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) {
    logOnce('admin', 'Rate limit skipped because Firebase Admin is not configured.');
    return null;
  }
  return createFirestoreRateLimitStore(adminDb);
}

export async function consumeRateLimit(options) {
  const blocked = await enforceRateLimit(options);
  if (!blocked) return;
  const error = new Error('Too many requests');
  error.name = 'RateLimitExceeded';
  error.rateLimitResponse = blocked;
  throw error;
}

const EXPORT_LIMIT_MESSAGE = 'Export recently requested. Please wait before requesting another export.';

export async function claimAccountExportLimit({ id, now = Date.now(), store } = {}) {
  const policy = RATE_LIMITS.accountExport;
  if (!id) return { id, claimed: false, blocked: null };
  try {
    const activeStore = store || (await openStore());
    if (!activeStore) return { id, claimed: false, blocked: null };
    const decision = await activeStore.claimExport({
      bucket: policy.bucket,
      id,
      windowMs: policy.windowMs,
      now,
    });
    if (decision.allowed) {
      return {
        id,
        claimed: true,
        claimedAt: decision.claimedAt,
        previousLastExportAt: decision.previousLastExportAt,
        blocked: null,
      };
    }
    return {
      id,
      claimed: false,
      blocked: json(
        {
          error: EXPORT_LIMIT_MESSAGE,
          retryAfterSeconds: decision.retryAfterSeconds,
          nextAllowedAt: decision.nextAllowedAt,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(decision.retryAfterSeconds),
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  } catch (error) {
    console.error('Account export limit check failed', error);
    return { id, claimed: false, blocked: null };
  }
}

export async function releaseAccountExportLimit({
  id,
  claimedAt,
  previousLastExportAt,
  store,
} = {}) {
  if (!id || !claimedAt) return false;
  try {
    const activeStore = store || (await openStore());
    if (!activeStore) return false;
    return await activeStore.releaseExport({
      bucket: RATE_LIMITS.accountExport.bucket,
      id,
      claimedAt,
      previousLastExportAt,
    });
  } catch (error) {
    console.error('Account export limit release failed', error);
    return false;
  }
}

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TEN_MINUTES_MS,
  isCloudflareAddress,
  rateLimitDecision,
  visitorKey,
} from '$lib/helpers/rateLimit';
import {
  RATE_LIMITS,
  USER_RATE_LIMIT_BUCKETS,
  consumeRateLimit,
  createFirestoreRateLimitStore,
  deleteUserRateLimits,
  enforceRateLimit,
  rateLimitDocumentId,
} from '$lib/server/rateLimit';

const adminState = vi.hoisted(() => ({ adminDb: null }));

vi.mock('$lib/server/firebaseAdmin', () => ({
  initializeFirebaseAdmin: vi.fn(async () => ({ adminDb: adminState.adminDb })),
}));

function createFakeAdminDb() {
  const docs = new Map();
  let tail = Promise.resolve();

  function makeRef(path) {
    return {
      path,
      async get() {
        if (!docs.has(path)) return { exists: false, data: () => undefined };
        return { exists: true, data: () => structuredClone(docs.get(path)) };
      },
    };
  }

  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return makeRef(`${name}/${id}`);
        },
      };
    },
    batch() {
      const paths = [];
      return {
        delete(ref) {
          paths.push(ref.path);
        },
        async commit() {
          for (const path of paths) docs.delete(path);
        },
      };
    },
    runTransaction(fn) {
      const run = tail.then(async () => {
        const transaction = {
          async get(ref) {
            return ref.get();
          },
          set(ref, data) {
            docs.set(ref.path, structuredClone(data));
          },
        };
        return fn(transaction);
      });
      tail = run.then(
        () => {},
        () => {},
      );
      return run;
    },
  };
}

beforeEach(() => {
  adminState.adminDb = null;
});

describe('visitor identity', () => {
  it('trusts Cloudflare only when the connecting address is a Cloudflare address', () => {
    expect(isCloudflareAddress('104.16.1.1')).toBe(true);
    expect(isCloudflareAddress('203.0.113.5')).toBe(false);
    expect(isCloudflareAddress('2606:4700:1::1')).toBe(true);

    const headers = new Headers({
      'x-nf-client-connection-ip': '104.16.1.1',
      'cf-connecting-ip': '203.0.113.5',
    });
    expect(visitorKey(headers)).toBe('203.0.113.5');
  });

  it('ignores a spoofed Cloudflare header on a direct connection', () => {
    const headers = new Headers({
      'x-nf-client-connection-ip': '198.51.100.20',
      'cf-connecting-ip': '203.0.113.5',
    });
    expect(visitorKey(headers)).toBe('198.51.100.20');
  });

  it('fails open when the visitor cannot be identified', () => {
    expect(visitorKey(new Headers())).toBe('');
    expect(visitorKey(new Headers({ 'x-nf-client-connection-ip': 'not an ip' }))).toBe('');
  });
});

describe('fixed window', () => {
  it('allows up to the limit inside one window and blocks the next call', () => {
    const now = 1_000_000;
    let snapshot = null;
    for (let count = 1; count <= 2; count += 1) {
      const decision = rateLimitDecision({ snapshot, now, limit: 2, windowMs: TEN_MINUTES_MS });
      expect(decision.allowed).toBe(true);
      snapshot = { windowStart: decision.windowStart, count: decision.count };
    }
    const blocked = rateLimitDecision({ snapshot, now: now + 1000, limit: 2, windowMs: TEN_MINUTES_MS });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    const nextWindow = snapshot.windowStart + TEN_MINUTES_MS;
    const reset = rateLimitDecision({ snapshot, now: nextWindow, limit: 2, windowMs: TEN_MINUTES_MS });
    expect(reset.allowed).toBe(true);
    expect(reset.count).toBe(1);
  });
});

describe('firestore counter', () => {
  it('stores a hash instead of the visitor address and returns 429 at the limit', async () => {
    const adminDb = createFakeAdminDb();
    const store = createFirestoreRateLimitStore(adminDb, 'rateLimits_local');
    const policy = RATE_LIMITS.originalVideoMetadata;
    const headers = new Headers({ 'x-nf-client-connection-ip': '198.51.100.20' });

    for (let attempt = 0; attempt < policy.limit; attempt += 1) {
      const allowed = await enforceRateLimit({ ...policy, headers, store, now: 5_000 });
      expect(allowed).toBeNull();
    }
    const blocked = await enforceRateLimit({ ...policy, headers, store, now: 5_000 });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect(await blocked.json()).toEqual({ error: 'Too many requests. Try again later.' });

    const documentId = rateLimitDocumentId(policy.bucket, '198.51.100.20');
    const stored = adminDb.docs.get(`rateLimits_local/${documentId}`);
    expect(stored.count).toBe(policy.limit);
    expect(JSON.stringify(stored)).not.toContain('198.51.100.20');
    expect(documentId).toBe(
      `${policy.bucket}_${createHash('sha256').update(`${policy.bucket}\0${'198.51.100.20'}`).digest('hex').slice(0, 40)}`,
    );
  });

  it('counts a signed-in user separately from a visitor', async () => {
    const store = createFirestoreRateLimitStore(createFakeAdminDb(), 'rateLimits_local');
    const policy = { bucket: 'content-delete', limit: 1, windowMs: TEN_MINUTES_MS };
    expect(await enforceRateLimit({ ...policy, id: 'user-a', store, now: 1 })).toBeNull();
    expect((await enforceRateLimit({ ...policy, id: 'user-a', store, now: 1 })).status).toBe(429);
    expect(await enforceRateLimit({ ...policy, id: 'user-b', store, now: 1 })).toBeNull();
  });

  it('allows the request when the counter cannot be written', async () => {
    const store = {
      async consume() {
        throw new Error('firestore down');
      },
    };
    const allowed = await enforceRateLimit({
      ...RATE_LIMITS.accountDelete,
      id: 'user-a',
      store,
    });
    expect(allowed).toBeNull();
  });

  it('removes only that user\'s signed-in counters', async () => {
    const adminDb = createFakeAdminDb();
    const store = createFirestoreRateLimitStore(adminDb, 'rateLimits_local');
    const now = 1;
    await enforceRateLimit({ ...RATE_LIMITS.accountDelete, id: 'user-a', store, now });
    await enforceRateLimit({ ...RATE_LIMITS.contentDelete, id: 'user-a', store, now });
    await enforceRateLimit({ ...RATE_LIMITS.accountDelete, id: 'user-b', store, now });
    await enforceRateLimit({
      ...RATE_LIMITS.originalVideoMetadata,
      headers: new Headers({ 'x-nf-client-connection-ip': '198.51.100.20' }),
      store,
      now,
    });

    expect(await deleteUserRateLimits({ store, userId: 'user-a' })).toBe(USER_RATE_LIMIT_BUCKETS.length);

    for (const bucket of USER_RATE_LIMIT_BUCKETS) {
      expect(adminDb.docs.has(`rateLimits_local/${rateLimitDocumentId(bucket, 'user-a')}`)).toBe(false);
    }
    expect(
      adminDb.docs.has(`rateLimits_local/${rateLimitDocumentId(RATE_LIMITS.accountDelete.bucket, 'user-b')}`),
    ).toBe(true);
    expect(
      adminDb.docs.has(
        `rateLimits_local/${rateLimitDocumentId(RATE_LIMITS.originalVideoMetadata.bucket, '198.51.100.20')}`,
      ),
    ).toBe(true);
  });

  it('throws the 429 response for an upstream hook once the limit is spent', async () => {
    const store = createFirestoreRateLimitStore(createFakeAdminDb(), 'rateLimits_local');
    const policy = { bucket: 'youtube-comments', limit: 1, windowMs: TEN_MINUTES_MS };
    await consumeRateLimit({ ...policy, id: '198.51.100.20', store, now: 1 });
    await expect(consumeRateLimit({ ...policy, id: '198.51.100.20', store, now: 1 })).rejects.toMatchObject({
      name: 'RateLimitExceeded',
    });
  });
});

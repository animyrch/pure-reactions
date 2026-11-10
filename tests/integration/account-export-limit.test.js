import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_RATE_LIMITS, COLLECTION_USER_DATA } from '$lib/constants/firebase';

const initializeFirebaseAdmin = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/firebaseAdmin', () => ({
  initializeFirebaseAdmin,
}));

import { POST } from '../../src/routes/api/account/export/+server.js';

const algoliaEnv = [
  'PUBLIC_ALGOLIA_APP_ID',
  'PUBLIC_ALGOLIA_SEARCH_API_KEY',
  'PUBLIC_ALGOLIA_REACTIONS_INDEX',
];

function createExportAdmin() {
  const docs = new Map();
  let tail = Promise.resolve();

  function snapshot(path) {
    if (!docs.has(path)) {
      return { exists: false, id: path.split('/').pop(), data: () => undefined };
    }
    const data = docs.get(path);
    return { exists: true, id: path.split('/').pop(), data: () => structuredClone(data) };
  }

  function ref(path) {
    return {
      path,
      id: path.split('/').pop(),
      async get() {
        return snapshot(path);
      },
      async update(patch) {
        if (!docs.has(path)) throw new Error(`No document to update: ${path}`);
        const next = { ...docs.get(path) };
        for (const [key, value] of Object.entries(patch)) {
          if (value && value.__delete) delete next[key];
          else next[key] = value;
        }
        docs.set(path, next);
      },
      collection() {
        return { get: async () => ({ docs: [] }) };
      },
    };
  }

  return {
    docs,
    adminDb: {
      collection(name) {
        return {
          doc(id) {
            return ref(`${name}/${id}`);
          },
          where() {
            return { get: async () => ({ docs: [] }) };
          },
        };
      },
      runTransaction(fn) {
        const run = tail.then(async () => {
          const transaction = {
            async get(docRef) {
              return docRef.get();
            },
            set(docRef, data) {
              docs.set(docRef.path, structuredClone(data));
            },
            delete(docRef) {
              docs.delete(docRef.path);
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
    },
    adminFieldValue: {
      delete: () => ({ __delete: true }),
    },
    adminAuth: {
      verifyIdToken: vi.fn(async () => ({ uid: 'user-1' })),
      getUser: vi.fn(async () => ({
        uid: 'user-1',
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner',
        photoURL: null,
        phoneNumber: null,
        disabled: false,
        providerData: [],
        customClaims: {},
        metadata: {},
      })),
    },
  };
}

function exportRequest(token = 'token') {
  return POST({
    request: new Request('http://localhost/api/account/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  });
}

describe('account export route limit', () => {
  const previousEnv = new Map();

  beforeEach(() => {
    for (const key of algoliaEnv) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    initializeFirebaseAdmin.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('claims the server slot before reading the account and ignores userData.lastExportAt', async () => {
    const admin = createExportAdmin();
    admin.docs.set(`${COLLECTION_USER_DATA}/user-1`, {
      displayName: 'Owner',
      lastExportAt: 'legacy',
    });
    initializeFirebaseAdmin.mockResolvedValue(admin);

    const [first, second] = await Promise.all([exportRequest(), exportRequest()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 429]);
    expect(admin.docs.get(`${COLLECTION_USER_DATA}/user-1`)).toEqual({ displayName: 'Owner' });
    const exported = first.status === 200 ? first : second;
    const payload = await exported.json();
    expect(payload.export.data.firestore.userData.data.lastExportAt).toBeUndefined();
    expect(payload.export.data.firestore.userData.data.displayName).toBe('Owner');

    admin.docs.delete(`${COLLECTION_USER_DATA}/user-1`);
    const cleared = await exportRequest();
    expect(cleared.status).toBe(429);
    const body = await cleared.json();
    expect(body.error).toBe('Export recently requested. Please wait before requesting another export.');
    expect(body.nextAllowedAt).toEqual(expect.any(String));
    expect(cleared.headers.get('Retry-After')).toBeTruthy();

    const userData = admin.docs.get(`${COLLECTION_USER_DATA}/user-1`);
    expect(userData?.lastExportAt).toBeUndefined();
    expect([...admin.docs.keys()].some((path) => path.startsWith(`${COLLECTION_RATE_LIMITS}/`))).toBe(true);
  });

  it('releases the claim when building the export throws', async () => {
    const admin = createExportAdmin();
    let reads = 0;
    const collection = admin.adminDb.collection.bind(admin.adminDb);
    admin.adminDb.collection = (name) => {
      const api = collection(name);
      return {
        doc: (id) => api.doc(id),
        where: () => ({
          get: async () => {
            reads += 1;
            if (reads === 1) throw new Error('read failed');
            return { docs: [] };
          },
        }),
      };
    };
    initializeFirebaseAdmin.mockResolvedValue(admin);

    const failed = await exportRequest();
    expect(failed.status).toBe(500);
    expect([...admin.docs.keys()].some((path) => path.startsWith(`${COLLECTION_RATE_LIMITS}/`))).toBe(false);

    const retry = await exportRequest();
    expect(retry.status).toBe(200);
  });

  it('does not claim a slot for an invalid token', async () => {
    const admin = createExportAdmin();
    admin.adminAuth.verifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    initializeFirebaseAdmin.mockResolvedValue(admin);

    const response = await exportRequest();
    expect(response.status).toBe(401);
    expect(admin.docs.size).toBe(0);
  });
});

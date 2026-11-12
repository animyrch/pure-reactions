import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_REACTION_BINOMES } from '$lib/constants/firebase';
import {
  classifyStatsReaction,
  classifyStatsUser,
  isExcludedStatsEmail,
  statsBearerTokensMatch,
} from '$lib/helpers/adminStats';
import * as secrets from '$lib/helpers/secretEqual.js';
import { RATE_LIMITS } from '$lib/server/rateLimit';
import { STATS_REACTION_PAGE_SIZE, STATS_USER_PAGE_SIZE } from '$lib/server/adminStats';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';
import { GET } from '../../src/routes/api/admin/stats/+server.js';

const TOKEN = 'a'.repeat(32);
const privateEnv = vi.hoisted(() => ({ values: {} }));
const adminState = vi.hoisted(() => ({ adminAuth: null, adminDb: null }));

vi.mock('$env/dynamic/private', () => ({
  env: new Proxy(
    {},
    {
      get(_target, property) {
        return privateEnv.values[property];
      },
    },
  ),
}));

vi.mock('$lib/server/firebaseAdmin', () => ({
  initializeFirebaseAdmin: vi.fn(async () => ({
    adminAuth: adminState.adminAuth,
    adminDb: adminState.adminDb,
  })),
}));

function createFakeAdminDb() {
  const docs = new Map();
  const queries = [];
  let tail = Promise.resolve();

  function makeRef(path) {
    return {
      path,
      async get() {
        if (!docs.has(path)) return { exists: false, id: path.split('/').pop(), data: () => undefined };
        return { exists: true, id: path.split('/').pop(), data: () => structuredClone(docs.get(path)) };
      },
    };
  }

  function createQuery(name) {
    const state = {
      limit: Number.POSITIVE_INFINITY,
      startAfterId: '',
      selected: null,
    };
    const api = {
      select(...fields) {
        state.selected = fields;
        return api;
      },
      orderBy() {
        return api;
      },
      limit(count) {
        state.limit = count;
        return api;
      },
      startAfter(snapshot) {
        state.startAfterId = snapshot?.id || '';
        return api;
      },
      async get() {
        const prefix = `${name}/`;
        let ids = [...docs.keys()]
          .filter((path) => path.startsWith(prefix))
          .map((path) => path.slice(prefix.length))
          .sort();
        if (state.startAfterId) ids = ids.filter((id) => id > state.startAfterId);
        ids = ids.slice(0, state.limit);
        queries.push({
          name,
          selected: state.selected ? [...state.selected] : null,
          startAfterId: state.startAfterId,
          size: ids.length,
        });
        const page = ids.map((id) => {
          const stored = docs.get(prefix + id) || {};
          const data = {};
          for (const field of state.selected || Object.keys(stored)) data[field] = stored[field];
          return { id, data: () => structuredClone(data) };
        });
        return { empty: page.length === 0, size: page.length, docs: page };
      },
    };
    return api;
  }

  return {
    docs,
    queries,
    collection(name) {
      const query = createQuery(name);
      query.doc = (id) => makeRef(`${name}/${id}`);
      return query;
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
          delete(ref) {
            docs.delete(ref.path);
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

function seedReaction(adminDb, id, data) {
  adminDb.docs.set(`${COLLECTION_REACTION_BINOMES}/${id}`, data);
}

function statsRequest(token, url = 'http://localhost/api/admin/stats') {
  const headers = new Headers();
  if (token !== undefined) headers.set('authorization', token);
  return GET({ request: new Request(url, { headers }) });
}

function bearer(token) {
  return `Bearer ${token}`;
}

describe('outside stats rules', () => {
  it('matches a configured token with an equal-length digest compare', () => {
    const spy = vi.spyOn(secrets, 'secretEqual');
    expect(statsBearerTokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(statsBearerTokensMatch(`${TOKEN}extra`, TOKEN)).toBe(false);
    expect(statsBearerTokensMatch('short', TOKEN)).toBe(false);
    expect(statsBearerTokensMatch('b'.repeat(31), 'b'.repeat(31))).toBe(false);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    for (const [left, right] of spy.mock.calls) {
      expect(left.length).toBe(32);
      expect(right.length).toBe(32);
    }
    expect(() => secrets.secretEqual(Buffer.from('ab'), Buffer.from('a'))).toThrow();
    spy.mockRestore();
  });

  it('leaves out the private and test email patterns', () => {
    expect(isExcludedStatsEmail('EmirGokhanOzcelik+lab@gmail.com')).toBe(true);
    expect(isExcludedStatsEmail(' emirgokhanozcelik+lab@gmail.com ')).toBe(true);
    expect(isExcludedStatsEmail('emirgokhanozcelik@gmail.com')).toBe(false);
    expect(isExcludedStatsEmail('qa@test.com')).toBe(true);
    expect(isExcludedStatsEmail('qa@TEST.com')).toBe(true);
    expect(isExcludedStatsEmail('qa@test.com.example')).toBe(false);
    expect(isExcludedStatsEmail('person@example.com')).toBe(false);
    expect(isExcludedStatsEmail('')).toBe(false);

    const excluded = new Set(['uid-emir']);
    expect(classifyStatsUser({ uid: 'uid-emir', email: 'person@example.com' }, excluded).excluded).toBe(true);
    expect(
      classifyStatsUser(
        { uid: 'uid-provider', email: 'person@example.com', providerData: [{ email: 'alias@test.com' }] },
        excluded,
      ).excluded,
    ).toBe(true);
    expect(classifyStatsUser({ uid: 'uid-outside', email: 'person@example.com' }, excluded).excluded).toBe(false);
    expect(classifyStatsReaction({ reactorId: 'uid-emir', isPublished: true }, excluded)).toBe('excluded');
    expect(classifyStatsReaction({ reactorId: 'uid-outside', isPublished: true }, excluded)).toBe('published');
    expect(classifyStatsReaction({ reactorId: 'uid-outside', isPublished: false }, excluded)).toBe('unpublished');
    expect(classifyStatsReaction({ reactorId: 'uid-outside', isPublished: 'true' }, excluded)).toBe('unpublished');
    expect(classifyStatsReaction({ isPublished: false }, excluded)).toBe('unpublished');
  });
});

describe('GET /api/admin/stats', () => {
  let adminDb;

  beforeEach(() => {
    privateEnv.values = {
      STATS_API_TOKEN: TOKEN,
      STATS_EXCLUDED_UIDS: ' uid-emir , uid-emir ',
      STATS_ADMIN_UIDS: '',
    };
    adminDb = createFakeAdminDb();
    adminState.adminDb = adminDb;
    adminState.adminAuth = {
      listUsers: vi.fn(async () => ({ users: [] })),
      verifyIdToken: vi.fn(async () => {
        throw new Error('invalid token');
      }),
    };
    initializeFirebaseAdmin.mockClear();
  });

  afterEach(() => {
    privateEnv.values = {};
    adminState.adminAuth = null;
    adminState.adminDb = null;
    vi.restoreAllMocks();
  });

  it('returns an empty 401 when the header is missing or the token is wrong', async () => {
    const missing = await statsRequest();
    expect(missing.status).toBe(401);
    expect(await missing.text()).toBe('');
    expect(missing.headers.get('cache-control')).toBe('no-store');
    expect(initializeFirebaseAdmin).not.toHaveBeenCalled();

    const spy = vi.spyOn(secrets, 'secretEqual');
    const wrong = await statsRequest(bearer('b'.repeat(32)));
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toBe('');
    expect(wrong.headers.get('cache-control')).toBe('no-store');
    expect(spy).toHaveBeenCalled();
    expect(adminState.adminAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(adminState.adminAuth.listUsers).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('rejects a server token shorter than 32 bytes', async () => {
    privateEnv.values.STATS_API_TOKEN = 'c'.repeat(31);
    const response = await statsRequest(bearer('c'.repeat(31)));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(adminState.adminAuth.listUsers).not.toHaveBeenCalled();
  });

  it('returns the four outside counts and no personal data or ids', async () => {
    adminState.adminAuth.listUsers.mockImplementation(async (pageSize, pageToken) => {
      expect(pageSize).toBe(STATS_USER_PAGE_SIZE);
      if (!pageToken) {
        return {
          users: [
            { uid: 'uid-outside-secret', email: 'outside-secret@example.com' },
            { uid: 'uid-emir', email: 'emir@example.com' },
            { uid: 'uid-plus', email: 'EmirGokhanOzcelik+secret@gmail.com' },
            { uid: 'uid-test', email: 'qa@test.com' },
            {
              uid: 'uid-provider',
              email: 'kept@example.com',
              providerData: [{ email: 'alias@test.com' }],
            },
            { uid: 'uid-plain', email: 'second-outside@example.com' },
            { uid: 'uid-no-plus', email: 'emirgokhanozcelik@gmail.com' },
          ],
          pageToken: 'next-page',
        };
      }
      expect(pageToken).toBe('next-page');
      return {
        users: [{ uid: 'uid-page-two', email: 'page-two@example.com' }],
      };
    });

    seedReaction(adminDb, 'reaction-secret-id', {
      reactorId: 'uid-outside-secret',
      isPublished: true,
      reactionVideoTitle: 'Secret Reaction Title',
    });
    seedReaction(adminDb, 'rx-draft', {
      reactorId: 'uid-outside-secret',
      isPublished: false,
      description: 'draft notes',
    });
    seedReaction(adminDb, 'rx-missing-flag', { reactorId: 'uid-plain' });
    seedReaction(adminDb, 'rx-emir', {
      reactorId: 'uid-emir',
      isPublished: true,
      reactionVideoTitle: 'Emir private',
    });
    seedReaction(adminDb, 'rx-plus', { reactorId: 'uid-plus', isPublished: true });
    seedReaction(adminDb, 'rx-test', { reactorId: 'uid-test', isPublished: false });
    seedReaction(adminDb, 'rx-provider', { reactorId: 'uid-provider', isPublished: true });
    seedReaction(adminDb, 'rx-unknown', { reactorId: 'uid-not-in-auth', isPublished: true });
    seedReaction(adminDb, 'rx-no-owner', { isPublished: false });
    seedReaction(adminDb, 'rx-page-two', { reactorId: 'uid-page-two', isPublished: true });
    seedReaction(adminDb, 'rx-string-true', { reactorId: 'uid-plain', isPublished: 'true' });
    seedReaction(adminDb, 'rx-no-plus', { reactorId: 'uid-no-plus', isPublished: true });

    const response = await statsRequest(bearer(TOKEN), 'http://localhost/api/admin/stats?since=2020-01-01');
    const raw = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const body = JSON.parse(raw);
    expect(Object.keys(body).sort()).toEqual([
      'generated_at',
      'outside_reactions_published',
      'outside_reactions_unpublished',
      'outside_signups',
    ]);
    expect(body.outside_signups).toBe(4);
    expect(body.outside_reactions_published).toBe(4);
    expect(body.outside_reactions_unpublished).toBe(4);
    expect(body.outside_reactions_published + body.outside_reactions_unpublished).toBe(8);
    expect(Number.isInteger(body.outside_signups)).toBe(true);
    expect(Number.isInteger(body.outside_reactions_published)).toBe(true);
    expect(Number.isInteger(body.outside_reactions_unpublished)).toBe(true);
    expect(body.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(body.generated_at).toISOString()).toBe(body.generated_at);

    for (const secret of [
      'outside-secret@example.com',
      'EmirGokhanOzcelik+secret@gmail.com',
      'qa@test.com',
      'alias@test.com',
      'uid-outside-secret',
      'uid-emir',
      'uid-plus',
      'reaction-secret-id',
      'Secret Reaction Title',
      'Emir private',
      'draft notes',
    ]) {
      expect(raw).not.toContain(secret);
    }

    expect(adminDb.queries).toHaveLength(1);
    expect(adminDb.queries[0].selected).toEqual(['reactorId', 'isPublished']);
    expect(adminState.adminAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(adminState.adminAuth.listUsers).toHaveBeenCalledTimes(2);
  });

  it('pages through every reaction', async () => {
    adminState.adminAuth.listUsers.mockResolvedValue({
      users: [{ uid: 'uid-outside', email: 'outside@example.com' }],
    });
    const total = STATS_REACTION_PAGE_SIZE + 1;
    for (let index = 0; index < total; index += 1) {
      seedReaction(adminDb, `rx-${String(index).padStart(4, '0')}`, {
        reactorId: 'uid-outside',
        isPublished: index % 2 === 0,
      });
    }

    const response = await statsRequest(bearer(TOKEN));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.outside_signups).toBe(1);
    expect(body.outside_reactions_published + body.outside_reactions_unpublished).toBe(total);
    expect(body.outside_reactions_published).toBe(Math.ceil(total / 2));
    expect(adminDb.queries.length).toBeGreaterThan(1);
    expect(adminState.adminAuth.listUsers).toHaveBeenCalledWith(STATS_USER_PAGE_SIZE, undefined);
  });

  it('returns 429 when the stats allowance is spent', async () => {
    adminState.adminAuth.listUsers.mockResolvedValue({
      users: [{ uid: 'uid-outside', email: 'outside@example.com' }],
    });
    seedReaction(adminDb, 'rx-1', { reactorId: 'uid-outside', isPublished: true });

    for (let attempt = 0; attempt < RATE_LIMITS.adminStats.limit; attempt += 1) {
      const allowed = await statsRequest(bearer(TOKEN));
      expect(allowed.status).toBe(200);
    }

    const blocked = await statsRequest(bearer(TOKEN));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('cache-control')).toBe('no-store');
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(adminState.adminAuth.listUsers).toHaveBeenCalledTimes(RATE_LIMITS.adminStats.limit);
    const raw = await blocked.text();
    expect(raw).not.toContain('outside@example.com');
    expect(raw).not.toContain('uid-outside');
  });

  it('rejects a Firebase ID token whose UID is not an admin', async () => {
    privateEnv.values.STATS_ADMIN_UIDS = 'admin-1';
    adminState.adminAuth.verifyIdToken.mockResolvedValue({ uid: 'intruder', email: 'intruder@example.com' });

    const response = await statsRequest(bearer('firebase-id-token'));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(adminState.adminAuth.verifyIdToken).toHaveBeenCalledWith('firebase-id-token');
    expect(adminState.adminAuth.listUsers).not.toHaveBeenCalled();
  });

  it('accepts a Firebase ID token whose UID is an admin', async () => {
    privateEnv.values.STATS_ADMIN_UIDS = 'admin-1, admin-2';
    adminState.adminAuth.verifyIdToken.mockResolvedValue({ uid: 'admin-2', email: 'admin-2@example.com' });
    adminState.adminAuth.listUsers.mockResolvedValue({
      users: [{ uid: 'uid-outside', email: 'outside@example.com' }],
    });

    const response = await statsRequest(bearer('firebase-id-token'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.outside_signups).toBe(1);
    expect(Object.keys(body)).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain('admin-2@example.com');
    expect(adminState.adminAuth.verifyIdToken).toHaveBeenCalledOnce();
  });

  it('does not return account data when the count fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminState.adminAuth.listUsers.mockRejectedValue(new Error('list failed outside-secret@example.com'));

    const response = await statsRequest(bearer(TOKEN));
    const raw = await response.text();
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse(raw)).toEqual({ error: 'Could not load stats.' });
    expect(raw).not.toContain('outside-secret@example.com');
    expect(errorSpy).toHaveBeenCalled();
  });
});

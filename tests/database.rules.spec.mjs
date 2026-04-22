import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { get, ref, remove, set, update } from 'firebase/database';

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const projectId = 'pure-reactions-rtdb-rules-test';
const hostId = 'host-user';
const otherId = 'other-user';
const viewerId = 'viewer-user';
const sessionId = 'reaction-session-123';

let testEnv;

const baseSession = {
  originalVideoId: '8-3PahRtgF4',
  originalVideoPlatform: 'youtube',
  originalVideoUrl: 'https://www.youtube.com/watch?v=8-3PahRtgF4',
  reactorId: hostId,
  activeReactionDocumentId: sessionId,
  state: 'waiting',
  currentTime: 0,
  duration: 120,
  volume: 100,
  playbackRate: 1,
  createdAt: 1713657600000,
  lastUpdated: 1713657600000,
  viewers: {}
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    database: { rules }
  });
});

beforeEach(async () => {
  await testEnv.clearDatabase();
});

after(async () => {
  await testEnv.cleanup();
});

const hostDb = () => testEnv.authenticatedContext(hostId).database();
const otherDb = () => testEnv.authenticatedContext(otherId).database();
const viewerDb = () =>
  testEnv.authenticatedContext(viewerId, {
    firebase: {
      sign_in_provider: 'anonymous'
    }
  }).database();
const anonDb = () => testEnv.unauthenticatedContext().database();

const sessionRef = (db) => ref(db, `sharedSessions/${sessionId}`);
const viewerRef = (db, uid = viewerId) => ref(db, `sharedSessions/${sessionId}/viewers/${uid}`);

const seedSession = async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(sessionRef(context.database()), baseSession);
  });
};

test('anonymous users can read a shared session', async () => {
  await seedSession();
  await assertSucceeds(get(sessionRef(anonDb())));
});

test('authenticated host can create a shared session for themselves', async () => {
  await assertSucceeds(set(sessionRef(hostDb()), baseSession));
});

test('authenticated user cannot create a session for another host uid', async () => {
  await assertFails(
    set(sessionRef(otherDb()), {
      ...baseSession,
      reactorId: hostId
    })
  );
});

test('only the host can update session state', async () => {
  await seedSession();
  await assertSucceeds(
    update(sessionRef(hostDb()), {
      state: 'playing',
      currentTime: 42,
      lastUpdated: 1713657660000
    })
  );
  await assertFails(
    update(sessionRef(otherDb()), {
      state: 'paused',
      lastUpdated: 1713657720000
    })
  );
});

test('viewer can write and remove only their own presence node', async () => {
  await seedSession();

  await assertSucceeds(
    set(viewerRef(viewerDb()), {
      name: 'Anonymous Viewer',
      joinedAt: 1713657605000,
      isActive: true
    })
  );

  await assertFails(
    set(viewerRef(viewerDb(), otherId), {
      name: 'Imposter',
      joinedAt: 1713657605000,
      isActive: true
    })
  );

  await assertSucceeds(remove(viewerRef(viewerDb())));
});

test('anonymous users cannot write viewer presence', async () => {
  await seedSession();
  await assertFails(
    set(viewerRef(anonDb()), {
      name: 'Anonymous Viewer',
      joinedAt: 1713657605000,
      isActive: true
    })
  );
});
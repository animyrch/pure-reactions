import { strict as assert } from 'node:assert';
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

const slotId = '0123456789abcdef0123456789abcdef';
const otherSlotId = 'fedcba9876543210fedcba9876543210';
const presence = {
  name: 'Anonymous Viewer',
  joinedAt: 1713657605000,
  isActive: true
};

const sessionRef = (db) => ref(db, `sharedSessions/${sessionId}`);
const ownerRef = (db, slot = slotId) => ref(db, `sessionViewerOwners/${sessionId}/${slot}`);
const viewerSlotRef = (db, slot = slotId) => ref(db, `sharedSessions/${sessionId}/viewers/${slot}`);

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

test('viewer can claim a random slot and remove only that presence', async () => {
  await seedSession();

  await assertSucceeds(set(ownerRef(viewerDb()), viewerId));
  await assertFails(set(ownerRef(viewerDb()), viewerId));
  await assertSucceeds(set(viewerSlotRef(viewerDb()), presence));

  await assertFails(set(ownerRef(otherDb()), otherId));
  await assertFails(set(viewerSlotRef(otherDb()), presence));
  await assertFails(set(viewerSlotRef(otherDb(), otherSlotId), presence));
  await assertFails(set(viewerSlotRef(viewerDb()), { ...presence, uid: viewerId }));

  const snapshot = await get(sessionRef(anonDb()));
  const viewers = snapshot.val().viewers;
  assert.deepEqual(Object.keys(viewers), [slotId]);
  assert.equal(viewers[slotId].name, 'Anonymous Viewer');
  assert.equal('uid' in viewers[slotId], false);

  await assertSucceeds(remove(viewerSlotRef(viewerDb())));
  await assertSucceeds(remove(ownerRef(viewerDb())));
});

test('a viewer cannot claim a slot before the shared session exists', async () => {
  await assertFails(set(ownerRef(viewerDb()), viewerId));
});

test('owning account can delete its viewer claim after the session is removed', async () => {
  await seedSession();
  await assertSucceeds(set(ownerRef(viewerDb()), viewerId));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await remove(sessionRef(context.database()));
  });

  await assertFails(set(ownerRef(viewerDb()), viewerId));
  await assertFails(remove(ownerRef(otherDb())));
  await assertSucceeds(remove(ownerRef(viewerDb())));
});

test('a viewer cannot use an account id as the public slot key', async () => {
  await seedSession();
  await assertFails(set(ownerRef(viewerDb(), viewerId), viewerId));
  await assertFails(set(viewerSlotRef(viewerDb(), viewerId), presence));
});

test('presence owner records are not readable', async () => {
  await seedSession();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ownerRef(context.database()), viewerId);
  });

  await assertFails(get(ownerRef(anonDb())));
  await assertFails(get(ownerRef(viewerDb())));
  await assertFails(get(ownerRef(hostDb())));
  await assertFails(get(ref(anonDb(), `sessionViewerOwners/${sessionId}`)));
});

test('anonymous users cannot write viewer presence', async () => {
  await seedSession();
  await assertFails(set(ownerRef(anonDb()), viewerId));
  await assertFails(set(viewerSlotRef(anonDb()), presence));
});

test('host can publish or clear a twitch channel and other users cannot', async () => {
  await seedSession();

  await assertSucceeds(
    update(sessionRef(hostDb()), {
      twitchChannel: 'animy_tr',
      lastUpdated: 1713657660000
    })
  );

  await assertSucceeds(
    update(sessionRef(hostDb()), {
      twitchChannel: '',
      lastUpdated: 1713657720000
    })
  );

  await assertFails(
    update(sessionRef(hostDb()), {
      twitchChannel: 'Not A Channel',
      lastUpdated: 1713657780000
    })
  );

  await assertFails(
    update(sessionRef(otherDb()), {
      twitchChannel: 'someoneelse',
      lastUpdated: 1713657840000
    })
  );
});

test('host cannot write fields outside the session schema', async () => {
  await seedSession();
  await assertFails(
    update(sessionRef(hostDb()), {
      surprise: 'nope'
    })
  );
});
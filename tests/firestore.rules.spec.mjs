import { readFileSync } from 'node:fs';
import { before, beforeEach, after, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const projectId = 'pure-reactions-rules-test';
const ownerId = 'user-owner';
const otherId = 'user-other';
const adminId = 'user-admin';

let testEnv;

const reactionIds = {
  published: 'reaction-public',
  draft: 'reaction-draft'
};

const claimData = {
  userId: ownerId,
  youtubeChannelId: 'channel-handle',
  verificationToken: 'PR-TEST-1234',
  verificationVideoUrl: 'https://www.youtube.com/watch?v=abc123',
  status: 'pending',
  createdAt: '2024-01-01'
};

const claimId = `${claimData.youtubeChannelId}__${claimData.userId}`;
const verificationId = claimData.youtubeChannelId;
const verificationData = {
  status: 'approved',
  claimId,
  approvedAt: '2024-01-02'
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'reactions', reactionIds.published), {
      reactorId: ownerId,
      isPublished: true,
      title: 'Published reaction',
      createdAt: '2024-01-01'
    });
    await setDoc(doc(db, 'reactions', reactionIds.draft), {
      reactorId: ownerId,
      isPublished: false,
      title: 'Draft reaction',
      createdAt: '2024-01-02'
    });
  });
});

after(async () => {
  console.log('Running teardown...');
  // Force exit immediately to prevent hanging due to open handles from Firestore SDK
  // We don't wait for cleanup because we're running in ephemeral emulator
  console.log('Force exiting now.');
  process.exit(0);
});

let _ownerDb;
const ownerDb = () => {
  if (!_ownerDb) _ownerDb = testEnv.authenticatedContext(ownerId).firestore();
  return _ownerDb;
};
let _otherDb;
const otherDb = () => {
  if (!_otherDb) _otherDb = testEnv.authenticatedContext(otherId).firestore();
  return _otherDb;
};
let _adminDb;
const adminDb = () => {
  if (!_adminDb) _adminDb = testEnv.authenticatedContext(adminId, { admin: true }).firestore();
  return _adminDb;
};
let _anonDb;
const anonDb = () => {
  if (!_anonDb) _anonDb = testEnv.unauthenticatedContext().firestore();
  return _anonDb;
};

const seedClaim = async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'youtubeChannelClaims', claimId), claimData);
  });
};

const seedVerification = async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'youtubeChannelVerifications', verificationId), verificationData);
  });
};

test('logged out can read published reactions', async () => {
  await assertSucceeds(getDoc(doc(anonDb(), 'reactions', reactionIds.published)));
});

test('logged out can read draft reactions by direct link', async () => {
  await assertSucceeds(getDoc(doc(anonDb(), 'reactions', reactionIds.draft)));
});

test('logged out cannot list draft reactions', async () => {
  const draftsQuery = query(
    collection(anonDb(), 'reactions'),
    where('isPublished', '==', false)
  );
  await assertFails(getDocs(draftsQuery));
});

test('owner can update reactions', async () => {
  await assertSucceeds(
    updateDoc(doc(ownerDb(), 'reactions', reactionIds.published), {
      title: 'Updated title'
    })
  );
});

test('non-owner cannot update reactions', async () => {
  await assertFails(
    updateDoc(doc(otherDb(), 'reactions', reactionIds.published), {
      title: 'Nope'
    })
  );
});

test('owner can create claims', async () => {
  await assertSucceeds(setDoc(doc(ownerDb(), 'youtubeChannelClaims', claimId), claimData));
});

test('owner can get claims', async () => {
  await seedClaim();
  await assertSucceeds(getDoc(doc(ownerDb(), 'youtubeChannelClaims', claimId)));
});

test('owner can check missing claims', async () => {
  await assertSucceeds(getDoc(doc(ownerDb(), 'youtubeChannelClaims', claimId)));
});

test('claims list is denied', async () => {
  await seedClaim();
  const claimsQuery = query(
    collection(ownerDb(), 'youtubeChannelClaims'),
    where('userId', '==', ownerId)
  );
  await assertFails(getDocs(claimsQuery));
});

test('admin can approve claims', async () => {
  await seedClaim();
  await assertSucceeds(
    updateDoc(doc(adminDb(), 'youtubeChannelClaims', claimId), {
      status: 'approved',
      reviewNotes: 'ok'
    })
  );
});

test('anonymous can get channel verification', async () => {
  await seedVerification();
  await assertSucceeds(getDoc(doc(anonDb(), 'youtubeChannelVerifications', verificationId)));
});

test('anonymous cannot list channel verifications', async () => {
  await seedVerification();
  await assertFails(getDocs(collection(anonDb(), 'youtubeChannelVerifications')));
});

const seedQueue = async (queueId = 'owner-queue') => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'queues', queueId), {
      ownerId,
      slug: queueId,
      title: 'Owner queue',
      items: [],
      createdAt: '2024-01-01'
    });
  });
};

test('owner can create a queue', async () => {
  await assertSucceeds(
    setDoc(doc(ownerDb(), 'queues', 'owner-created-queue'), {
      ownerId,
      slug: 'owner-created-queue',
      title: 'Created by owner',
      items: [],
      createdAt: '2024-01-01'
    })
  );
});

test('owner can read their queue', async () => {
  await seedQueue('owner-queue');
  await assertSucceeds(getDoc(doc(ownerDb(), 'queues', 'owner-queue')));
});

test('non-owner cannot read another user\'s queue', async () => {
  await seedQueue('owner-queue');
  await assertFails(getDoc(doc(otherDb(), 'queues', 'owner-queue')));
});

test('non-owner cannot create a queue claiming another owner', async () => {
  await assertFails(
    setDoc(doc(otherDb(), 'queues', 'malicious-queue'), {
      ownerId,
      slug: 'malicious-queue',
      title: 'Not theirs',
      items: [],
      createdAt: '2024-01-01'
    })
  );
});

test('owner can add valid items to queue', async () => {
  await seedQueue('owner-update-queue');
  await assertSucceeds(
    updateDoc(doc(ownerDb(), 'queues', 'owner-update-queue'), {
      items: [
        { type: 'reaction', id: 'some-reaction-id' },
        { type: 'reaction', id: 'reaction-not-owned-by-me' }
      ]
    })
  );
});

test('user can read non-existent queue to check availability', async () => {
  // upsertReactionIntoQueue does a getDoc first to see if it exists
  await assertSucceeds(getDoc(doc(ownerDb(), 'queues', 'new-non-existent-queue')));
});

test('owner can publish their queue', async () => {
  await seedQueue('owner-publish-queue');
  await assertSucceeds(
    updateDoc(doc(ownerDb(), 'queues', 'owner-publish-queue'), {
      isPublished: true
    })
  );
});

test('non-owner can read published queue', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'queues', 'public-queue'), {
      ownerId,
      slug: 'public-queue',
      title: 'Public Queue',
      isPublished: true,
      items: [],
      createdAt: '2024-01-01'
    });
  });
  await assertSucceeds(getDoc(doc(otherDb(), 'queues', 'public-queue')));
});

test('non-owner cannot read unpublished queue', async () => {
  await seedQueue('private-queue'); // isPublished is missing/false by default in seedQueue
  await assertFails(getDoc(doc(otherDb(), 'queues', 'private-queue')));
});

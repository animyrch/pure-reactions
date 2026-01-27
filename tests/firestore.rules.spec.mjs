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
  await testEnv.cleanup();
});

const ownerDb = () => testEnv.authenticatedContext(ownerId).firestore();
const otherDb = () => testEnv.authenticatedContext(otherId).firestore();
const adminDb = () => testEnv.authenticatedContext(adminId, { admin: true }).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

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

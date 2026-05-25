import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore/lite';
import { db, auth } from '$lib/constants/firebase';
import { COLLECTION_MOMENTS, COLLECTION_REACTION_BINOMES } from '$lib/constants/firebase';
import { MOMENT_SORT_OPTIONS } from '$lib/constants/moments';
import { slugifyMomentTitle } from '$lib/helpers/moments';

const createMomentsCollection = () => collection(db, COLLECTION_MOMENTS);
const createReactionsCollection = () => collection(db, COLLECTION_REACTION_BINOMES);

export const buildMomentPagePath = (momentId) => `/moments/${momentId}`;

export const resolveMomentRouteId = (moment) => moment?.slug?.trim?.() || moment?.id || '';

export const getMoment = async (momentId) => {
  if (!momentId || !db) {
    return null;
  }
  try {
    const snap = await getDoc(doc(createMomentsCollection(), momentId));
    if (!snap.exists()) {
      return null;
    }
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('Error loading moment:', error);
    return null;
  }
};

export const getMomentsByPage = async ({
  lastDoc = null,
  limitBy = 12,
  sortBy = MOMENT_SORT_OPTIONS.NEWEST,
  tag = ''
} = {}) => {
  let moments = [];
  let lastVisible = null;

  if (!db) {
    return { moments, lastVisible };
  }

  try {
    const momentsCollection = createMomentsCollection();
    const constraints = [];

    const normalizedTag = typeof tag === 'string' ? tag.trim() : '';
    if (normalizedTag) {
      constraints.push(where('tags', 'array-contains', normalizedTag));
    }

    if (sortBy === MOMENT_SORT_OPTIONS.MOST_REACTIONS || sortBy === MOMENT_SORT_OPTIONS.TRENDING) {
      constraints.push(orderBy('reactionCount', 'desc'), orderBy('createdAt', 'desc'));
    } else {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    let baseQuery = query(momentsCollection, ...constraints);
    if (lastDoc) {
      baseQuery = query(baseQuery, startAfter(lastDoc));
    }
    baseQuery = query(baseQuery, limit(limitBy));

    const snapshot = await getDocs(baseQuery);
    lastVisible = snapshot.docs[snapshot.docs.length - 1] ?? null;
    moments = snapshot.docs.map((entry) => ({
      id: entry.id,
      objectID: entry.id,
      ...entry.data()
    }));
  } catch (error) {
    console.error('Error loading moments page:', error);
  }

  return { moments, lastVisible };
};

export const getPublishedMomentReactions = async (momentId) => {
  if (!momentId || !db) {
    return [];
  }

  try {
    const reactionsCollection = createReactionsCollection();
    const queryRef = query(
      reactionsCollection,
      where('momentId', '==', momentId),
      where('isMomentReaction', '==', true),
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map((entry) => ({
      id: entry.id,
      data: entry.data()
    }));
  } catch (error) {
    console.error('Error loading moment reactions:', error);
    return [];
  }
};

export const adjustMomentReactionCount = async (momentId, delta) => {
  const numericDelta = Number(delta);
  if (!momentId || !db || !Number.isFinite(numericDelta) || numericDelta === 0) {
    return;
  }

  try {
    const momentRef = doc(createMomentsCollection(), momentId);
    await updateDoc(momentRef, {
      reactionCount: increment(numericDelta),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to adjust moment reaction count:', error, { momentId, numericDelta });
  }
};


export const incrementMomentReactionCount = async (momentId) => {
  return adjustMomentReactionCount(momentId, 1);
};

export const decrementMomentReactionCount = async (momentId) =>
  adjustMomentReactionCount(momentId, -1);

export const createMomentWithSlug = async (payload) => {
  const { createMomentDocument } = await import('$lib/helpers/firebase');
  const slug = slugifyMomentTitle(payload.title) || `moment-${Date.now()}`;
  const momentId = await createMomentDocument({ ...payload, slug });
  return { momentId, slug };
};

export const startMomentReactionDraft = async ({
  momentId,
  momentOriginalTimeSeconds,
  originalVideoId,
  originalVideoPlatform,
  originalVideoTitle,
  originalVideoAuthor,
  originalVideoAuthorHandle,
  originalVideoAuthorUrl,
  originalVideoDescription,
  originalVideoThumbnailUrl,
  originalVideoThumbnailWidth,
  originalVideoThumbnailHeight,
  originalVideoProviderName,
  originalVideoProviderUrl,
  originalVideoUrl
}) => {
  const userId = auth?.currentUser?.uid;
  if (!userId) {
    throw new Error('Sign in to add a moment reaction.');
  }

  const { createMomentReactionDocument } = await import('$lib/helpers/firebase');
  return createMomentReactionDocument({
    momentId,
    momentOriginalTimeSeconds,
    originalVideoId,
    originalVideoPlatform,
    originalVideoTitle,
    originalVideoAuthor,
    originalVideoAuthorHandle,
    originalVideoAuthorUrl,
    originalVideoDescription,
    originalVideoThumbnailUrl,
    originalVideoThumbnailWidth,
    originalVideoThumbnailHeight,
    originalVideoProviderName,
    originalVideoProviderUrl,
    originalVideoUrl,
    userId,
    offsetStartTime: 0
  });
};

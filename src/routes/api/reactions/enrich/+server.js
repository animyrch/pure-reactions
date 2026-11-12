import { json } from '@sveltejs/kit';
import { COLLECTION_REACTION_BINOMES } from '#lib/constants/firebase.js';
import { initializeFirebaseAdmin } from '#lib/server/firebaseAdmin.js';
import { RATE_LIMITS, enforceRateLimit } from '#lib/server/rateLimit.js';
import { enrichReactionDocument } from '#lib/server/reactionEnrichment.js';

const reactionIdFromBody = (body) => {
  const reactionId = typeof body?.reactionId === 'string' ? body.reactionId.trim() : '';
  if (!reactionId || reactionId.includes('/')) return '';
  return reactionId;
};

export const POST = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { adminAuth, adminDb, adminFieldValue } = await initializeFirebaseAdmin();
    if (!adminAuth || !adminDb || !adminFieldValue) {
      return json({ error: 'Firebase Admin initialization failed' }, { status: 500 });
    }

    let userId;
    try {
      userId = (await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length).trim())).uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return json({ error: 'Invalid token' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request' }, { status: 400 });
    }

    const reactionId = reactionIdFromBody(body);
    if (!reactionId) {
      return json({ error: 'reactionId is required' }, { status: 400 });
    }

    const limited = await enforceRateLimit({
      id: userId,
      ...RATE_LIMITS.reactionEnrich,
    });
    if (limited) return limited;

    const result = await enrichReactionDocument({
      adminDb,
      adminFieldValue,
      collectionName: COLLECTION_REACTION_BINOMES,
      reactionId,
      ownerId: userId,
      force: body?.force === true,
      forceReaction: body?.forceReaction === true,
      forceOriginal: body?.forceOriginal === true
    });

    if (!result.found) {
      return json(result, { status: 404 });
    }

    if (result.reason === 'forbidden') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    return json(result);
  } catch (error) {
    console.error('Failed to enrich reaction metadata', error);
    return json({ error: 'Failed to enrich reaction metadata' }, { status: 500 });
  }
};

import { json } from '@sveltejs/kit';
import { COLLECTION_REACTION_BINOMES } from '$lib/constants/firebase';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';
import { enrichReactionDocument } from '$lib/server/reactionEnrichment';

export const POST = async ({ request }) => {
  try {
    const { reactionId, force } = await request.json();
    if (typeof reactionId !== 'string' || !reactionId.trim()) {
      return json({ error: 'reactionId is required' }, { status: 400 });
    }

    const { adminDb, adminFieldValue } = await initializeFirebaseAdmin();
    if (!adminDb || !adminFieldValue) {
      return json({ error: 'Firebase Admin initialization failed' }, { status: 500 });
    }

    const result = await enrichReactionDocument({
      adminDb,
      adminFieldValue,
      collectionName: COLLECTION_REACTION_BINOMES,
      reactionId: reactionId.trim(),
      force: force === true
    });

    if (!result.found) {
      return json(result, { status: 404 });
    }

    return json(result);
  } catch (error) {
    console.error('Failed to enrich reaction metadata', error);
    return json(
      {
        error: 'Failed to enrich reaction metadata',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
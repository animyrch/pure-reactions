import { json } from '@sveltejs/kit';
import { ALGOLIA_ADMIN_KEY } from '$app/env/private';
import { PUBLIC_ALGOLIA_APP_ID, PUBLIC_ALGOLIA_REACTIONS_INDEX } from '$app/env/public';
import { initializeFirebaseAdmin } from '#lib/server/firebaseAdmin.js';
import { deleteOwnedContent } from '#lib/server/deleteOwnedContent.js';
import { RATE_LIMITS, enforceRateLimit } from '#lib/server/rateLimit.js';
import {
	COLLECTION_MOMENTS,
	COLLECTION_PLAYLISTS,
	COLLECTION_QUEUES,
	COLLECTION_REACTION_BINOMES,
	COLLECTION_USER_DATA
} from '#lib/constants/firebase.js';

const readEnv = (kitValue, name) => {
	const fromKit = typeof kitValue === 'string' ? kitValue.trim() : '';
	if (fromKit) return fromKit;
	const fromProcess = process.env[name];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
};

async function removeDeletedReactionsFromSearch(reactionIds) {
	const ids = (reactionIds || []).filter((id) => typeof id === 'string' && id.trim());
	if (!ids.length) return;

	const appId = readEnv(PUBLIC_ALGOLIA_APP_ID, 'PUBLIC_ALGOLIA_APP_ID');
	const adminKey = readEnv(ALGOLIA_ADMIN_KEY, 'ALGOLIA_ADMIN_KEY');
	const indexName = readEnv(PUBLIC_ALGOLIA_REACTIONS_INDEX, 'PUBLIC_ALGOLIA_REACTIONS_INDEX');
	if (!appId || !adminKey || !indexName) return;

	try {
		const { algoliasearch } = await import('algoliasearch');
		const client = algoliasearch(appId, adminKey);
		await client.deleteObjects({ indexName, objectIDs: ids });
	} catch (error) {
		console.error('Failed to remove deleted reactions from search index:', error);
	}
}

export const POST = async ({ request }) => {
	try {
		const { adminAuth, adminDb } = await initializeFirebaseAdmin();
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const idToken = authHeader.slice(('Bearer ').length).trim();
		if (!adminAuth || !adminDb) {
			console.error('Firebase Admin not initialized');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		let decodedToken;
		try {
			decodedToken = await adminAuth.verifyIdToken(idToken);
		} catch (error) {
			console.error('Token verification failed:', error);
			return json({ error: 'Invalid token' }, { status: 401 });
		}

		let body = {};
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid request' }, { status: 400 });
		}

		const limited = await enforceRateLimit({
			id: decodedToken.uid,
			...RATE_LIMITS.contentDelete,
		});
		if (limited) return limited;

		const result = await deleteOwnedContent({
			adminDb,
			userId: decodedToken.uid,
			kind: body?.kind,
			id: body?.id,
			collections: {
				reactions: COLLECTION_REACTION_BINOMES,
				playlists: COLLECTION_PLAYLISTS,
				queues: COLLECTION_QUEUES,
				moments: COLLECTION_MOMENTS,
				userData: COLLECTION_USER_DATA
			},
			onDeleted: removeDeletedReactionsFromSearch
		});

		if (!result.ok) {
			return json({ error: result.error }, { status: result.status });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting content:', error);
		return json({ error: 'Could not delete this.' }, { status: 500 });
	}
};

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';
import { deleteAccountData } from '$lib/server/deleteAccountData';

const RECENT_AUTH_THRESHOLD_SECONDS = 5 * 60;

const readEnv = (name) => {
	const fromPrivate = env?.[name];
	if (typeof fromPrivate === 'string' && fromPrivate.trim()) return fromPrivate.trim();
	const fromProcess = process.env[name];
	return typeof fromProcess === 'string' ? fromProcess.trim() : '';
};

async function deleteSearchRecords(reactionIds) {
	const ids = (reactionIds || []).filter((id) => typeof id === 'string' && id.trim());
	if (!ids.length) return;

	const appId = readEnv('PUBLIC_ALGOLIA_APP_ID');
	const adminKey = readEnv('ALGOLIA_ADMIN_KEY');
	const indexName = readEnv('PUBLIC_ALGOLIA_REACTIONS_INDEX');
	if (!appId || !adminKey || !indexName) return;

	try {
		const { default: algoliasearch } = await import('algoliasearch');
		const index = algoliasearch(appId, adminKey).initIndex(indexName);
		for (let start = 0; start < ids.length; start += 1000) {
			await index.deleteObjects(ids.slice(start, start + 1000));
		}
	} catch (error) {
		console.error('Failed to remove deleted reactions from search index:', error);
	}
}

export const POST = async ({ request }) => {
	try {
		// Initialize Firebase Admin (lazy)
		const { adminAuth, adminDb } = await initializeFirebaseAdmin();

		// Get the Firebase ID token from the Authorization header
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const idToken = authHeader.split('Bearer ')[1];

		if (!adminAuth || !adminDb) {
			console.error('Firebase Admin not initialized');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		// Verify the token and get user ID from auth context
		let decodedToken;
		try {
			decodedToken = await adminAuth.verifyIdToken(idToken);
		} catch (error) {
			console.error('Token verification failed:', error);
			return json({ error: 'Invalid token' }, { status: 401 });
		}

		const nowSeconds = Math.floor(Date.now() / 1000);
		const authTimeSeconds = decodedToken.auth_time || 0;
		if (nowSeconds - authTimeSeconds > RECENT_AUTH_THRESHOLD_SECONDS) {
			return json(
				{ error: 'Recent sign-in required. Please reauthenticate and try again.' },
				{ status: 401 }
			);
		}

		const userId = decodedToken.uid;

		try {
			const {
				COLLECTION_REACTION_BINOMES,
				COLLECTION_USER_DATA,
				COLLECTION_PLAYLISTS,
				COLLECTION_QUEUES,
				COLLECTION_MOMENTS,
				COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
				COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS
			} = await import('$lib/constants/firebase');
			const { deleted, reactionIds } = await deleteAccountData({
				adminDb,
				userId,
				collections: {
					reactions: COLLECTION_REACTION_BINOMES,
					userData: COLLECTION_USER_DATA,
					playlists: COLLECTION_PLAYLISTS,
					queues: COLLECTION_QUEUES,
					moments: COLLECTION_MOMENTS,
					claims: COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
					verifications: COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS
				}
			});
			await deleteSearchRecords(reactionIds);
			console.log(`Deleted ${deleted} documents for user ${userId}`);

			// Revoke all refresh tokens (invalidate all sessions)
			await adminAuth.revokeRefreshTokens(userId);

			// Delete the user's authentication record
			await adminAuth.deleteUser(userId);

			return json(
				{
					success: true,
					message: 'Your account has been permanently deleted.'
				},
				{ status: 200 }
			);
		} catch (deletionError) {
			console.error('Error during account deletion:', deletionError);
			return json(
				{ error: 'Failed to complete account deletion. Please try again or contact support.' },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Error deleting account:', error);
		return json({ error: 'Failed to process account deletion' }, { status: 500 });
	}
};

import { json } from '@sveltejs/kit';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';

const RECENT_AUTH_THRESHOLD_SECONDS = 5 * 60;

async function deleteUserData(userId, adminDb) {
	const {
		COLLECTION_REACTION_BINOMES,
		COLLECTION_USER_DATA,
		COLLECTION_PLAYLISTS,
		COLLECTION_QUEUES,
		COLLECTION_MOMENTS
	} = await import('$lib/constants/firebase');
	if (!adminDb) {
		throw new Error('Firestore not initialized');
	}

	const batch = adminDb.batch();
	let deletionCount = 0;
	const impactedMomentIds = new Set();

	// Delete user profile document
	const userDocRef = adminDb.collection(COLLECTION_USER_DATA).doc(userId);
	batch.delete(userDocRef);
	deletionCount++;

	// Delete all reactions created by the user
	const reactionsSnapshot = await adminDb
		.collection(COLLECTION_REACTION_BINOMES)
		.where('reactorId', '==', userId)
		.get();

	reactionsSnapshot.docs.forEach(doc => {
		const reactionData = doc.data() || {};
		if (
			reactionData.isMomentReaction === true &&
			reactionData.isPublished === true &&
			typeof reactionData.momentId === 'string' &&
			reactionData.momentId.trim()
		) {
			impactedMomentIds.add(reactionData.momentId.trim());
		}

		batch.delete(doc.ref);
		deletionCount++;
	});

	// Delete bookmarks (stored in user's extra data)
	const bookmarksRef = adminDb.collection('userExtraData').doc(userId);
	const bookmarksDoc = await bookmarksRef.get();
	if (bookmarksDoc.exists) {
		batch.delete(bookmarksRef);
		deletionCount++;
	}

	// Delete follows (stored in user's extra data follows subcollection or as a field)
	const followsSnapshot = await adminDb
		.collection('userExtraData')
		.doc(userId)
		.collection('follows')
		.get();

	followsSnapshot.docs.forEach(doc => {
		batch.delete(doc.ref);
		deletionCount++;
	});

	// Delete playlists created by the user
	const playlistsSnapshot = await adminDb
		.collection(COLLECTION_PLAYLISTS)
		.where('reactorId', '==', userId)
		.get();

	playlistsSnapshot.docs.forEach(doc => {
		batch.delete(doc.ref);
		deletionCount++;
	});

	// Delete queues created by the user
	const queuesSnapshot = await adminDb
		.collection(COLLECTION_QUEUES)
		.where('reactorId', '==', userId)
		.get();

	queuesSnapshot.docs.forEach(doc => {
		batch.delete(doc.ref);
		deletionCount++;
	});

	// Commit all deletions
	await batch.commit();

	if (impactedMomentIds.size > 0) {
		await Promise.all(
			Array.from(impactedMomentIds).map(async (momentId) => {
				try {
					const remainingPublishedMomentReactions = await adminDb
						.collection(COLLECTION_REACTION_BINOMES)
						.where('momentId', '==', momentId)
						.where('isMomentReaction', '==', true)
						.where('isPublished', '==', true)
						.get();

					await adminDb
						.collection(COLLECTION_MOMENTS)
						.doc(momentId)
						.update({ reactionCount: remainingPublishedMomentReactions.size });
				} catch (error) {
					console.error('Failed to recount moment reaction count during account deletion:', error, {
						momentId
					});
				}
			})
		);
	}

	return deletionCount;
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
			// Delete all user data from Firestore
			const deletionCount = await deleteUserData(userId, adminDb);
			console.log(`Deleted ${deletionCount} documents for user ${userId}`);

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

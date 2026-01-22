import { json } from '@sveltejs/kit';

// Lazy import Firebase Admin to avoid SSR/build issues
let adminAuth = null;
let adminDb = null;
let adminInitialized = false;

async function initializeFirebaseAdmin() {
	if (adminInitialized) {
		return { adminAuth, adminDb };
	}

	try {
		const { getAuth } = await import('firebase-admin/auth');
		const { getFirestore } = await import('firebase-admin/firestore');
		const { initializeApp, getApps, cert } = await import('firebase-admin');
		const { FIREBASE_CONFIG } = await import('$lib/constants/firebase');

		let adminApp;
		if (!getApps().length) {
			// In production (Netlify), service account is provided via environment
			if (process.env.FIREBASE_SERVICE_ACCOUNT) {
				const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
				adminApp = initializeApp({
					credential: cert(serviceAccount),
					projectId: FIREBASE_CONFIG.projectId
				});
			} else {
				// For local development with emulator or GOOGLE_APPLICATION_CREDENTIALS
				adminApp = initializeApp({
					projectId: FIREBASE_CONFIG.projectId
				});
			}
		} else {
			adminApp = getApps()[0];
		}

		adminAuth = getAuth(adminApp);
		adminDb = getFirestore(adminApp);
		adminInitialized = true;
	} catch (error) {
		console.error('Failed to initialize Firebase Admin:', error);
	}

	return { adminAuth, adminDb };
}

async function deleteUserData(userId, adminDb) {
	const { COLLECTION_REACTION_BINOMES, COLLECTION_USER_DATA } = await import('$lib/constants/firebase');
	const { env } = await import('$env/dynamic/public');
	if (!adminDb) {
		throw new Error('Firestore not initialized');
	}

	const batch = adminDb.batch();
	let deletionCount = 0;

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
		.collection(env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS || 'playlists')
		.where('reactorId', '==', userId)
		.get();

	playlistsSnapshot.docs.forEach(doc => {
		batch.delete(doc.ref);
		deletionCount++;
	});

	// Delete queues created by the user
	const queuesSnapshot = await adminDb
		.collection(env.PUBLIC_FIREBASE_COLLECTION_QUEUES || 'queues')
		.where('reactorId', '==', userId)
		.get();

	queuesSnapshot.docs.forEach(doc => {
		batch.delete(doc.ref);
		deletionCount++;
	});

	// Commit all deletions
	await batch.commit();

	return deletionCount;
}

export const POST = async ({ request }) => {
	try {
		// Initialize Firebase Admin (lazy)
		const { adminAuth, adminDb } = await initializeFirebaseAdmin();

		const { token } = await request.json();

		if (!token) {
			return json({ error: 'Token is required' }, { status: 400 });
		}

		if (!adminAuth || !adminDb) {
			console.error('Firebase Admin not initialized');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		// Validate the token
		const tokenDoc = await adminDb.collection('deletionTokens').doc(token).get();

		if (!tokenDoc.exists) {
			return json({ error: 'Invalid or expired token' }, { status: 400 });
		}

		const tokenData = tokenDoc.data();

		// Check if token has been used
		if (tokenData.used) {
			return json({ error: 'This confirmation link has already been used' }, { status: 400 });
		}

		// Check if token has expired
		if (Date.now() > tokenData.expiresAt) {
			return json({ error: 'This confirmation link has expired' }, { status: 400 });
		}

		const userId = tokenData.userId;

		// Mark token as used (before deletion to prevent re-use)
		await adminDb.collection('deletionTokens').doc(token).update({
			used: true,
			usedAt: Date.now()
		});

		try {
			// Delete all user data from Firestore
			const deletionCount = await deleteUserData(userId, adminDb);
			console.log(`Deleted ${deletionCount} documents for user ${userId}`);

			// Revoke all refresh tokens (invalidate all sessions)
			await adminAuth.revokeRefreshTokens(userId);

			// Delete the user's authentication record
			await adminAuth.deleteUser(userId);

			// Clean up the deletion token
			await adminDb.collection('deletionTokens').doc(token).delete();

			return json({ 
				success: true,
				message: 'Your account has been permanently deleted.'
			}, { status: 200 });

		} catch (deletionError) {
			console.error('Error during account deletion:', deletionError);
			
			// If deletion fails, we should not mark the token as used
			// But we already did, so log this critical error
			console.error('CRITICAL: Token marked as used but deletion failed for user:', userId);
			
			return json({ 
				error: 'Failed to complete account deletion. Please contact support.' 
			}, { status: 500 });
		}

	} catch (error) {
		console.error('Error confirming account deletion:', error);
		return json({ 
			error: 'Failed to process deletion confirmation' 
		}, { status: 500 });
	}
};

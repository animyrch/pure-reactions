import { json } from '@sveltejs/kit';
import {
	EXPORT_VERSION,
	chunkArray,
	serializeFirestoreDoc,
	sortById,
	sortByObjectId
} from '$lib/helpers/dataExport';
import {
	COLLECTION_REACTION_BINOMES,
	COLLECTION_USER_DATA,
	COLLECTION_PLAYLISTS,
	COLLECTION_QUEUES,
	COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
	COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS
} from '$lib/constants/firebase';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';

const EXPORT_RATE_LIMIT_SECONDS = 60 * 60 * 24;
const ALGOLIA_BATCH_LIMIT = 1000;

function buildAuthProfile(userRecord) {
	if (!userRecord) return null;
	return {
		uid: userRecord.uid,
		email: userRecord.email ?? null,
		emailVerified: Boolean(userRecord.emailVerified),
		displayName: userRecord.displayName ?? null,
		photoURL: userRecord.photoURL ?? null,
		phoneNumber: userRecord.phoneNumber ?? null,
		disabled: Boolean(userRecord.disabled),
		providerData: (userRecord.providerData || []).map((provider) => ({
			providerId: provider.providerId,
			uid: provider.uid,
			displayName: provider.displayName ?? null,
			email: provider.email ?? null,
			phoneNumber: provider.phoneNumber ?? null,
			photoURL: provider.photoURL ?? null
		})),
		customClaims: userRecord.customClaims || {},
		metadata: {
			creationTime: userRecord.metadata?.creationTime ?? null,
			lastSignInTime: userRecord.metadata?.lastSignInTime ?? null,
			lastRefreshTime: userRecord.metadata?.lastRefreshTime ?? null
		}
	};
}

function buildRateLimitPayload({ lastExportAtMs, nowMs }) {
	const retryAfterSeconds = Math.ceil((EXPORT_RATE_LIMIT_SECONDS * 1000 - (nowMs - lastExportAtMs)) / 1000);
	const nextAllowedAt = new Date(lastExportAtMs + EXPORT_RATE_LIMIT_SECONDS * 1000).toISOString();
	return { retryAfterSeconds, nextAllowedAt };
}

async function fetchCollectionByField(adminDbInstance, collectionName, field, value) {
	if (!collectionName) {
		return [];
	}
	const snapshot = await adminDbInstance.collection(collectionName).where(field, '==', value).get();
	return snapshot.docs.map(serializeFirestoreDoc).sort(sortById);
}

async function fetchUserDataDoc(adminDbInstance, userId) {
	if (!COLLECTION_USER_DATA) {
		return null;
	}
	const userDocRef = adminDbInstance.collection(COLLECTION_USER_DATA).doc(userId);
	const userDocSnapshot = await userDocRef.get();
	if (!userDocSnapshot.exists) {
		return null;
	}
	return serializeFirestoreDoc(userDocSnapshot);
}

async function fetchYoutubeChannelVerifications(adminDbInstance, claims) {
	if (!COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS) {
		return [];
	}
	const channelIds = new Set();
	claims.forEach((claim) => {
		const channelId = claim?.data?.youtubeChannelId;
		if (channelId) {
			channelIds.add(channelId);
		}
	});

	const verificationDocs = [];
	for (const channelId of channelIds) {
		const snapshot = await adminDbInstance
			.collection(COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS)
			.doc(channelId)
			.get();
		if (snapshot.exists) {
			verificationDocs.push(serializeFirestoreDoc(snapshot));
		}
	}

	return verificationDocs.sort(sortById);
}

async function fetchAlgoliaRecords(reactionIds) {
	const appId = process.env.PUBLIC_ALGOLIA_APP_ID;
	const searchKey = process.env.PUBLIC_ALGOLIA_SEARCH_API_KEY;
	const indexName = process.env.PUBLIC_ALGOLIA_REACTIONS_INDEX;

	if (!reactionIds.length) {
		return { indexName, records: [], missingObjectIDs: [] };
	}

	if (!appId || !searchKey || !indexName) {
		return {
			indexName,
			records: [],
			missingObjectIDs: [...reactionIds],
			error: 'Algolia configuration is missing.'
		};
	}

	try {
		const { default: algoliasearch } = await import('algoliasearch');
		const client = algoliasearch(appId, searchKey);
		const index = client.initIndex(indexName);

		const records = [];
		const missingObjectIDs = [];
		const chunks = chunkArray(reactionIds, ALGOLIA_BATCH_LIMIT);

		for (const chunk of chunks) {
			const response = await index.getObjects(chunk);
			response.results.forEach((result, indexOffset) => {
				if (result) {
					records.push(result);
				} else {
					missingObjectIDs.push(chunk[indexOffset]);
				}
			});
		}

		return {
			indexName,
			records: records.sort(sortByObjectId),
			missingObjectIDs: missingObjectIDs.sort()
		};
	} catch (error) {
		return {
			indexName,
			records: [],
			missingObjectIDs: [...reactionIds],
			error: `Algolia request failed: ${error?.message || 'Unknown error'}`
		};
	}
}

export const POST = async ({ request }) => {
	try {
		const { adminAuth, adminDb, adminFieldValue } = await initializeFirebaseAdmin();

		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const idToken = authHeader.split('Bearer ')[1];

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

		const userId = decodedToken.uid;

		const userDataDoc = await fetchUserDataDoc(adminDb, userId);
		const lastExportAtMs = userDataDoc?.data?.lastExportAt
			? new Date(userDataDoc.data.lastExportAt).getTime()
			: null;
		const nowMs = Date.now();

		if (lastExportAtMs && nowMs - lastExportAtMs < EXPORT_RATE_LIMIT_SECONDS * 1000) {
			const { retryAfterSeconds, nextAllowedAt } = buildRateLimitPayload({
				lastExportAtMs,
				nowMs
			});
			return json(
				{
					error: 'Export recently requested. Please wait before requesting another export.',
					retryAfterSeconds,
					nextAllowedAt
				},
				{
					status: 429,
					headers: {
						'Retry-After': String(retryAfterSeconds)
					}
				}
			);
		}

		let authProfile = null;
		const metaNotes = [];
		try {
			const userRecord = await adminAuth.getUser(userId);
			authProfile = buildAuthProfile(userRecord);
		} catch (error) {
			console.error('Failed to load auth profile:', error);
			metaNotes.push('Auth profile unavailable for this export.');
		}

		const reactions = await fetchCollectionByField(adminDb, COLLECTION_REACTION_BINOMES, 'reactorId', userId);
		const playlists = await fetchCollectionByField(adminDb, COLLECTION_PLAYLISTS, 'userId', userId);
		const queues = await fetchCollectionByField(adminDb, COLLECTION_QUEUES, 'ownerId', userId);
		const youtubeChannelClaims = await fetchCollectionByField(
			adminDb,
			COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
			'userId',
			userId
		);
		const youtubeChannelVerifications = await fetchYoutubeChannelVerifications(adminDb, youtubeChannelClaims);

		const reactionIds = reactions.map((reaction) => reaction.id);
		const algoliaResult = await fetchAlgoliaRecords(reactionIds);
		if (algoliaResult.error) {
			metaNotes.push(algoliaResult.error);
		}
		const algoliaAvailable = Boolean(algoliaResult.indexName && !algoliaResult.error);

		const generatedAt = new Date().toISOString();
		const safeUserId = userId.slice(0, 8);
		const dateStamp = generatedAt.slice(0, 10);
		const fileName = `pure-reactions-export-${safeUserId}-${dateStamp}.json`;

		const exportPayload = {
			meta: {
				exportVersion: EXPORT_VERSION,
				generatedAt,
				userId,
				sources: {
					auth: Boolean(authProfile),
					firestore: true,
					algolia: algoliaAvailable
				},
				counts: {
					auth: authProfile ? 1 : 0,
					firestore: {
						userData: userDataDoc ? 1 : 0,
						reactions: reactions.length,
						playlists: playlists.length,
						queues: queues.length,
						youtubeChannelClaims: youtubeChannelClaims.length,
						youtubeChannelVerifications: youtubeChannelVerifications.length
					},
					algolia: {
						reactions: algoliaResult.records.length
					}
				},
				excluded: [
					'Infrastructure-level transient logs (Netlify, CDN, Firebase system logs).',
					'Transient real-time shared session state (sharedSessions in Firebase Realtime Database).',
					'Third-party service logs or analytics (YouTube, Algolia analytics).',
					'Data that has been deleted or expired.'
				],
				notes: metaNotes
			},
			data: {
				auth: authProfile,
				firestore: {
					userData: userDataDoc,
					reactions,
					playlists,
					queues,
					youtubeChannelClaims,
					youtubeChannelVerifications
				},
				algolia: {
					indexName: algoliaResult.indexName,
					reactions: algoliaResult.records,
					missingObjectIDs: algoliaResult.missingObjectIDs
				}
			}
		};

		if (COLLECTION_USER_DATA && adminFieldValue) {
			try {
				await adminDb
					.collection(COLLECTION_USER_DATA)
					.doc(userId)
					.set({ lastExportAt: adminFieldValue.serverTimestamp() }, { merge: true });
			} catch (error) {
				console.error('Failed to update export timestamp:', error);
			}
		}

		return json(
			{
				export: exportPayload,
				fileName,
				generatedAt
			},
			{
				status: 200,
				headers: {
					'Cache-Control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('Error generating export:', error);
		return json({ error: 'Failed to generate export' }, { status: 500 });
	}
};

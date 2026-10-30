const DELETED_CREATOR_ID = 'deleted';
const BATCH_LIMIT = 400;

async function matchingDocs(adminDb, collectionName, filters) {
	let query = adminDb.collection(collectionName);
	for (const [field, value] of filters) {
		query = query.where(field, '==', value);
	}
	const snapshot = await query.get();
	return snapshot.docs || [];
}

async function commitDeletes(adminDb, refs) {
	let deleted = 0;
	for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
		const batch = adminDb.batch();
		for (const ref of refs.slice(start, start + BATCH_LIMIT)) {
			batch.delete(ref);
			deleted += 1;
		}
		await batch.commit();
	}
	return deleted;
}

function remember(refsByPath, ref) {
	if (ref?.path) refsByPath.set(ref.path, ref);
}

export async function deleteAccountData({ adminDb, userId, collections }) {
	if (!adminDb) throw new Error('Firestore not initialized');
	if (!userId) throw new Error('Missing user id');

	const reactionsCollection = collections.reactions;
	const playlistsCollection = collections.playlists;
	const queuesCollection = collections.queues;
	const momentsCollection = collections.moments;
	const claimsCollection = collections.claims;
	const verificationsCollection = collections.verifications;
	const userDataCollection = collections.userData;

	const refsByPath = new Map();
	const reactionIds = [];
	const impactedMomentIds = new Set();

	remember(refsByPath, adminDb.collection(userDataCollection).doc(userId));

	const reactions = await matchingDocs(adminDb, reactionsCollection, [['reactorId', userId]]);
	for (const reaction of reactions) {
		const data = reaction.data() || {};
		reactionIds.push(reaction.id);
		if (
			data.isMomentReaction === true &&
			data.isPublished === true &&
			typeof data.momentId === 'string' &&
			data.momentId.trim()
		) {
			impactedMomentIds.add(data.momentId.trim());
		}
		remember(refsByPath, reaction.ref);
	}

	const extraRef = adminDb.collection('userExtraData').doc(userId);
	const extraDoc = await extraRef.get();
	if (extraDoc.exists) remember(refsByPath, extraRef);

	const follows = await adminDb.collection('userExtraData').doc(userId).collection('follows').get();
	for (const follow of follows.docs || []) remember(refsByPath, follow.ref);

	for (const field of ['reactorId', 'userId']) {
		const playlists = await matchingDocs(adminDb, playlistsCollection, [[field, userId]]);
		for (const playlist of playlists) remember(refsByPath, playlist.ref);
	}

	for (const field of ['reactorId', 'ownerId']) {
		const queues = await matchingDocs(adminDb, queuesCollection, [[field, userId]]);
		for (const queue of queues) remember(refsByPath, queue.ref);
	}

	const claims = await matchingDocs(adminDb, claimsCollection, [['userId', userId]]);
	const channelIds = new Set();
	for (const claim of claims) {
		const channelId = claim.data()?.youtubeChannelId;
		if (typeof channelId === 'string' && channelId.trim()) channelIds.add(channelId.trim());
		remember(refsByPath, claim.ref);
	}

	const createdMoments = await matchingDocs(adminDb, momentsCollection, [['creatorId', userId]]);
	const createdMomentIds = new Set(createdMoments.map((moment) => moment.id));

	const deleted = await commitDeletes(adminDb, [...refsByPath.values()]);

	for (const momentId of new Set([...impactedMomentIds, ...createdMomentIds])) {
		const remaining = await matchingDocs(adminDb, reactionsCollection, [
			['momentId', momentId],
			['isMomentReaction', true],
			['isPublished', true]
		]);
		const momentRef = adminDb.collection(momentsCollection).doc(momentId);
		if (createdMomentIds.has(momentId) && remaining.length === 0) {
			await momentRef.delete();
			continue;
		}
		const patch = { reactionCount: remaining.length };
		if (createdMomentIds.has(momentId)) {
			patch.creatorId = DELETED_CREATOR_ID;
			patch.creatorDisplayName = '';
		}
		try {
			await momentRef.update(patch);
		} catch (error) {
			console.error('Failed to update moment during account deletion:', error, { momentId });
		}
	}

	for (const channelId of channelIds) {
		const remainingClaims = await matchingDocs(adminDb, claimsCollection, [
			['youtubeChannelId', channelId]
		]);
		if (remainingClaims.length === 0) {
			await adminDb.collection(verificationsCollection).doc(channelId).delete();
		}
	}

	return { deleted, reactionIds };
}

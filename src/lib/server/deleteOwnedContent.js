const DEFAULT_BATCH_LIMIT = 450;

const OWNED_CONTENT_KINDS = new Set(['reaction', 'playlist', 'queue']);

const itemKind = (kind) => {
	if (kind === 'playlist') return 'playlist';
	if (kind === 'queue') return 'queue';
	return 'reaction';
};

const cleanId = (value) => (typeof value === 'string' ? value.trim() : '');

const publishedMomentId = (data) => {
	if (data?.isMomentReaction !== true || data?.isPublished !== true) {
		return '';
	}
	return cleanId(data.momentId);
};

const uniqueIds = (values) => {
	const ids = [];
	const seen = new Set();
	for (const value of values) {
		const id = cleanId(value);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	return ids;
};

async function commitOps(adminDb, ops, batchLimit) {
	for (let index = 0; index < ops.length; index += batchLimit) {
		const batch = adminDb.batch();
		for (const op of ops.slice(index, index + batchLimit)) {
			if (op.type === 'delete') {
				batch.delete(op.ref);
			} else {
				batch.update(op.ref, op.patch);
			}
		}
		await batch.commit();
	}
}

async function recountMoments(adminDb, reactionsCollection, momentsCollection, momentIds) {
	for (const momentId of momentIds) {
		try {
			const remaining = await adminDb
				.collection(reactionsCollection)
				.where('momentId', '==', momentId)
				.where('isMomentReaction', '==', true)
				.where('isPublished', '==', true)
				.get();
			await adminDb.collection(momentsCollection).doc(momentId).update({
				reactionCount: remaining.size
			});
		} catch (error) {
			console.error('Failed to recount moment reaction count after delete:', error, { momentId });
		}
	}
}

function queueItemsWithoutDeleted(items, reactionIds, playlistIds) {
	if (!Array.isArray(items)) return { items, changed: false };
	const nextItems = items.filter((item) => {
		if (item?.type === 'reaction' && reactionIds.has(item.id)) return false;
		if (item?.type === 'playlist' && playlistIds.has(item.id)) return false;
		return true;
	});
	return { items: nextItems, changed: nextItems.length !== items.length };
}

async function queueCleanupOps(adminDb, queuesCollection, userId, reactionIds, playlistIds) {
	if (!reactionIds.size && !playlistIds.size) return [];
	const snapshot = await adminDb.collection(queuesCollection).where('ownerId', '==', userId).get();
	const ops = [];
	for (const queueDoc of snapshot.docs) {
		const data = queueDoc.data() || {};
		if (data.ownerId !== userId) continue;
		const next = queueItemsWithoutDeleted(data.items, reactionIds, playlistIds);
		if (!next.changed) continue;
		ops.push({
			type: 'update',
			ref: queueDoc.ref,
			patch: {
				items: next.items,
				updatedAt: new Date()
			}
		});
	}
	return ops;
}

async function bookmarkCleanupOp(adminDb, userDataCollection, userId, ids) {
	if (!ids.size) return [];
	const ref = adminDb.collection(userDataCollection).doc(userId);
	const snapshot = await ref.get();
	if (!snapshot.exists) return [];
	const bookmarks = snapshot.data()?.bookmarks;
	if (!Array.isArray(bookmarks)) return [];
	const nextBookmarks = bookmarks.filter((bookmarkId) => !ids.has(bookmarkId));
	if (nextBookmarks.length === bookmarks.length) return [];
	return [
		{
			type: 'update',
			ref,
			patch: { bookmarks: nextBookmarks }
		}
	];
}

async function ownedReactionRef(adminDb, reactionsCollection, reactionId, userId, momentIds) {
	const ref = adminDb.collection(reactionsCollection).doc(reactionId);
	const snapshot = await ref.get();
	if (!snapshot.exists) return null;
	const data = snapshot.data() || {};
	if (data.reactorId !== userId) return null;
	const momentId = publishedMomentId(data);
	if (momentId) momentIds.add(momentId);
	return ref;
}

async function reactionIdsForPlaylist(adminDb, reactionsCollection, playlistId, listedIds) {
	const ids = new Set(listedIds);
	const linked = await adminDb.collection(reactionsCollection).where('playlistId', '==', playlistId).get();
	for (const reactionDoc of linked.docs) {
		if (reactionDoc.id) ids.add(reactionDoc.id);
	}
	return [...ids];
}

async function clearReactionFromPlaylistOp(adminDb, playlistsCollection, userId, playlistId, reactionId) {
	const playlistKey = cleanId(playlistId);
	if (!playlistKey) return [];
	const ref = adminDb.collection(playlistsCollection).doc(playlistKey);
	const snapshot = await ref.get();
	if (!snapshot.exists) return [];
	const data = snapshot.data() || {};
	if (data.userId !== userId || !Array.isArray(data.reactionBinomeIds)) return [];
	if (!data.reactionBinomeIds.includes(reactionId)) return [];
	return [
		{
			type: 'update',
			ref,
			patch: {
				reactionBinomeIds: data.reactionBinomeIds.map((entry) => (entry === reactionId ? '' : entry))
			}
		}
	];
}

/**
 * Delete one reaction, playlist, or queue owned by userId.
 * A playlist delete also deletes the owner's reactions in that playlist.
 * A queue delete removes the queue document only; items stay as their own docs.
 * Returns { ok: true, deletedReactionIds } or { ok: false, status, error }.
 */
export async function deleteOwnedContent({
	adminDb,
	userId,
	kind,
	id,
	collections,
	batchLimit = DEFAULT_BATCH_LIMIT,
	onDeleted
}) {
	const contentId = cleanId(id);
	const contentKind = itemKind(kind);
	if (!OWNED_CONTENT_KINDS.has(kind) || !contentId || contentId.includes('/')) {
		return { ok: false, status: 400, error: 'Invalid request' };
	}
	if (!userId || !adminDb) {
		return { ok: false, status: 500, error: 'Could not delete this.' };
	}

	const reactionsCollection = collections.reactions;
	const playlistsCollection = collections.playlists;
	const queuesCollection = collections.queues;
	const momentsCollection = collections.moments;
	const userDataCollection = collections.userData;
	const momentIds = new Set();
	const deletedReactionIds = [];
	const ops = [];

	if (contentKind === 'queue') {
		const queueRef = adminDb.collection(queuesCollection).doc(contentId);
		const queueSnapshot = await queueRef.get();
		if (!queueSnapshot.exists) {
			return { ok: false, status: 404, error: 'Queue not found.' };
		}
		const queueData = queueSnapshot.data() || {};
		if (queueData.ownerId !== userId) {
			return { ok: false, status: 403, error: 'You can only delete your own queues.' };
		}
		ops.push({ type: 'delete', ref: queueRef });
	} else if (contentKind === 'playlist') {
		const playlistRef = adminDb.collection(playlistsCollection).doc(contentId);
		const playlistSnapshot = await playlistRef.get();
		if (!playlistSnapshot.exists) {
			return { ok: false, status: 404, error: 'Playlist not found.' };
		}
		const playlistData = playlistSnapshot.data() || {};
		if (playlistData.userId !== userId) {
			return { ok: false, status: 403, error: 'You can only delete your own playlists.' };
		}

		const listedIds = uniqueIds(playlistData.reactionBinomeIds);
		const reactionIds = await reactionIdsForPlaylist(
			adminDb,
			reactionsCollection,
			contentId,
			listedIds
		);
		for (const reactionId of reactionIds) {
			const reactionRef = await ownedReactionRef(
				adminDb,
				reactionsCollection,
				reactionId,
				userId,
				momentIds
			);
			if (!reactionRef) continue;
			deletedReactionIds.push(reactionId);
			ops.push({ type: 'delete', ref: reactionRef });
		}
		ops.push({ type: 'delete', ref: playlistRef });
	} else {
		const reactionRef = adminDb.collection(reactionsCollection).doc(contentId);
		const reactionSnapshot = await reactionRef.get();
		if (!reactionSnapshot.exists) {
			return { ok: false, status: 404, error: 'Reaction not found.' };
		}
		const reactionData = reactionSnapshot.data() || {};
		if (reactionData.reactorId !== userId) {
			return { ok: false, status: 403, error: 'You can only delete your own reactions.' };
		}
		const momentId = publishedMomentId(reactionData);
		if (momentId) momentIds.add(momentId);
		deletedReactionIds.push(contentId);
		ops.push({ type: 'delete', ref: reactionRef });
		ops.push(
			...(await clearReactionFromPlaylistOp(
				adminDb,
				playlistsCollection,
				userId,
				reactionData.playlistId,
				contentId
			))
		);
	}

	const reactionIdSet = new Set(deletedReactionIds);
	const playlistIdSet = contentKind === 'playlist' ? new Set([contentId]) : new Set();
	const removedIds = new Set([...reactionIdSet, ...playlistIdSet]);
	ops.push(...(await queueCleanupOps(adminDb, queuesCollection, userId, reactionIdSet, playlistIdSet)));
	ops.push(...(await bookmarkCleanupOp(adminDb, userDataCollection, userId, removedIds)));

	await commitOps(adminDb, ops, batchLimit);
	await recountMoments(adminDb, reactionsCollection, momentsCollection, momentIds);

	try {
		await onDeleted?.(deletedReactionIds);
	} catch (error) {
		console.error('Failed to finish delete side effects:', error);
	}

	return { ok: true, deletedReactionIds };
}

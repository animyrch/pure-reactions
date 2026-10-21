import { describe, expect, it } from 'vitest';
import { deleteOwnedContent } from '$lib/server/deleteOwnedContent';

const collections = {
	reactions: 'reactions',
	playlists: 'playlists',
	queues: 'queues',
	moments: 'moments',
	userData: 'userData'
};

function createMemoryDb() {
	const docs = new Map();
	let commits = 0;

	const refFor = (collectionName, id) => {
		const path = `${collectionName}/${id}`;
		return {
			path,
			id,
			async get() {
				if (!docs.has(path)) {
					return { exists: false, id, data: () => undefined };
				}
				return { exists: true, id, data: () => structuredClone(docs.get(path)) };
			},
			async update(patch) {
				if (!docs.has(path)) {
					throw new Error(`No document to update: ${path}`);
				}
				docs.set(path, { ...docs.get(path), ...structuredClone(patch) });
			}
		};
	};

	const queryFor = (collectionName, filters) => ({
		where(field, _op, value) {
			return queryFor(collectionName, [...filters, [field, value]]);
		},
		async get() {
			const prefix = `${collectionName}/`;
			const found = [];
			for (const [path, data] of docs) {
				if (!path.startsWith(prefix)) continue;
				const id = path.slice(prefix.length);
				if (id.includes('/')) continue;
				if (!filters.every(([field, value]) => data[field] === value)) continue;
				found.push({
					id,
					ref: refFor(collectionName, id),
					data: () => structuredClone(data)
				});
			}
			return { docs: found, size: found.length, empty: found.length === 0 };
		}
	});

	return {
		get commits() {
			return commits;
		},
		collection(name) {
			return {
				doc: (id) => refFor(name, id),
				where: (field, _op, value) => queryFor(name, [[field, value]])
			};
		},
		batch() {
			const ops = [];
			return {
				delete(ref) {
					ops.push({ type: 'delete', ref });
				},
				update(ref, patch) {
					ops.push({ type: 'update', ref, patch });
				},
				async commit() {
					commits += 1;
					for (const op of ops) {
						if (op.type === 'delete') {
							docs.delete(op.ref.path);
						} else {
							docs.set(op.ref.path, { ...docs.get(op.ref.path), ...structuredClone(op.patch) });
						}
					}
				}
			};
		},
		seed(collectionName, id, data) {
			docs.set(`${collectionName}/${id}`, structuredClone(data));
		},
		read(collectionName, id) {
			return docs.get(`${collectionName}/${id}`);
		}
	};
}

const ownerId = 'owner-1';
const otherId = 'owner-2';

describe('deleteOwnedContent', () => {
	it('rejects a missing reaction and someone else\'s reaction', async () => {
		const db = createMemoryDb();
		db.seed('reactions', 'theirs', { reactorId: otherId, playlistId: '' });

		const missing = await deleteOwnedContent({
			adminDb: db,
			userId: ownerId,
			kind: 'reaction',
			id: 'missing',
			collections
		});
		expect(missing).toMatchObject({ ok: false, status: 404 });

		const forbidden = await deleteOwnedContent({
			adminDb: db,
			userId: ownerId,
			kind: 'reaction',
			id: 'theirs',
			collections
		});
		expect(forbidden).toMatchObject({ ok: false, status: 403 });
		expect(db.read('reactions', 'theirs')?.reactorId).toBe(otherId);
	});

	it('deletes an owned reaction, clears it from the owner playlist, queue, and bookmarks, and recounts the moment', async () => {
		const db = createMemoryDb();
		db.seed('reactions', 'mine', {
			reactorId: ownerId,
			playlistId: 'my-playlist',
			isMomentReaction: true,
			isPublished: true,
			momentId: 'moment-1'
		});
		db.seed('reactions', 'still-there', {
			reactorId: ownerId,
			playlistId: '',
			isMomentReaction: true,
			isPublished: true,
			momentId: 'moment-1'
		});
		db.seed('playlists', 'my-playlist', {
			userId: ownerId,
			reactionBinomeIds: ['mine', 'still-there']
		});
		db.seed('playlists', 'their-playlist', {
			userId: otherId,
			reactionBinomeIds: ['mine']
		});
		db.seed('queues', 'my-queue', {
			ownerId,
			items: [
				{ type: 'reaction', id: 'mine' },
				{ type: 'reaction', id: 'still-there' }
			]
		});
		db.seed('queues', 'their-queue', {
			ownerId: otherId,
			items: [{ type: 'reaction', id: 'mine' }]
		});
		db.seed('moments', 'moment-1', { creatorId: otherId, reactionCount: 9 });
		db.seed('userData', ownerId, { bookmarks: ['mine', 'still-there'] });

		const result = await deleteOwnedContent({
			adminDb: db,
			userId: ownerId,
			kind: 'reaction',
			id: 'mine',
			collections
		});

		expect(result.ok).toBe(true);
		expect(db.read('reactions', 'mine')).toBeUndefined();
		expect(db.read('reactions', 'still-there')?.reactorId).toBe(ownerId);
		expect(db.read('playlists', 'my-playlist').reactionBinomeIds).toEqual(['', 'still-there']);
		expect(db.read('playlists', 'their-playlist').reactionBinomeIds).toEqual(['mine']);
		expect(db.read('queues', 'my-queue').items).toEqual([{ type: 'reaction', id: 'still-there' }]);
		expect(db.read('queues', 'their-queue').items).toEqual([{ type: 'reaction', id: 'mine' }]);
		expect(db.read('moments', 'moment-1').reactionCount).toBe(1);
		expect(db.read('userData', ownerId).bookmarks).toEqual(['still-there']);
	});

	it('deletes a playlist and the owner reactions in it', async () => {
		const db = createMemoryDb();
		const deletedIds = [];
		db.seed('playlists', 'my-playlist', {
			userId: ownerId,
			reactionBinomeIds: ['in-list', '']
		});
		db.seed('reactions', 'in-list', {
			reactorId: ownerId,
			playlistId: 'my-playlist',
			isMomentReaction: true,
			isPublished: true,
			momentId: 'moment-1'
		});
		db.seed('reactions', 'linked-only', {
			reactorId: ownerId,
			playlistId: 'my-playlist'
		});
		db.seed('reactions', 'not-mine', {
			reactorId: otherId,
			playlistId: 'my-playlist'
		});
		db.seed('reactions', 'standalone', { reactorId: ownerId, playlistId: '' });
		db.seed('moments', 'moment-1', { reactionCount: 4 });
		db.seed('queues', 'my-queue', {
			ownerId,
			items: [
				{ type: 'playlist', id: 'my-playlist' },
				{ type: 'reaction', id: 'standalone' }
			]
		});
		db.seed('userData', ownerId, { bookmarks: ['my-playlist', 'in-list', 'standalone'] });

		const result = await deleteOwnedContent({
			adminDb: db,
			userId: ownerId,
			kind: 'playlist',
			id: 'my-playlist',
			collections,
			batchLimit: 1,
			onDeleted: async (ids) => {
				deletedIds.push(...ids);
			}
		});

		expect(result.ok).toBe(true);
		expect(db.commits).toBeGreaterThan(1);
		expect(db.read('playlists', 'my-playlist')).toBeUndefined();
		expect(db.read('reactions', 'in-list')).toBeUndefined();
		expect(db.read('reactions', 'linked-only')).toBeUndefined();
		expect(db.read('reactions', 'not-mine')?.reactorId).toBe(otherId);
		expect(db.read('reactions', 'standalone')?.reactorId).toBe(ownerId);
		expect(db.read('moments', 'moment-1').reactionCount).toBe(0);
		expect(db.read('queues', 'my-queue').items).toEqual([{ type: 'reaction', id: 'standalone' }]);
		expect(db.read('userData', ownerId).bookmarks).toEqual(['standalone']);
		expect(deletedIds.sort()).toEqual(['in-list', 'linked-only']);
	});

	it('does not delete another user\'s playlist', async () => {
		const db = createMemoryDb();
		db.seed('playlists', 'their-playlist', {
			userId: otherId,
			reactionBinomeIds: ['theirs']
		});
		db.seed('reactions', 'theirs', { reactorId: otherId, playlistId: 'their-playlist' });

		const result = await deleteOwnedContent({
			adminDb: db,
			userId: ownerId,
			kind: 'playlist',
			id: 'their-playlist',
			collections
		});

		expect(result).toMatchObject({ ok: false, status: 403 });
		expect(db.read('playlists', 'their-playlist')?.userId).toBe(otherId);
		expect(db.read('reactions', 'theirs')?.reactorId).toBe(otherId);
		expect(db.commits).toBe(0);
	});
});

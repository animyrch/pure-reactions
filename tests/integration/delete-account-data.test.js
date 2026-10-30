import { describe, expect, it } from 'vitest';
import { deleteAccountData } from '../../src/lib/server/deleteAccountData.js';

const collections = {
	reactions: 'reactions',
	userData: 'userData',
	playlists: 'playlists',
	queues: 'queues',
	moments: 'moments',
	claims: 'claims',
	verifications: 'verifications'
};

function createMemoryDb({ failUpdates = new Set() } = {}) {
	const docs = new Map();

	const refFor = (path) => ({
		path,
		id: path.split('/').pop(),
		async get() {
			if (!docs.has(path)) return { exists: false, id: path.split('/').pop(), data: () => undefined };
			return { exists: true, id: path.split('/').pop(), data: () => structuredClone(docs.get(path)) };
		},
		async update(patch) {
			if (failUpdates.has(path)) throw new Error('moment update failed');
			docs.set(path, { ...(docs.get(path) || {}), ...structuredClone(patch) });
		},
		async delete() {
			docs.delete(path);
		},
		collection(name) {
			return collectionFor(`${path}/${name}`);
		}
	});

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
					ref: refFor(path),
					data: () => structuredClone(data)
				});
			}
			return { docs: found, size: found.length, empty: found.length === 0 };
		}
	});

	const collectionFor = (name) => ({
		doc: (id) => refFor(`${name}/${id}`),
		where: (field, _op, value) => queryFor(name, [[field, value]]),
		get: () => queryFor(name, []).get()
	});

	return {
		collection: collectionFor,
		seed(path, data) {
			docs.set(path, structuredClone(data));
		},
		has(path) {
			return docs.has(path);
		},
		read(path) {
			return docs.get(path);
		},
		batch() {
			const paths = [];
			return {
				delete(ref) {
					paths.push(ref.path);
				},
				async commit() {
					for (const path of paths) docs.delete(path);
				}
			};
		}
	};
}

describe('deleteAccountData', () => {
	it('removes playlists by userId, queues by ownerId, and channel claims', async () => {
		const db = createMemoryDb();
		db.seed('userData/owner', { ageConfirmedAt: true });
		db.seed('playlists/playlist-1', { userId: 'owner', title: 'Mine' });
		db.seed('queues/queue-1', { ownerId: 'owner', title: 'Queue' });
		db.seed('claims/channel-a__owner', { userId: 'owner', youtubeChannelId: 'channel-a' });
		db.seed('verifications/channel-a', { status: 'approved', claimId: 'channel-a__owner' });
		db.seed('claims/channel-b__other', { userId: 'other', youtubeChannelId: 'channel-b' });
		db.seed('verifications/channel-b', { status: 'approved' });
		db.seed('moments/solo', { creatorId: 'owner', creatorDisplayName: 'Owner', title: 'Solo' });
		db.seed('moments/shared', {
			creatorId: 'owner',
			creatorDisplayName: 'Owner',
			title: 'Shared'
		});
		db.seed('reactions/other-reaction', {
			reactorId: 'other',
			momentId: 'shared',
			isMomentReaction: true,
			isPublished: true
		});
		db.seed('reactions/owner-reaction', {
			reactorId: 'owner',
			momentId: 'shared',
			isMomentReaction: true,
			isPublished: true
		});

		const result = await deleteAccountData({ adminDb: db, userId: 'owner', collections });

		expect(result.reactionIds).toEqual(['owner-reaction']);
		expect(db.has('playlists/playlist-1')).toBe(false);
		expect(db.has('queues/queue-1')).toBe(false);
		expect(db.has('claims/channel-a__owner')).toBe(false);
		expect(db.has('verifications/channel-a')).toBe(false);
		expect(db.has('verifications/channel-b')).toBe(true);
		expect(db.has('moments/solo')).toBe(false);
		expect(db.read('moments/shared').creatorId).toBe('deleted');
		expect(db.read('moments/shared').creatorDisplayName).toBe('');
		expect(db.read('moments/shared').reactionCount).toBe(1);
		expect(db.has('reactions/owner-reaction')).toBe(false);
		expect(db.has('reactions/other-reaction')).toBe(true);
	});

	it('keeps reactions when a moment update fails before deletion', async () => {
		const db = createMemoryDb({ failUpdates: new Set(['moments/shared']) });
		db.seed('moments/shared', { creatorId: 'owner', creatorDisplayName: 'Owner', title: 'Shared' });
		db.seed('reactions/owner-reaction', {
			reactorId: 'owner',
			momentId: 'shared',
			isMomentReaction: true,
			isPublished: true
		});
		db.seed('reactions/other-reaction', {
			reactorId: 'other',
			momentId: 'shared',
			isMomentReaction: true,
			isPublished: true
		});

		await expect(deleteAccountData({ adminDb: db, userId: 'owner', collections })).rejects.toThrow(
			'moment update failed'
		);
		expect(db.has('reactions/owner-reaction')).toBe(true);
	});
});

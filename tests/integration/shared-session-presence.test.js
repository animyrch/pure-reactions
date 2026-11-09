import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, calls, listeners } = vi.hoisted(() => ({
    authState: { currentUser: { uid: 'viewer-1' } },
    calls: [],
    listeners: []
}));

vi.mock('firebase/database', () => ({
    ref: vi.fn((_database, path) => ({ path })),
    set: vi.fn(async (dbRef, value) => {
        calls.push(['set', dbRef.path, value]);
    }),
    update: vi.fn(),
    onValue: vi.fn((dbRef, callback) => {
        listeners.push({ path: dbRef.path, callback });
        return () => {
            calls.push(['unsubscribe', dbRef.path]);
        };
    }),
    remove: vi.fn(async (dbRef) => {
        calls.push(['remove', dbRef.path]);
    }),
    serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
    onDisconnect: vi.fn((dbRef) => ({
        remove: () => {
            calls.push(['onDisconnect.remove', dbRef.path]);
            return Promise.resolve();
        },
        cancel: () => {
            calls.push(['onDisconnect.cancel', dbRef.path]);
            return Promise.resolve();
        }
    }))
}));

vi.mock('$lib/constants/firebase', () => ({
    auth: authState,
    database: { name: 'test-db' }
}));

import { remove, set } from 'firebase/database';
import { cleanupInactiveSessions, joinSharedSession, leaveSharedSession } from '$lib/helpers/sharedSession';

const permissionDenied = () => {
    const error = new Error('permission_denied at /sessionViewerOwners');
    error.code = 'PERMISSION_DENIED';
    return error;
};

const operationNames = (entries) => entries.map(([operation, path]) => {
    if (path === '.info/connected') return `${operation} connected`;
    if (String(path).includes('/viewers/')) return `${operation} viewer`;
    if (String(path).startsWith('sessionViewerOwners/')) return `${operation} owner`;
    return `${operation} ${path}`;
});

const flush = async () => {
    for (let step = 0; step < 20; step += 1) {
        await Promise.resolve();
    }
};

const connectAndJoin = async (sessionId) => {
    const pending = joinSharedSession(sessionId);
    const connected = listeners.filter((entry) => entry.path === '.info/connected').at(-1);
    connected.callback({ val: () => true });
    const slotId = await pending;
    return { slotId, connected };
};

describe('shared session viewer presence', () => {
    let consoleError;

    beforeEach(() => {
        calls.length = 0;
        listeners.length = 0;
        authState.currentUser = { uid: 'viewer-1' };
        set.mockImplementation(async (dbRef, value) => {
            calls.push(['set', dbRef.path, value]);
        });
        remove.mockImplementation(async (dbRef) => {
            calls.push(['remove', dbRef.path]);
        });
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('requires a signed-in viewer', async () => {
        authState.currentUser = null;
        await expect(joinSharedSession('session-signed-out')).rejects.toThrow(
            'Sign in before joining a shared session.'
        );
        expect(listeners).toHaveLength(0);
    });

    it('arms disconnect cleanup before publishing presence', async () => {
        const pending = joinSharedSession('session-arm');
        const connected = listeners.at(-1);
        connected.callback({ val: () => false });
        await flush();
        expect(calls).toEqual([]);

        connected.callback({ val: () => true });
        const slotId = await pending;

        expect(slotId).toMatch(/^[0-9a-f]{32}$/);
        expect(operationNames(calls)).toEqual([
            'set owner',
            'onDisconnect.remove viewer',
            'onDisconnect.remove owner',
            'set viewer'
        ]);
        const ownerSet = calls.find(([operation, path]) => operation === 'set' && String(path).startsWith('sessionViewerOwners/'));
        expect(ownerSet[1]).toBe('sessionViewerOwners/session-arm/viewer-1/0');
        expect(ownerSet[2]).toBe(slotId);
        expect(calls.at(-1)[2]).toEqual({
            name: 'Anonymous Viewer',
            joinedAt: { '.sv': 'timestamp' },
            isActive: true
        });

        await leaveSharedSession('session-arm', slotId);
    });

    it('restores the slot and re-arms cleanup when the connection returns', async () => {
        const { slotId, connected } = await connectAndJoin('session-reconnect');
        calls.length = 0;

        connected.callback({ val: () => false });
        await flush();
        expect(calls).toEqual([]);

        connected.callback({ val: () => true });
        await flush();

        expect(operationNames(calls)).toEqual([
            'set owner',
            'onDisconnect.remove viewer',
            'onDisconnect.remove owner',
            'set viewer'
        ]);

        await leaveSharedSession('session-reconnect', slotId);
    });

    it('restores the public slot when the owner claim is still present', async () => {
        let ownerWrites = 0;
        set.mockImplementation(async (dbRef, value) => {
            calls.push(['set', dbRef.path, value]);
            if (!dbRef.path.startsWith('sessionViewerOwners/')) return;
            ownerWrites += 1;
            if (ownerWrites > 1) throw permissionDenied();
        });

        const { slotId, connected } = await connectAndJoin('session-claim-remains');
        calls.length = 0;
        connected.callback({ val: () => true });
        await flush();

        expect(operationNames(calls)).toEqual([
            'set owner',
            'onDisconnect.remove viewer',
            'onDisconnect.remove owner',
            'set viewer'
        ]);

        await leaveSharedSession('session-claim-remains', slotId);
    });

    it('does not publish presence when the owner claim is rejected', async () => {
        set.mockImplementation(async (dbRef, value) => {
            calls.push(['set', dbRef.path, value]);
            if (dbRef.path.startsWith('sessionViewerOwners/')) throw permissionDenied();
        });

        const pending = joinSharedSession('session-claim-denied');
        listeners.at(-1).callback({ val: () => true });

        await expect(pending).rejects.toThrow(/permission_denied/);
        expect(operationNames(calls)).toEqual([
            'set owner',
            'set owner',
            'set owner',
            'unsubscribe connected',
            'remove viewer',
            'onDisconnect.cancel viewer'
        ]);
    });

    it('removes the public slot before canceling disconnect cleanup', async () => {
        const { slotId } = await connectAndJoin('session-leave');
        calls.length = 0;

        await leaveSharedSession('session-leave', slotId);

        expect(operationNames(calls)).toEqual([
            'unsubscribe connected',
            'remove viewer',
            'onDisconnect.cancel viewer',
            'remove owner',
            'onDisconnect.cancel owner'
        ]);
    });

    it('keeps disconnect cleanup armed when presence removal fails', async () => {
        const { slotId } = await connectAndJoin('session-leave-fails');
        calls.length = 0;
        remove.mockImplementation(async (dbRef) => {
            calls.push(['remove', dbRef.path]);
            if (dbRef.path.includes('/viewers/')) {
                throw new Error('presence removal failed');
            }
        });

        await expect(leaveSharedSession('session-leave-fails', slotId)).rejects.toThrow(
            'presence removal failed'
        );
        expect(operationNames(calls)).toEqual([
            'unsubscribe connected',
            'remove viewer'
        ]);
    });

    it('removes owner claims before an expired session', async () => {
        const pending = cleanupInactiveSessions();
        await flush();
        const listener = listeners.find((entry) => entry.path === 'sharedSessions');
        listener.callback({
            val: () => ({
                old: { createdAt: Date.now() - 25 * 60 * 60 * 1000 },
                fresh: { createdAt: Date.now() }
            })
        });
        await pending;

        expect(calls.map(([operation, path]) => [operation, path])).toEqual([
            ['remove', 'sessionViewerOwners/old'],
            ['remove', 'sharedSessions/old']
        ]);
    });
});

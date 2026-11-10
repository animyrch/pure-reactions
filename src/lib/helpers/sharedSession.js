import { ref, set, update, onValue, remove, serverTimestamp, onDisconnect } from "firebase/database";
import { auth, database } from "$lib/constants/firebase";
import { resolveTikTokWatchUrl } from "$lib/helpers/platform";

// Session state constants
export const SESSION_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended'
};

// Create a new shared session
export const createSharedSession = async (
    reactionDocumentId,
    originalVideoId,
    reactorId,
    originalVideoPlatform = 'youtube',
    originalVideoUrl = ''
) => {
    try {
        const sessionRef = ref(database, `sharedSessions/${reactionDocumentId}`);
        const storedOriginalVideoUrl = originalVideoPlatform === 'tiktok'
            ? resolveTikTokWatchUrl({
                videoId: originalVideoId,
                originalVideoUrl,
            }) || ''
            : originalVideoUrl;
        const sessionData = {
            originalVideoId,
            originalVideoPlatform,
            originalVideoUrl: storedOriginalVideoUrl,
            reactorId,
            activeReactionDocumentId: reactionDocumentId,
            state: SESSION_STATES.WAITING,
            currentTime: 0,
            duration: 0,
            volume: 100,
            playbackRate: 1,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            viewers: {}
        };
        
        await set(sessionRef, sessionData);
        return reactionDocumentId;
    } catch (error) {
        console.error('Error creating shared session:', error);
        throw error;
    }
};

const VIEWER_PRESENCE_NAME = 'Anonymous Viewer';

// Public slot keys are 32 hex chars so they cannot be a Firebase account id.
const createViewerSlotId = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const VIEWER_SLOT_LIMIT = 3;

const viewerSlotRef = (sessionId, slotId) => ref(database, `sharedSessions/${sessionId}/viewers/${slotId}`);
// Indexes 0-2 are the cap. Rules have no count operator, so a free index is
// the only way to add a slot. The value is the public slot id.
const viewerOwnerRef = (sessionId, viewerUid, index) =>
    ref(database, `sessionViewerOwners/${sessionId}/${viewerUid}/${index}`);

const presenceBySlot = new Map();
const claimBySlot = new Map();
const presenceKey = (sessionId, slotId) => `${sessionId}/${slotId}`;

const presenceRecord = () => ({
    name: VIEWER_PRESENCE_NAME,
    joinedAt: serverTimestamp(),
    isActive: true
});

const isPermissionDenied = (error) => {
    const code = String(error?.code || '').toLowerCase().replace(/-/g, '_');
    return code === 'permission_denied';
};

// A second claim of the same index is denied once the row exists. After this
// tab has claimed it, that denial means the row survived a short disconnect.
const claimViewerSlot = async (state, sessionId, viewerUid, slotId) => {
    if (state.index != null) {
        const ownerRef = viewerOwnerRef(sessionId, viewerUid, state.index);
        try {
            await set(ownerRef, slotId);
        } catch (error) {
            if (!state.claimed || !isPermissionDenied(error)) throw error;
        }
        state.claimed = true;
        return ownerRef;
    }

    let lastError;
    for (let index = 0; index < VIEWER_SLOT_LIMIT; index += 1) {
        const ownerRef = viewerOwnerRef(sessionId, viewerUid, index);
        try {
            await set(ownerRef, slotId);
            state.index = index;
            state.claimed = true;
            claimBySlot.set(presenceKey(sessionId, slotId), { uid: viewerUid, index });
            return ownerRef;
        } catch (error) {
            lastError = error;
            if (!isPermissionDenied(error)) throw error;
        }
    }
    throw lastError ?? new Error('No viewer slot is available.');
};

// Claim an index before arming cleanup. Disconnect work runs in queue order,
// and the public slot write rule requires that claim to still exist.
const armPresenceDisconnect = async (viewerRef, ownerRef) => {
    await onDisconnect(viewerRef).remove();
    await onDisconnect(ownerRef).remove();
};

const publishViewerPresence = async (state, sessionId, viewerUid, slotId, viewerRef) => {
    if (state.left) return;
    const ownerRef = await claimViewerSlot(state, sessionId, viewerUid, slotId);
    if (state.left) return;
    await armPresenceDisconnect(viewerRef, ownerRef);
    if (state.left) return;
    await set(viewerRef, presenceRecord());
};

// Drop the public slot before canceling its disconnect handler, then drop
// the owner claim. Canceling first would leave a ghost if the tab dies mid-leave.
const disarmPresence = async (viewerRef, ownerRef) => {
    await remove(viewerRef);
    await onDisconnect(viewerRef).cancel();
    if (!ownerRef) return;
    await remove(ownerRef);
    await onDisconnect(ownerRef).cancel();
};

const detachPresence = async (sessionId, slotId) => {
    const state = presenceBySlot.get(presenceKey(sessionId, slotId));
    if (!state) return;

    presenceBySlot.delete(presenceKey(sessionId, slotId));
    state.left = true;
    state.unsubscribe?.();
    state.unsubscribe = null;
    try {
        await state.pending;
    } catch {
        // A failed restore should not block cleanup.
    }
};

const watchViewerPresence = (sessionId, slotId, viewerUid, viewerRef) => {
    const state = {
        left: false,
        claimed: false,
        index: null,
        settled: false,
        unsubscribe: null,
        pending: Promise.resolve()
    };
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    const connectedRef = ref(database, '.info/connected');
    state.unsubscribe = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() !== true || state.left) return;

        state.pending = state.pending
            .catch(() => {})
            .then(async () => {
                if (state.left) return;
                await publishViewerPresence(state, sessionId, viewerUid, slotId, viewerRef);
                if (state.left || state.settled) return;
                state.settled = true;
                resolveReady(slotId);
            })
            .catch((error) => {
                if (state.settled) {
                    if (!state.left) {
                        console.error('Error restoring shared session presence:', error);
                    }
                    return;
                }
                state.settled = true;
                rejectReady(error);
            });
    });

    presenceBySlot.set(presenceKey(sessionId, slotId), state);
    return ready;
};

// Join a shared session as a viewer. Returns the public slot id.
export const joinSharedSession = async (sessionId) => {
    const viewerUid = auth?.currentUser?.uid;
    if (!viewerUid) {
        throw new Error('Sign in before joining a shared session.');
    }

    const slotId = createViewerSlotId();
    const viewerRef = viewerSlotRef(sessionId, slotId);
    const key = presenceKey(sessionId, slotId);

    try {
        return await watchViewerPresence(sessionId, slotId, viewerUid, viewerRef);
    } catch (error) {
        const claim = claimBySlot.get(key);
        claimBySlot.delete(key);
        await detachPresence(sessionId, slotId);
        const ownerRef = claim ? viewerOwnerRef(sessionId, claim.uid, claim.index) : null;
        try {
            await disarmPresence(viewerRef, ownerRef);
        } catch {
            // The claim may have failed before either record existed.
        }
        console.error('Error joining shared session:', error);
        throw error;
    }
};

// Leave a shared session
export const leaveSharedSession = async (sessionId, slotId) => {
    if (!sessionId || !slotId) return;

    const key = presenceKey(sessionId, slotId);
    const claim = claimBySlot.get(key);
    claimBySlot.delete(key);
    await detachPresence(sessionId, slotId);

    const viewerUid = claim?.uid || auth?.currentUser?.uid;
    if (!viewerUid) return;

    const viewerRef = viewerSlotRef(sessionId, slotId);
    const ownerRef = claim ? viewerOwnerRef(sessionId, viewerUid, claim.index) : null;

    try {
        await disarmPresence(viewerRef, ownerRef);
    } catch (error) {
        console.error('Error leaving shared session:', error);
        throw error;
    }
};

// Update session state (play/pause/seek)
export const updateSessionState = async (sessionId, updates) => {
    try {
        const sessionRef = ref(database, `sharedSessions/${sessionId}`);
        const nextUpdates = { ...updates };
        if (nextUpdates.originalVideoPlatform === 'tiktok' && typeof nextUpdates.originalVideoUrl === 'string') {
            nextUpdates.originalVideoUrl = resolveTikTokWatchUrl({
                videoId: nextUpdates.originalVideoId,
                originalVideoUrl: nextUpdates.originalVideoUrl,
            }) || '';
        }
        const updateData = {
            ...nextUpdates,
            lastUpdated: serverTimestamp()
        };

        await update(sessionRef, updateData);
    } catch (error) {
        console.error('Error updating session state:', error);
        throw error;
    }
};

// Listen to session changes
export const listenToSession = (sessionId, callback) => {
    const sessionRef = ref(database, `sharedSessions/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data);
        }
    }, (error) => {
        console.error('Error listening to session:', error);
    });
    
    return unsubscribe;
};

// Get session data once
export const getSessionData = async (sessionId) => {
    try {
        const sessionRef = ref(database, `sharedSessions/${sessionId}`);
        const snapshot = await new Promise((resolve, reject) => {
            onValue(sessionRef, (snapshot) => {
                resolve(snapshot);
            }, { onlyOnce: true });
        });
        
        return snapshot.val();
    } catch (error) {
        console.error('Error getting session data:', error);
        throw error;
    }
};

// Owner claims are a sibling of the session, so deleting the session leaves them behind.
const removeExpiredSession = async (sessionId) => {
    await remove(ref(database, `sessionViewerOwners/${sessionId}`));
    await remove(ref(database, `sharedSessions/${sessionId}`));
};

// Clean up inactive sessions (call this periodically)
export const cleanupInactiveSessions = async () => {
    try {
        const sessionsRef = ref(database, 'sharedSessions');
        const snapshot = await new Promise((resolve, reject) => {
            onValue(sessionsRef, (snapshot) => {
                resolve(snapshot);
            }, { onlyOnce: true });
        });
        
        const sessions = snapshot.val();
        if (!sessions) return;
        
        const now = Date.now();
        const cleanupPromises = [];
        
        Object.entries(sessions).forEach(([sessionId, sessionData]) => {
            // Remove sessions older than 24 hours. Owner claims go first, while
            // the session still exists, so the host rule can authorize the delete.
            if (sessionData.createdAt && (now - sessionData.createdAt) > 24 * 60 * 60 * 1000) {
                cleanupPromises.push(removeExpiredSession(sessionId));
            }
        });
        
        await Promise.all(cleanupPromises);
    } catch (error) {
        console.error('Error cleaning up sessions:', error);
    }
};

// Generate shareable URL
export const generateShareUrl = (sessionId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/shared/${sessionId}`;
};

// Extract session ID from URL
export const extractSessionIdFromUrl = (url) => {
    const match = url.match(/\/shared\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};

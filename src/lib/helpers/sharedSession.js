import { ref, set, update, onValue, remove, serverTimestamp, onDisconnect } from "firebase/database";
import { auth, database } from "$lib/constants/firebase";

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
        const sessionData = {
            originalVideoId,
            originalVideoPlatform,
            originalVideoUrl,
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

const viewerSlotRef = (sessionId, slotId) => ref(database, `sharedSessions/${sessionId}/viewers/${slotId}`);
const viewerOwnerRef = (sessionId, slotId) => ref(database, `sessionViewerOwners/${sessionId}/${slotId}`);

// Join a shared session as a viewer. Returns the public slot id.
export const joinSharedSession = async (sessionId) => {
    const viewerUid = auth?.currentUser?.uid;
    if (!viewerUid) {
        throw new Error('Sign in before joining a shared session.');
    }

    const slotId = createViewerSlotId();
    const ownerRef = viewerOwnerRef(sessionId, slotId);
    const viewerRef = viewerSlotRef(sessionId, slotId);

    try {
        await set(ownerRef, viewerUid);
        await set(viewerRef, {
            name: VIEWER_PRESENCE_NAME,
            joinedAt: serverTimestamp(),
            isActive: true
        });
        await onDisconnect(viewerRef).remove();
        return slotId;
    } catch (error) {
        try {
            await onDisconnect(viewerRef).cancel();
            await remove(viewerRef);
            await remove(ownerRef);
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

    const viewerRef = viewerSlotRef(sessionId, slotId);
    const ownerRef = viewerOwnerRef(sessionId, slotId);

    try {
        await onDisconnect(viewerRef).cancel();
        await remove(viewerRef);
        await remove(ownerRef);
    } catch (error) {
        console.error('Error leaving shared session:', error);
        throw error;
    }
};

// Update session state (play/pause/seek)
export const updateSessionState = async (sessionId, updates) => {
    try {
        const sessionRef = ref(database, `sharedSessions/${sessionId}`);
        const updateData = {
            ...updates,
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
            // Remove sessions older than 24 hours
            if (sessionData.createdAt && (now - sessionData.createdAt) > 24 * 60 * 60 * 1000) {
                cleanupPromises.push(remove(ref(database, `sharedSessions/${sessionId}`)));
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

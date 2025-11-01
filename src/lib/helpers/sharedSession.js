import { ref, set, update, onValue, remove, serverTimestamp } from "firebase/database";
import { database } from "$lib/constants/firebase";

// Session state constants
export const SESSION_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended'
};

// Create a new shared session
export const createSharedSession = async (reactionDocumentId, originalVideoId, reactorId) => {
    try {
        const sessionRef = ref(database, `sharedSessions/${reactionDocumentId}`);
        const sessionData = {
            originalVideoId,
            reactorId,
            activeReactionDocumentId: reactionDocumentId,
            state: SESSION_STATES.WAITING,
            currentTime: 0,
            duration: 0,
            volume: 100,
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

// Join a shared session as a viewer
export const joinSharedSession = async (sessionId, viewerId, viewerName = 'Anonymous') => {
    try {
        const viewerRef = ref(database, `sharedSessions/${sessionId}/viewers/${viewerId}`);
        const viewerData = {
            name: viewerName,
            joinedAt: serverTimestamp(),
            isActive: true
        };
        
        await set(viewerRef, viewerData);
        return sessionId;
    } catch (error) {
        console.error('Error joining shared session:', error);
        throw error;
    }
};

// Leave a shared session
export const leaveSharedSession = async (sessionId, viewerId) => {
    try {
        const viewerRef = ref(database, `sharedSessions/${sessionId}/viewers/${viewerId}`);
        await remove(viewerRef);
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

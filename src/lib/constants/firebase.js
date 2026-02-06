import { env } from '$env/dynamic/public';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore/lite";

export const COLLECTION_REACTION_BINOMES = env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES;
export const COLLECTION_USER_DATA = env.PUBLIC_FIREBASE_COLLECTION_USER_DATA;
export const COLLECTION_PLAYLISTS = env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS;
export const COLLECTION_QUEUES = env.PUBLIC_FIREBASE_COLLECTION_QUEUES;
export const COLLECTION_YOUTUBE_CHANNEL_CLAIMS = env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS;
const DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS = COLLECTION_YOUTUBE_CHANNEL_CLAIMS
    ? COLLECTION_YOUTUBE_CHANNEL_CLAIMS.replace('youtubeChannelClaims', 'youtubeChannelVerifications')
    : undefined;
export const COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS =
    env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS || DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS;
export const FIREBASE_CONFIG = env.PUBLIC_FIREBASE_CONFIG ? JSON.parse(env.PUBLIC_FIREBASE_CONFIG) : {};

// Initialize Firebase Realtime Database
export const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
export const database = getDatabase(app);
export const db = getFirestore(app);

// Optional Firestore emulator support (primarily for e2e + local dev).
// Enable by setting PUBLIC_FIREBASE_USE_EMULATORS=true and optionally host/port.
if (env.PUBLIC_FIREBASE_USE_EMULATORS === 'true') {
    const host = env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = Number(env.PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
    try {
        connectFirestoreEmulator(db, host, port);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Firestore emulator enabled at ${host}:${port}`);
    } catch (error) {
        // If called twice, Firebase throws; ignore.
        // eslint-disable-next-line no-console
        console.warn('[firebase] Failed to connect Firestore emulator', error);
    }
}

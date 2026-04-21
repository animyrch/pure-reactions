import { env } from '$env/dynamic/public';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore/lite";
import { getAuth, connectAuthEmulator } from "firebase/auth";

function readCollectionName(value, fallback) {
    const trimmed = value?.trim();
    return trimmed && trimmed !== 'your_collection_name' ? trimmed : fallback;
}

export const COLLECTION_REACTION_BINOMES = readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES, 'reactions-local');
export const COLLECTION_USER_DATA = readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_USER_DATA, 'userData_local');
export const COLLECTION_PLAYLISTS = readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS, 'playlists_local');
export const COLLECTION_QUEUES = readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_QUEUES, 'queues_local');
export const COLLECTION_YOUTUBE_CHANNEL_CLAIMS = readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS, 'youtubeChannelClaims_local');
const DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS = COLLECTION_YOUTUBE_CHANNEL_CLAIMS
    ? COLLECTION_YOUTUBE_CHANNEL_CLAIMS.replace('youtubeChannelClaims', 'youtubeChannelVerifications')
    : 'youtubeChannelVerifications_local';
export const COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS =
    readCollectionName(env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS, DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS);
let parsedConfig = {};
try {
    parsedConfig = env.PUBLIC_FIREBASE_CONFIG ? JSON.parse(env.PUBLIC_FIREBASE_CONFIG) : {};
} catch (e) {
    // eslint-disable-next-line no-console
    console.error('[firebase] Failed to parse PUBLIC_FIREBASE_CONFIG. Raw value:', env.PUBLIC_FIREBASE_CONFIG);
    // eslint-disable-next-line no-console
    console.error('[firebase] Parse error:', e);
}

// Fallback for emulators (e.g. CI) where config might be missing.
if (env.PUBLIC_FIREBASE_USE_EMULATORS === 'true') {
    if (parsedConfig.projectId === 'your_project_id') {
        delete parsedConfig.projectId;
    }
    if (parsedConfig.databaseURL?.includes?.('your_project_id')) {
        delete parsedConfig.databaseURL;
    }
    if (parsedConfig.apiKey === 'your_api_key') {
        delete parsedConfig.apiKey;
    }

    if (!parsedConfig.projectId) {
        parsedConfig.projectId = 'demo-pure-reactions';
    }
    // Provide a dummy databaseURL if missing to satisfy getDatabase requirements
    if (!parsedConfig.databaseURL) {
        parsedConfig.databaseURL = `https://${parsedConfig.projectId}-default-rtdb.firebaseio.com`;
    }
    // Auth requires an API key even for emulators
    if (!parsedConfig.apiKey) {
        parsedConfig.apiKey = 'fake-api-key-for-emu';
    }
}

export const FIREBASE_CONFIG = parsedConfig;

// Initialize Firebase Realtime Database
export const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
export const database = getDatabase(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (env.PUBLIC_FIREBASE_USE_EMULATORS === 'true') {
    try {
        // Firestore
        const host = env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
        const port = Number(env.PUBLIC_FIRESTORE_EMULATOR_PORT || 8086);
        connectFirestoreEmulator(db, host, port);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Firestore emulator enabled at ${host}:${port}`);

        // Realtime Database
        const rtdbHost = env.PUBLIC_DATABASE_EMULATOR_HOST || '127.0.0.1';
        const rtdbPort = Number(env.PUBLIC_DATABASE_EMULATOR_PORT || 9000);
        connectDatabaseEmulator(database, rtdbHost, rtdbPort);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Realtime Database emulator enabled at ${rtdbHost}:${rtdbPort}`);

        // Auth
        const authHost = env.PUBLIC_AUTH_EMULATOR_HOST || '127.0.0.1';
        const authPort = Number(env.PUBLIC_AUTH_EMULATOR_PORT || 9099);
        connectAuthEmulator(auth, `http://${authHost}:${authPort}`);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Auth emulator enabled at ${authHost}:${authPort}`);
    } catch (error) {
        // If called twice, Firebase throws; ignore.
    }
}

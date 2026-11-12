import {
    PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES,
    PUBLIC_FIREBASE_COLLECTION_USER_DATA,
    PUBLIC_FIREBASE_COLLECTION_PLAYLISTS,
    PUBLIC_FIREBASE_COLLECTION_QUEUES,
    PUBLIC_FIREBASE_COLLECTION_MOMENTS,
    PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
    PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS,
    PUBLIC_FIREBASE_COLLECTION_YOUTUBE_PLAYLIST_CACHE,
    PUBLIC_FIREBASE_COLLECTION_YOUTUBE_COMMENT_CACHE,
    PUBLIC_FIREBASE_COLLECTION_TIKTOK_METADATA_CACHE,
    PUBLIC_FIREBASE_COLLECTION_RATE_LIMITS,
    PUBLIC_FIREBASE_CONFIG,
    PUBLIC_FIREBASE_USE_EMULATORS,
    PUBLIC_FIRESTORE_EMULATOR_HOST,
    PUBLIC_FIRESTORE_EMULATOR_PORT,
    PUBLIC_DATABASE_EMULATOR_HOST,
    PUBLIC_DATABASE_EMULATOR_PORT,
    PUBLIC_AUTH_EMULATOR_HOST,
    PUBLIC_AUTH_EMULATOR_PORT
} from '$app/env/public';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore/lite";
import { getAuth, connectAuthEmulator } from "firebase/auth";

function readCollectionName(value, fallback) {
    const trimmed = value?.trim();
    return trimmed && trimmed !== 'your_collection_name' ? trimmed : fallback;
}

export const COLLECTION_REACTION_BINOMES = readCollectionName(PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES, 'reactions-local');
export const COLLECTION_USER_DATA = readCollectionName(PUBLIC_FIREBASE_COLLECTION_USER_DATA, 'userData_local');
export const COLLECTION_PLAYLISTS = readCollectionName(PUBLIC_FIREBASE_COLLECTION_PLAYLISTS, 'playlists_local');
export const COLLECTION_QUEUES = readCollectionName(PUBLIC_FIREBASE_COLLECTION_QUEUES, 'queues_local');
export const COLLECTION_MOMENTS = readCollectionName(PUBLIC_FIREBASE_COLLECTION_MOMENTS, 'moments_local');
export const COLLECTION_YOUTUBE_CHANNEL_CLAIMS = readCollectionName(PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS, 'youtubeChannelClaims_local');
const DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS = COLLECTION_YOUTUBE_CHANNEL_CLAIMS
    ? COLLECTION_YOUTUBE_CHANNEL_CLAIMS.replace('youtubeChannelClaims', 'youtubeChannelVerifications')
    : 'youtubeChannelVerifications_local';

export const COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS = readCollectionName(PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS, DEFAULT_YOUTUBE_CHANNEL_VERIFICATIONS);
export const COLLECTION_YOUTUBE_PLAYLIST_CACHE = readCollectionName(PUBLIC_FIREBASE_COLLECTION_YOUTUBE_PLAYLIST_CACHE, 'youtubePlaylistCache_local');
export const COLLECTION_YOUTUBE_COMMENT_CACHE = readCollectionName(PUBLIC_FIREBASE_COLLECTION_YOUTUBE_COMMENT_CACHE, 'youtubeCommentCache_local');
export const COLLECTION_TIKTOK_METADATA_CACHE = readCollectionName(PUBLIC_FIREBASE_COLLECTION_TIKTOK_METADATA_CACHE, 'tiktokMetadataCache_local');
export const COLLECTION_RATE_LIMITS = readCollectionName(PUBLIC_FIREBASE_COLLECTION_RATE_LIMITS, 'rateLimits_local');

let parsedConfig = {};
try {
    parsedConfig = PUBLIC_FIREBASE_CONFIG ? JSON.parse(PUBLIC_FIREBASE_CONFIG) : {};
} catch(e) {
    // eslint-disable-next-line no-console
    console.error('[firebase] Failed to parse PUBLIC_FIREBASE_CONFIG. Raw value:', PUBLIC_FIREBASE_CONFIG);
    // eslint-disable-next-line no-console
    console.error('[firebase] Parse error:', e);
}

// Fallback for emulators (e.g. CI) where config might be missing.
if (PUBLIC_FIREBASE_USE_EMULATORS === 'true') {
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

const hasProjectId = Boolean(FIREBASE_CONFIG.projectId);
const hasApiKey = Boolean(FIREBASE_CONFIG.apiKey);
const hasDatabaseUrl = Boolean(FIREBASE_CONFIG.databaseURL);
const canInitializeApp = hasProjectId || hasApiKey || hasDatabaseUrl || Boolean(FIREBASE_CONFIG.appId);

// Initialize Firebase Realtime Database
export const app = canInitializeApp
    ? !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp()
    : null;
export const database = app && (hasDatabaseUrl || hasProjectId) ? getDatabase(app) : null;
export const db = app && hasProjectId ? getFirestore(app) : null;
export const auth = app && hasApiKey ? getAuth(app) : null;

if (PUBLIC_FIREBASE_USE_EMULATORS === 'true' && db && database && auth) {
    try {
        // Firestore
        const host = PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
        const port = Number(PUBLIC_FIRESTORE_EMULATOR_PORT || 8086);
        connectFirestoreEmulator(db, host, port);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Firestore emulator enabled at ${host}:${port}`);

        // Realtime Database
        const rtdbHost = PUBLIC_DATABASE_EMULATOR_HOST || '127.0.0.1';
        const rtdbPort = Number(PUBLIC_DATABASE_EMULATOR_PORT || 9000);
        connectDatabaseEmulator(database, rtdbHost, rtdbPort);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Realtime Database emulator enabled at ${rtdbHost}:${rtdbPort}`);

        // Auth
        const authHost = PUBLIC_AUTH_EMULATOR_HOST || '127.0.0.1';
        const authPort = Number(PUBLIC_AUTH_EMULATOR_PORT || 9099);
        connectAuthEmulator(auth, `http://${authHost}:${authPort}`);
        // eslint-disable-next-line no-console
        console.log(`[firebase] Auth emulator enabled at ${authHost}:${authPort}`);
    } catch (error) {
        // If called twice, Firebase throws; ignore.
    }
}

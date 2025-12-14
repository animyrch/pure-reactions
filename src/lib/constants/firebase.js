import { env } from '$env/dynamic/public';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore/lite";

export const COLLECTION_REACTION_BINOMES = env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES;
export const COLLECTION_USER_DATA = env.PUBLIC_FIREBASE_COLLECTION_USER_DATA;
export const COLLECTION_PLAYLISTS = env.PUBLIC_FIREBASE_COLLECTION_PLAYLISTS;
export const COLLECTION_SETS = env.PUBLIC_FIREBASE_COLLECTION_SETS;
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBqsnKIBnbRJqkpyOynZGLySf28AuqmOiE",
    authDomain: "pure-reactions.firebaseapp.com",
    projectId: "pure-reactions",
    storageBucket: "pure-reactions.appspot.com",
    messagingSenderId: "722795539356",
    appId: "1:722795539356:web:0ec764c6b5834567603659",
    measurementId: "G-T7TWND1C6C",
    databaseURL: "https://pure-reactions-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialize Firebase Realtime Database
export const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
export const database = getDatabase(app);
export const db = getFirestore(app);

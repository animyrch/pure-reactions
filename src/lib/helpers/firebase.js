import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
} from "firebase/firestore/lite";

import { COLLECTION_NAME, FIREBASE_CONFIG } from "$lib/constants/firebase";

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export const createReactionDocument = (originalVideoId) => {
    const reactionsCollection = collection(db, COLLECTION_NAME);
    const dataToAdd = {
        "original-video-id": originalVideoId,
        "reactor-id": 1,
        "reaction-configs": {},
    };
    addDoc(reactionsCollection, dataToAdd)
        .then((documentRef) => {
            // documentRef.id contains the auto-generated document ID
            console.log("Document added with ID:", documentRef.id);
            window.currentReactionDocumentId = documentRef.id;
        })
        .catch((error) => {
            console.error("Error adding document:", error);
        });
};

export const updateFirebaseDocument = (dataToUpdate) => {
    const reactionsCollection = collection(db, COLLECTION_NAME);
    const documentRef = doc(
        reactionsCollection,
        window.currentReactionDocumentId
    );

    updateDoc(documentRef, dataToUpdate);
};
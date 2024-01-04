import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    orderBy
} from "firebase/firestore/lite";
import {
    getAuth,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    updatePassword,
    sendEmailVerification,
    reauthenticateWithCredential,
    EmailAuthProvider,
    verifyBeforeUpdateEmail
} from "firebase/auth";
import {
    COLLECTION_REACTION_BINOMES,
    COLLECTION_USER_BOOKMARKS,
    FIREBASE_CONFIG
} from "$lib/constants/firebase";
import { showToast } from '$lib/stores/toast';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
export const auth = getAuth(app);

export const createReactionDocument = (originalVideoId, userId) => {
    console.log(originalVideoId, userId);
    const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
    const dataToAdd = {
        "originalVideoId": originalVideoId,
        "reactionConfigs": {},
        "reactorId": userId,
        "createdAt": serverTimestamp()
    };
    addDoc(reactionsCollection, dataToAdd)
        .then((documentRef) => {
            window.currentReactionDocumentId = documentRef.id;
        })
        .catch((error) => {
            console.error("Error adding document:", error);
        });
};

export const updateFirebaseDocument = async (dataToUpdate) => {
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        const documentRef = doc(
            reactionsCollection,
            window.currentReactionDocumentId
        );
        await updateDoc(documentRef, dataToUpdate);
    } catch (error) {
        console.error('Error updating document: ', error);
    }
};

export const getAllReactions = async () => {
    let reactions = [];
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        const querySnapshot = await getDocs(
            query(reactionsCollection,
                // orderBy('reactionVideoId', 'desc'),
                where('reactionVideoId', '!=', ''),
                orderBy('reactionVideoId', 'desc'),
                orderBy('createdAt', 'desc')
            )
        );
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
    } catch (error) {
        console.error('Error getting documents: ', error);
    }
    return reactions;
};

export const getUserReactions = async (userId) => {
    let reactions = [];
    if (!userId) {
        return reactions;
    }
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        const queryRef = query(reactionsCollection,
            where("reactorId", "==", userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(queryRef);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting filtered documents: ', error);
    }
};

export const getReaction = async (reactionId) => {
    try {
        const docRef = doc(db, COLLECTION_REACTION_BINOMES, reactionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap;
        } else {
          console.log("No such document!");
        }
    } catch (error) {
        console.error('Error getting reaction: ', error);
    }
};

export const createUserWithEmailAndPasswordWrapper = async (email, password) => {
    let successful = false;
    try {
        const userCreds = await createUserWithEmailAndPassword(auth, email, password)
        sendEmailVerification(userCreds.user, {
            url: window.location.href
        });
        successful = true;
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        showToast(errorCode);
        console.log('errorMessage', errorMessage);
    }
    return successful;
};

export const signInWithEmailAndPasswordWrapper = async (email, password) => {
    let successful = false;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        successful = true;
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        showToast(errorCode);
        console.log('errorMessage', errorMessage);
    }
    return successful;
};

export const checkUserSignInStatusWrapper = () => {
    return new Promise((resolve, reject) => {
        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
            // Unsubscribe immediately after the first invocation
            unsubscribe();
    
            if (user) {
                // User is signed in
                resolve(user);
            } else {
                // User is signed out
                resolve(null);
            }
            });
        } catch (error) {
            reject('Sign in status check failed');
        }
    });
};

export const signOutWrapper = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Sign-out error:', error);
    }
};

export async function updateDisplayNameHelper(user, displayName) {
    try {
        await updateProfile(user, { displayName });
    } catch (error) {
        console.error('Error updating display name:', error.message);
        throw error;
    }
}
export async function updatePhotoHelper(user, photoURL) {
    try {
        await updateProfile(user, { photoURL });
    } catch (error) {
        console.error('Error updating user photo:', error.message);
        throw error;
    }
}
export async function updateEmailHelper(user, newEmail) {
    try {
      await verifyBeforeUpdateEmail(user, newEmail);
    } catch (error) {
      console.error('Error updating email:', error.message);
      throw error;
    }
}
export async function updatePasswordHelper(user, newPassword) {
    try {
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error('Error updating password:', error.message);
      throw error;
    }
  }

export const reauthenticateUserHelper = async (user) => {
    try {
        const password = prompt('Please enter your password to continue:');
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (error) {
        console.error('Error reauthenticating user:', error.message);
        throw error;
    }
};

export const addBookmark = async (userId, reactionBinomeId) => {
    let userBookmarks = [];
    console.log('addBookmark', userId, reactionBinomeId);
};
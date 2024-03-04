import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    orderBy,
    or
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
    COLLECTION_USER_DATA,
    FIREBASE_CONFIG
} from "$lib/constants/firebase";
import { showToast } from '$lib/stores/toast';
import { SORTINGS } from '$lib/constants/sortings';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
export const auth = getAuth(app);

export const createReactionDocument = ({
    originalVideoId,
    userId,
    originalVideoAuthor,
    originalVideoTitle
}) => {
    const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
    const dataToAdd = {
        "originalVideoId": originalVideoId,
        "originalVideoAuthor": originalVideoAuthor,
        "originalVideoTitle": originalVideoTitle,
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

export const getAllReactions = async (sortBy, follows) => {
    let reactions = [];
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        let baseQuery = query(reactionsCollection,
            where('reactionVideoId', '!=', ''),
            where('isPublished', '==', true),
            orderBy('reactionVideoId', 'desc'),
            orderBy('createdAt', 'desc')
        );
        if (sortBy === SORTINGS.FOLLOWING && follows && follows.length) {
            baseQuery = query(baseQuery, where('reactorId', 'in', follows));
        }
        const querySnapshot = await getDocs(baseQuery);
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
export const getReactionsByReactorName = async (reactorName) => {
    let reactions = [];
    if (!reactorName) {
        return reactions;
    }
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        const queryRef = query(reactionsCollection,
            where("reactionVideoAuthor", "==", reactorName),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(queryRef);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting reactor documents: ', error);
    }
};

export const getReactionsToOriginalVideo = async (originalVideoId, exceptReactionVideoId) => {
    let reactions = [];
    if (!originalVideoId) {
        return reactions;
    }
    try {
        const reactionsCollection = collection(db, COLLECTION_REACTION_BINOMES);
        const queryRef = query(reactionsCollection,
            where("originalVideoId", "==", originalVideoId),
            where("reactionVideoId", "!=", exceptReactionVideoId),
            orderBy('reactionVideoId', 'desc'),
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
            const data = docSnap.data();
            return {
                    ...data,
                    id: docSnap.id
                };
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

export const addBookmarkWrapper = async (userId, reactionBinomeId) => {
    try {
        const userExtraData = await getUserExtraData(userId);
        const userBookmarks = userExtraData.bookmarks ? [...userExtraData.bookmarks] : [];
        if (!userBookmarks.includes(reactionBinomeId)) {
            userBookmarks.push(reactionBinomeId);
        }
        const userExtraDataCollection = collection(db, COLLECTION_USER_DATA);
        const userExtraDataRef = doc(userExtraDataCollection, userId);
        await setDoc(userExtraDataRef, {
            ...userExtraData,
            bookmarks: userBookmarks
        });
        console.log("User bookmarks saved successfully");
    } catch (error) {
        console.error("Error setting user bookmarks: ", error);
    }
};

export const removeBookmarkWrapper = async (userId, reactionBinomeId) => {
    try {
        const userExtraData = await getUserExtraData(userId);
        let userBookmarks = [...userExtraData.bookmarks];
        if (userBookmarks.includes(reactionBinomeId)) {
            userBookmarks = userBookmarks.filter(currentReactionBinomeId => currentReactionBinomeId !== reactionBinomeId);
        }
        const userExtraDataCollection = collection(db, COLLECTION_USER_DATA);
        const userExtraDataRef = doc(userExtraDataCollection, userId);
        await setDoc(userExtraDataRef, {
            ...userExtraData,
            bookmarks: userBookmarks
        });
        console.log("User bookmarks saved successfully");
    } catch (error) {
        console.error("Error removing user bookmarks: ", error);
    }
};

export const addFollowWrapper = async (userId, reactorId) => {
    try {
        const userExtraData = await getUserExtraData(userId);
        const userFollows = userExtraData.follows ? [...userExtraData.follows] : [];
        if (!userFollows.includes(reactorId) && userId !== reactorId) {
            userFollows.push(reactorId);
        }
        const userExtraDataCollection = collection(db, COLLECTION_USER_DATA);
        const userExtraDataRef = doc(userExtraDataCollection, userId);
        await setDoc(userExtraDataRef, {
            ...userExtraData,
            follows: userFollows
        });
        console.log("User follows saved successfully");
    } catch (error) {
        console.error("Error setting user follows: ", error);
    }
};

export const removeFollowWrapper = async (userId, reactorId) => {
    try {
        const userExtraData = await getUserExtraData(userId);
        let userFollows = [...userExtraData.follows];
        if (userFollows.includes(reactorId)) {
            userFollows = userFollows.filter(currentReactorId => currentReactorId !== reactorId);
        }
        const userExtraDataCollection = collection(db, COLLECTION_USER_DATA);
        const userExtraDataRef = doc(userExtraDataCollection, userId);
        await setDoc(userExtraDataRef, {
            ...userExtraData,
            follows: userFollows
        });
        console.log("User follow removed successfully");
    } catch (error) {
        console.error("Error removing user follows: ", error);
    }
};

export const getUserExtraData = async (userId) => {
    if (!userId) {
        return {};
    }
    try {
        const userExtraDataCollection = collection(db, COLLECTION_USER_DATA);
        const userExtraDataRef = doc(
            userExtraDataCollection,
            userId
        );
        const userExtraDataSnapshot = await getDoc(userExtraDataRef);
        if (userExtraDataSnapshot.exists()) {
            return userExtraDataSnapshot.data();
          } else {
            return {};
          }
    } catch (error) {
        console.error("Error getting userdata: ", error);
    }
};
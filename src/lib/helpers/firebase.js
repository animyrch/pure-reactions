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
    or,
    limit,
    startAfter
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
    COLLECTION_PLAYLISTS,
    FIREBASE_CONFIG
} from "$lib/constants/firebase";
import { showToast } from '$lib/stores/toast';
import { SORTINGS } from '$lib/constants/sortings';
import { FILTERS } from '$lib/constants/filters';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

export const auth = getAuth(app);

const createCollection = (db, params, caller) => {
    return collection(db, params);
};

export const createReactionDocument = async ({
    originalVideoId,
    userId,
    originalVideoAuthor,
    originalVideoTitle
}) => {
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'createReactionDocument');
        const dataToAdd = {
            originalVideoId,
            originalVideoAuthor,
            originalVideoTitle,
            reactionConfigs: {},
            reactorId: userId,
            createdAt: serverTimestamp()
        };

        const documentRef = await addDoc(reactionsCollection, dataToAdd);
        window.currentReactionDocumentId = documentRef.id;
        return documentRef.id; // Return the document ID if needed
    } catch (error) {
        console.error("Error adding document:", error);
        throw error; // Ensure errors are properly propagated
    }
};

export const createPlaylistDocument = async ({ reactionDocumentId, originalVideoId, userId }) => {
    try {
        const playlistsCollection = createCollection(db, COLLECTION_PLAYLISTS, 'createPlaylistDocument');
        const dataToAdd = {
            reactionBinomeIds: [reactionDocumentId],
            originalVideoIds: [originalVideoId],
            reactorId: userId,
            createdAt: serverTimestamp()
        };

        const documentRef = await addDoc(playlistsCollection, dataToAdd);
        window.currentPlaylistDocumentId = documentRef.id;
        return documentRef.id; // Return the document ID if needed
    } catch (error) {
        console.error("Error adding document:", error);
        throw error; // Ensure errors are properly propagated
    }
};

export const addToPlaylistDocument = async ({ reactionDocumentId, originalVideoId, playlistDocumentId }) => {
    try {
        const playlistsCollection = createCollection(db, COLLECTION_PLAYLISTS, 'addToPlaylistDocument');
        const playlistDocumentRef = doc(playlistsCollection, playlistDocumentId);

        // Fetch the existing document
        const playlistDocSnap = await getDoc(playlistDocumentRef);
        if (!playlistDocSnap.exists()) {
            throw new Error(`Playlist document with ID ${playlistDocumentId} does not exist.`);
        }

        const playlistData = playlistDocSnap.data();
        const existingReactions = playlistData.reactionBinomeIds || [];
        const existingOriginalVideos = playlistData.originalVideoIds || [];
        // doc is updated by adding the new reactionDocumentId to the existing array
        const updatedReactions = [...new Set([...existingReactions, reactionDocumentId])]; // Prevent duplicates
        const updatedOriginalVideos = [...new Set([...existingOriginalVideos, originalVideoId])]; // Prevent duplicates
        await setDoc(playlistDocumentRef, { 
            ...playlistData, 
            reactionBinomeIds: updatedReactions,
            originalVideoIds: updatedOriginalVideos
        });
    } catch (error) {
        console.error('Error updating document: ', error);
    }
};

export const updateFirebaseDocument = async (dataToUpdate) => {
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'updateFirebaseDocument');
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
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getAllReactions');
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

export const getReactionsByPage = async (lastDoc, limitBy, sortBy, follows) => {
    let reactions = [];
    let lastVisible = null;
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsByPage');
        let baseQuery = query(reactionsCollection,
            where('reactionVideoId', '!=', ''),
            where('isPublished', '==', true),
            orderBy('reactionVideoId', 'desc'),
            orderBy('createdAt', 'desc')
        );
        if (sortBy === SORTINGS.FOLLOWING && follows && follows.length) {
            baseQuery = query(baseQuery, where('reactorId', 'in', follows));
        }
        if (lastDoc) {
            baseQuery = query(baseQuery, startAfter(lastDoc));
        }
        baseQuery = query(baseQuery, limit(limitBy));
        const querySnapshot = await getDocs(baseQuery);
        lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
    } catch (error) {
        console.error('Error getting paged documents: ', error);
    }
    return {
        reactions,
        lastVisible
    };
};

export const getUserReactions = async (userId, filter) => {
    let reactions = [];
    if (!userId) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getUserReactions');
        let baseQuery = query(reactionsCollection,
            where("reactorId", "==", userId),
            where("playlistId", "==", ""),
            orderBy('playlistId', 'desc'),
            orderBy('createdAt', 'desc')
        );
        if (filter === FILTERS.PUBLISHED) {
            baseQuery = query(baseQuery, where('isPublished', '==', true));
        } else if (filter === FILTERS.UNPUBLISHED) {
            baseQuery = query(baseQuery, where('isPublished', '==', false));
        }
        const querySnapshot = await getDocs(baseQuery);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting documents filtered by user: ', error);
    }
};

export const getPlaylist = async (playlistId) => {
    try {
        const playlistsCollection = createCollection(db, COLLECTION_PLAYLISTS, 'getPlaylist');
        const playlistRef = doc(
            playlistsCollection,
            playlistId
        );
        const playlistSnapshot = await getDoc(playlistRef);
        if (playlistSnapshot.exists()) {
            return playlistSnapshot.data();
        } else {
            return {};
        }
    }
    catch (error) {
        console.error('Error getting playlist: ', error);
    }
};

export const getUserPlaylists = async (userId) => {
    let playlists = [];
    if (!userId) {
        return playlists;
    }
    try {
        const playlistsCollection = createCollection(db, COLLECTION_PLAYLISTS, 'getUserPlaylists');
        const queryRef = query(
            playlistsCollection,
            where("reactorId", "==", userId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(queryRef);

        // Use Promise.all to handle asynchronous fetching for each playlist
        playlists = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
            const playlistData = docSnapshot.data();
            let firstReactionBinomeData = null;

            // Check if reactionBinomeIds exists and has at least one element
            if (playlistData.reactionBinomeIds && playlistData.reactionBinomeIds.length > 0) {
                const firstReactionBinomeId = playlistData.reactionBinomeIds[0];
                // Get a reference to the reaction binome document
                const reactionBinomeRef = doc(db, COLLECTION_REACTION_BINOMES, firstReactionBinomeId);
                const reactionBinomeSnap = await getDoc(reactionBinomeRef);
                if (reactionBinomeSnap.exists()) {
                    firstReactionBinomeData = reactionBinomeSnap.data();
                }
            }

            // Return a new object that includes the playlist data and the first reaction binome data
            return {
                id: docSnapshot.id,
                data: playlistData,
                firstReactionBinomeData
            };
        }));

        return playlists;
    } catch (error) {
        console.error('Error getting documents filtered by user: ', error);
    }
};

export const getReactionsByReactorName = async (reactorName) => {
    let reactions = [];
    if (!reactorName) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsByReactorName');
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

export const getReactionsByCreatorName = async (creatorName) => {
    let reactions = [];
    if (!creatorName) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsByCreatorName');
        const queryRef = query(reactionsCollection,
            where("originalVideoAuthor", "==", creatorName),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(queryRef);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting creator documents: ', error);
    }
};
export const getReactionsToOriginalVideo = async (originalVideoId, exceptReactionVideoId) => {
    let reactions = [];
    if (!originalVideoId) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsToOriginalVideo');
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
        console.error('Error getting documents filtered by original video: ', error);
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

export const getReactionsByIds = async (reactionIds) => {
    let reactions = [];
    if (!reactionIds || !reactionIds.length) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsByIds'); // replace 'reactions' with your collection name
        const reactions = [];
    
        for (const id of reactionIds) {
            const reactionRef = doc(
                reactionsCollection,
                id
            );
            const reactionSnapshot = await getDoc(reactionRef);
            if (reactionSnapshot.exists()) {
                const reactionFound = { id: reactionSnapshot.id, data: { ...reactionSnapshot.data() } };
                reactions.push(reactionFound);
            } else {
                return {};
            }
        }
        return reactions;
    } catch (error) {
        console.error('Error getting documents filtered by reaction video ids: ', error);
    }
    return reactions;
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
        const userExtraDataCollection = createCollection(db, COLLECTION_USER_DATA, 'addBookmarkWrapper');
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
        const userExtraDataCollection = createCollection(db, COLLECTION_USER_DATA, 'removeBookmarkWrapper');
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
        const userExtraDataCollection = createCollection(db, COLLECTION_USER_DATA, 'addFollowWrapper');
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
        const userExtraDataCollection = createCollection(db, COLLECTION_USER_DATA, 'removeFollowWrapper');
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
        const userExtraDataCollection = createCollection(db, COLLECTION_USER_DATA, 'getUserExtraData');
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
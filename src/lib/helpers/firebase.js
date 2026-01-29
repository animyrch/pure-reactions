import {
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
    deleteField,
    orderBy,
    or,
    limit,
    startAfter,
    writeBatch
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
    COLLECTION_QUEUES,
    COLLECTION_YOUTUBE_CHANNEL_CLAIMS,
    COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS,
    app, db
} from "$lib/constants/firebase";
import { showToast } from '$lib/stores/toast';
import { SORTINGS } from '$lib/constants/sortings';
import { FILTERS } from '$lib/constants/filters';

export const auth = getAuth(app);

const createCollection = (db, params, caller) => {
    return collection(db, params);
};

export const firestoreDeleteField = () => deleteField();

export const slugifyQueueName = (value) =>
    (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

export const createReactionDocument = async ({
    originalVideoId,
    userId,
    originalVideoAuthor,
    originalVideoTitle,
    offsetStartTime
}) => {
    try {
        const reactorDisplayName = auth?.currentUser?.displayName?.trim?.() || '';
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'createReactionDocument');
        const dataToAdd = {
            originalVideoId,
            originalVideoAuthor,
            originalVideoTitle,
            reactionConfigs: {},
            playbackRateConfigs: {},
            reactorId: userId,
            reactorDisplayName,
            offsetStartTime,
            fullscreenPrimaryVideo: "original",
            fullscreenOverlayWidthPercent: 35,
            fullscreenOverlayCorner: "top-right",
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
            userId,
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

export const createQueueDocument = async ({ slug, title, description, items, userId }) => {
    const sanitizedSlug = slugifyQueueName(slug);
    if (!userId) {
        throw new Error('User must be logged in to create a queue.');
    }
    if (!sanitizedSlug) {
        throw new Error('Queue slug is required.');
    }

    const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'createQueueDocument');
    const queueRef = doc(queuesCollection, sanitizedSlug);

    try {
        const existingSnap = await getDoc(queueRef);
        const existingOwner = existingSnap?.data?.().ownerId;

        if (existingSnap.exists() && existingOwner && existingOwner !== userId) {
            throw new Error('You cannot overwrite a queue owned by another user.');
        }

        const payload = {
            slug: sanitizedSlug,
            title: title?.trim?.() || '',
            description: description?.trim?.() || '',
            items: Array.isArray(items) ? items : [],
            ownerId: userId,
            createdAt: existingSnap.exists() ? existingSnap.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(queueRef, payload, { merge: false });
        return sanitizedSlug;
    } catch (error) {
        console.error('Error creating queue document: ', error);
        throw error;
    }
};

export const buildYoutubeChannelClaimDocumentId = (youtubeChannelId, userId) => {
    const safeChannelId = (youtubeChannelId || '').trim();
    const safeUserId = (userId || '').trim();
    if (!safeChannelId || !safeUserId) return '';
    return `${safeChannelId}__${safeUserId}`;
};

export const getYoutubeChannelClaim = async ({ youtubeChannelId, userId }) => {
    const claimId = buildYoutubeChannelClaimDocumentId(youtubeChannelId, userId);
    if (!claimId) {
        return null;
    }
    if (!COLLECTION_YOUTUBE_CHANNEL_CLAIMS) {
        console.error('Missing COLLECTION_YOUTUBE_CHANNEL_CLAIMS env var.');
        return null;
    }
    try {
        const claimsCollection = createCollection(db, COLLECTION_YOUTUBE_CHANNEL_CLAIMS, 'getYoutubeChannelClaim');
        const claimRef = doc(claimsCollection, claimId);
        const claimSnapshot = await getDoc(claimRef);
        if (claimSnapshot.exists()) {
            return { id: claimSnapshot.id, ...claimSnapshot.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting youtube channel claim: ', error);
        return null;
    }
};

export const getYoutubeChannelVerification = async ({ youtubeChannelId }) => {
    const verificationId = (youtubeChannelId || '').trim();
    if (!verificationId) {
        return null;
    }
    const resolvedCollection =
        COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS ||
        (COLLECTION_YOUTUBE_CHANNEL_CLAIMS
            ? COLLECTION_YOUTUBE_CHANNEL_CLAIMS.replace('youtubeChannelClaims', 'youtubeChannelVerifications')
            : '');
    if (!resolvedCollection) {
        console.error('Missing COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS env var.');
        return null;
    }
    try {
        const verificationsCollection = createCollection(
            db,
            resolvedCollection,
            'getYoutubeChannelVerification'
        );
        const verificationRef = doc(verificationsCollection, verificationId);
        const verificationSnapshot = await getDoc(verificationRef);
        if (verificationSnapshot.exists()) {
            return { id: verificationSnapshot.id, ...verificationSnapshot.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting youtube channel verification: ', error);
        return null;
    }
};

export const createYoutubeChannelClaim = async ({
    youtubeChannelId,
    userId,
    youtubeChannelUrl,
    verificationToken,
    verificationVideoUrl,
    expiresAt
}) => {
    const claimId = buildYoutubeChannelClaimDocumentId(youtubeChannelId, userId);
    if (!claimId) {
        throw new Error('Missing youtubeChannelId or userId for claim creation.');
    }
    if (!COLLECTION_YOUTUBE_CHANNEL_CLAIMS) {
        throw new Error('Missing COLLECTION_YOUTUBE_CHANNEL_CLAIMS env var.');
    }

    try {
        const claimsCollection = createCollection(db, COLLECTION_YOUTUBE_CHANNEL_CLAIMS, 'createYoutubeChannelClaim');
        const claimRef = doc(claimsCollection, claimId);
        const payload = {
            userId,
            youtubeChannelId,
            youtubeChannelUrl: youtubeChannelUrl || '',
            verificationToken,
            verificationVideoUrl,
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: expiresAt || null
        };
        await setDoc(claimRef, payload, { merge: false });
        return { id: claimRef.id, ...payload };
    } catch (error) {
        console.error('Error creating youtube channel claim: ', error);
        throw error;
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

export const updateFirebaseDocument = async (dataToUpdate, documentId) => {
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'updateFirebaseDocument');
        const targetDocumentId = documentId || (typeof window !== 'undefined' ? window.currentReactionDocumentId : undefined);
        if (!targetDocumentId) {
            console.error('Error updating document: missing reaction document id');
            return false;
        }
        const documentRef = doc(reactionsCollection, targetDocumentId);
        await updateDoc(documentRef, dataToUpdate);
        return true;
    } catch (error) {
        console.error('Error updating document: ', error);
        return false;
    }
};

export const getAllReactions = async (sortBy, follows) => {
    let reactions = [];
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getAllReactions');
        let baseQuery = query(reactionsCollection,
            where('isPublished', '==', true),
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
            where('isPublished', '==', true),
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
            data: doc.data(),
            type: 'reaction'
        }));
    } catch (error) {
        console.error('Error getting paged documents: ', error);
    }
    return {
        reactions,
        lastVisible
    };
};

export const getQueuesByPage = async (lastDoc, limitBy, userId) => {
    let queues = [];
    let lastVisible = null;
    if (!userId) {
        return { queues: [], lastVisible: null };
    }
    try {
        const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'getQueuesByPage');
        let baseQuery = query(queuesCollection,
            where('ownerId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        if (lastDoc) {
            baseQuery = query(baseQuery, startAfter(lastDoc));
        }
        baseQuery = query(baseQuery, limit(limitBy));
        const querySnapshot = await getDocs(baseQuery);
        lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];
        queues = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data(),
            type: 'queue'
        }));
    } catch (error) {
        console.error('Error getting paged queue documents: ', error);
    }
    return {
        queues,
        lastVisible
    };
};

export const getUserReactions = async (userId, filter = FILTERS.ALL) => {
    let reactions = [];
    if (!userId) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getUserReactions');
        
        // Build query conditions
        const queryConditions = [
            where("reactorId", "==", userId),
            where("playlistId", "==", ""),
            orderBy('playlistId', 'desc'),
            orderBy('createdAt', 'desc')
        ];
        
        // Add published filter if specified
        if (filter === FILTERS.PUBLISHED) {
            queryConditions.push(where('isPublished', '==', true));
        } else if (filter === FILTERS.UNPUBLISHED) {
            queryConditions.push(where('isPublished', '==', false));
        }
        
        const baseQuery = query(reactionsCollection, ...queryConditions);
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

export const getQueueBySlug = async (slug, userId) => {
    if (!slug || !userId) {
        return null;
    }

    try {
        const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'getQueueBySlug');
        const queueRef = doc(queuesCollection, slug);
        const snapshot = await getDoc(queueRef);

        if (!snapshot.exists()) {
            return null;
        }

        const data = snapshot.data();
        if (data?.ownerId !== userId) {
            return null;
        }

        return {
            id: snapshot.id,
            data
        };
    } catch (error) {
        console.error('Error getting queue by slug: ', error);
        return null;
    }
};

export const getUserQueues = async (userId) => {
    if (!userId) return [];
    try {
        const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'getUserQueues');
        const queryRef = query(queuesCollection, where('ownerId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(queryRef);
        return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, data: docSnapshot.data(), type: 'queue' }));
    } catch (error) {
        console.error('Error fetching user queues: ', error);
        return [];
    }
};

export const upsertReactionIntoQueue = async ({ nameOrSlug, reactionId, userId, ownerName = '' }) => {
    const slugFromName = slugifyQueueName(nameOrSlug);
    if (!reactionId) {
        throw new Error('Reaction id missing.');
    }
    if (!userId) {
        throw new Error('User must be logged in to update queues.');
    }
    if (!slugFromName) {
        throw new Error('Queue name is required.');
    }

    const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'upsertReactionIntoQueue');
    const queueRef = doc(queuesCollection, slugFromName);

    try {
        const snap = await getDoc(queueRef);
        const existingData = snap.exists() ? snap.data() : {};
        const existingOwner = existingData?.ownerId;

        if (existingOwner && existingOwner !== userId) {
            throw new Error('You cannot modify a queue owned by another user.');
        }

        const existingItems = Array.isArray(existingData?.items) ? existingData.items : [];
        const alreadyIncluded = existingItems.some((item) => item?.type === 'reaction' && item?.id === reactionId);
        const nextItems = alreadyIncluded
            ? existingItems
            : [...existingItems, { type: 'reaction', id: reactionId }];

        const payload = {
            slug: slugFromName,
            title: existingData?.title || nameOrSlug,
            description: existingData?.description || '',
            items: nextItems,
            ownerId: userId,
            ownerName: (ownerName || existingData?.ownerName || '').trim(),
            createdAt: snap.exists() ? existingData?.createdAt || serverTimestamp() : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(queueRef, payload, { merge: false });
        return { slug: slugFromName, created: !snap.exists() };
    } catch (error) {
        console.error('Error adding reaction to queue: ', error);
        throw error;
    }
};

export const removeReactionFromQueue = async ({ queueSlug, reactionId, userId }) => {
    if (!reactionId) {
        throw new Error('Reaction id missing.');
    }
    if (!userId) {
        throw new Error('User must be logged in to update queues.');
    }
    if (!queueSlug) {
        throw new Error('Queue slug is required.');
    }

    const queuesCollection = createCollection(db, COLLECTION_QUEUES, 'removeReactionFromQueue');
    const queueRef = doc(queuesCollection, queueSlug);

    try {
        const snap = await getDoc(queueRef);
        if (!snap.exists()) {
            throw new Error('Queue not found.');
        }

        const existingData = snap.data();
        const existingOwner = existingData?.ownerId;

        if (existingOwner !== userId) {
            throw new Error('You cannot modify a queue owned by another user.');
        }

        const existingItems = Array.isArray(existingData?.items) ? existingData.items : [];
        const nextItems = existingItems.filter((item) => !(item?.type === 'reaction' && item?.id === reactionId));

        const payload = {
            ...existingData,
            items: nextItems,
            updatedAt: serverTimestamp()
        };

        await setDoc(queueRef, payload, { merge: false });
        return { slug: queueSlug };
    } catch (error) {
        console.error('Error removing reaction from queue: ', error);
        throw error;
    }
};


export const getUserPlaylists = async (userId, filter = FILTERS.ALL) => {
    let playlists = [];
    if (!userId) {
        return playlists;
    }
    try {
        const playlistsCollection = createCollection(db, COLLECTION_PLAYLISTS, 'getUserPlaylists');
        
        // Build query conditions - note: playlists don't have isPublished field
        // A playlist is considered published if any reaction in it is published
        const queryConditions = [
            where("userId", "==", userId),
            orderBy('createdAt', 'desc')
        ];
        
        const queryRef = query(playlistsCollection, ...queryConditions);
        const querySnapshot = await getDocs(queryRef);

        // Use Promise.all to handle asynchronous fetching for each playlist
        playlists = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
            const playlistData = docSnapshot.data();
            let firstReactionBinomeData = null;
            let hasPublishedReaction = false;

            // Check if reactionBinomeIds exists and has at least one element
            if (playlistData.reactionBinomeIds && playlistData.reactionBinomeIds.length > 0) {
                // Firestore 'in' queries are limited to 10 items, so we batch if needed
                const batchSize = 10;
                const reactionIds = playlistData.reactionBinomeIds;
                const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getUserPlaylists_reactions');
                
                // Process reactions in batches of 10
                for (let i = 0; i < reactionIds.length; i += batchSize) {
                    const batchIds = reactionIds.slice(i, i + batchSize);
                    const reactionsQuery = query(
                        reactionsCollection,
                        where('__name__', 'in', batchIds)
                    );
                    const reactionsSnapshot = await getDocs(reactionsQuery);
                    
                    reactionsSnapshot.docs.forEach(doc => {
                        const reactionData = doc.data();
                        if (!firstReactionBinomeData) {
                            firstReactionBinomeData = reactionData;
                        }
                        if (reactionData.isPublished) {
                            hasPublishedReaction = true;
                        }
                    });
                    
                    // Early exit optimization: if we found a published reaction and we're filtering for published,
                    // and we already have display data, we can stop
                    if (hasPublishedReaction && filter === FILTERS.PUBLISHED && firstReactionBinomeData) {
                        break;
                    }
                }
            }

            // Apply filter based on whether playlist has published/unpublished reactions
            // A playlist is "published" if it has at least one published reaction
            // A playlist is "unpublished" if it has no published reactions
            if (filter === FILTERS.PUBLISHED && !hasPublishedReaction) {
                return null; // Exclude this playlist
            }
            if (filter === FILTERS.UNPUBLISHED && hasPublishedReaction) {
                return null; // Exclude this playlist
            }

            // Return a new object that includes the playlist data and the first reaction binome data
            return {
                id: docSnapshot.id,
                data: playlistData,
                firstReactionBinomeData
            };
        }));

        // Filter out null entries
        return playlists.filter(p => p !== null);
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
            where('isPublished', '==', true),
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
            where('isPublished', '==', true),
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

export const getReactionsByUserId = async (userId) => {
    let reactions = [];
    if (!userId) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsByUserId');
        const queryRef = query(reactionsCollection,
            where("reactorId", "==", userId),
            where('isPublished', '==', true),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(queryRef);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data(),
            type: 'reaction'
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting user reactions: ', error);
    }
};
export const getReactionsToOriginalVideo = async (originalVideoId, exceptReactionVideoId) => {
    let reactions = [];
    if (!originalVideoId) {
        return reactions;
    }
    try {
        const reactionsCollection = createCollection(db, COLLECTION_REACTION_BINOMES, 'getReactionsToOriginalVideo');
        // Note: This function uses where('reactionVideoId', '!=', exceptReactionVideoId) to exclude a specific reaction.
        // Due to Firestore constraints, inequality filters require ordering by the same field first.
        // Unlike the home page queries, this is intentional here to exclude the current reaction being viewed.
        const queryRef = query(reactionsCollection,
            where("originalVideoId", "==", originalVideoId),
            where('isPublished', '==', true),
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
            }
        }
        return reactions;
    } catch (error) {
        console.error('Error getting documents filtered by reaction video ids: ', error);
        return [];
    }
};

export const createUserWithEmailAndPasswordWrapper = async (email, password) => {
    let successful = false;
    try {
        const userCreds = await createUserWithEmailAndPassword(auth, email, password)
        const emailPrefix = typeof email === 'string' ? email.split('@')[0].trim() : '';
        if (emailPrefix) {
            try {
                await updateProfile(userCreds.user, { displayName: emailPrefix });
            } catch (error) {
                console.error('Failed to set fallback display name:', error);
            }
        }
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

export const updateReactorDisplayNameForUser = async ({ userId, displayName }) => {
    const trimmedName = typeof displayName === 'string' ? displayName.trim() : '';
    if (!userId || !trimmedName) {
        return { updated: 0, skipped: true };
    }
    try {
        const reactionsCollection = createCollection(
            db,
            COLLECTION_REACTION_BINOMES,
            'updateReactorDisplayNameForUser'
        );
        const queryRef = query(reactionsCollection, where('reactorId', '==', userId));
        const snapshot = await getDocs(queryRef);
        if (snapshot.empty) {
            return { updated: 0 };
        }

        const docs = snapshot.docs;
        const batchSize = 500;
        let updated = 0;

        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach((docSnap) => {
                const docRef = doc(reactionsCollection, docSnap.id);
                batch.update(docRef, { reactorDisplayName: trimmedName });
            });
            await batch.commit();
            updated += chunk.length;
        }

        return { updated };
    } catch (error) {
        console.error('Error updating reactor display name in reactions:', error);
        return { updated: 0, error: true };
    }
};
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

// userExtraDataStore.js
import { writable } from 'svelte/store';
import {
    getUserExtraData,
    addBookmarkWrapper,
    removeBookmarkWrapper,
    addFollowWrapper,
    removeFollowWrapper,
    markWalkalongClueSeen,
} from '$lib/helpers/firebase';
import { handlePrivateRoute } from '$lib/helpers/routing';

const createUserExtraDataStore = () => {
  const { subscribe, set } = writable({
    userExtraData: null,
  });

  return {
    subscribe,
    fetchUserData: async (userId) => {
      try {
        const userExtraDataFetched = await getUserExtraData(userId);
        set({
            userExtraData: userExtraDataFetched,
        });
      } catch (error) {
        console.error("Error fetching user data: ", error);
      }
    },
    addBookmark: async (userExtraData, userId, reactionBinomeId) => {
        if (!userId) {
            handlePrivateRoute();
            return;
        }
        try {
            const userBookmarks = userExtraData?.bookmarks ? [...userExtraData.bookmarks] : [];
            if (!userBookmarks.includes(reactionBinomeId)) {
                userBookmarks.push(reactionBinomeId);
                set({
                    userExtraData: {
                    ...userExtraData,
                    bookmarks: userBookmarks,
                    },
                });
                await addBookmarkWrapper(userId, reactionBinomeId);
            } else {
                console.log("Bookmark already exists for this user");
            }
        } catch (error) {
            console.error("Error adding user bookmarks: ", error);
        }
    },
    removeBookmark: async (userExtraData, userId, reactionBinomeId) => {
        if (!userId) {
            handlePrivateRoute();
            return;
        }
        try {
            let userBookmarks = userExtraData?.bookmarks ? [...userExtraData.bookmarks] : [];
            if (userBookmarks.includes(reactionBinomeId)) {
                userBookmarks = userBookmarks.filter(currentReactionBinomeId => currentReactionBinomeId !== reactionBinomeId);
                set({
                    userExtraData: {
                    ...userExtraData,
                    bookmarks: userBookmarks,
                    },
                });
                await removeBookmarkWrapper(userId, reactionBinomeId);
            } else {
                console.log("Bookmark does not exist for this user");
            }
        } catch (error) {
            console.error("Error removing user bookmarks: ", error);
        }
    },
    addFollow: async (userExtraData, userId, reactorId) => {
        if (!userId) {
            handlePrivateRoute();
            return;
        }
        try {
            const userFollows = userExtraData?.follows ? [...userExtraData.follows] : [];
            if (!userFollows.includes(reactorId) && userId !== reactorId) {
                userFollows.push(reactorId);
                set({
                    userExtraData: {
                    ...userExtraData,
                    follows: userFollows,
                    },
                });
                await addFollowWrapper(userId, reactorId);
            } else {
                console.log("Follow already exists for this user");
            }
        } catch (error) {
            console.error("Error adding user follows: ", error);
        }
    },
    removeFollow: async (userExtraData, userId, reactorId) => {
        if (!userId) {
            handlePrivateRoute();
            return;
        }
        try {
            let userFollows = userExtraData?.follows ? [...userExtraData.follows] : [];
            if (userFollows.includes(reactorId)) {
                userFollows = userFollows.filter(currentReactorId => currentReactorId !== reactorId);
                set({
                    userExtraData: {
                    ...userExtraData,
                    follows: userFollows,
                    },
                });
                await removeFollowWrapper(userId, reactorId);
            } else {
                console.log("Follow does not exist for this user");
            }
        } catch (error) {
            console.error("Error removing user follows: ", error);
        }
    },
    /**
     * Mark a walkalong clue as seen both in the store and in Firestore.
     * Call this when a clue is dismissed (not when it first appears).
     *
     * @param {object} userExtraData - current store value
     * @param {string} userId
     * @param {string} clueId
     */
    markClueSeen: async (userExtraData, userId, clueId) => {
        if (!userId || !clueId) return;
        const seen = userExtraData?.seenWalkalongClues ? [...userExtraData.seenWalkalongClues] : [];
        if (!seen.includes(clueId)) {
            seen.push(clueId);
            set({
                userExtraData: {
                    ...userExtraData,
                    seenWalkalongClues: seen,
                },
            });
        }
        await markWalkalongClueSeen(userId, clueId);
    },
  };
};

export const userExtraDataStore = createUserExtraDataStore();

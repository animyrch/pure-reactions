// userExtraDataStore.js
import { writable } from 'svelte/store';
import {
    getUserExtraData,
    addBookmarkWrapper,
    removeBookmarkWrapper,
    addFollowWrapper,
    removeFollowWrapper
} from '$lib/helpers/firebase';

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
  };
};

export const userExtraDataStore = createUserExtraDataStore();

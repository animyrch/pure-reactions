import { writable } from 'svelte/store';

const createInitialState = () => ({
  isActive: false,
  isUsersOwnVideo: false,
  canShowEditModeButton: false,
  canShowCloseEditModeButton: false,
  isPublished: false,
  isReactionMissing: false,
  isFullscreen: false,
  canShowEditPlaylistButton: false,
  handlers: {
    enterEditMode: null,
    closeEditMode: null,
    setIsPublished: null,
    setIsUnpublished: null,
    openWithFullscreen: null,
    openWithHalfscreen: null
  }
});

function createReactionDialStore() {
  const { subscribe, set, update } = writable(createInitialState());

  return {
    subscribe,
    setContext(payload = {}) {
      const nextHandlers = {
        ...createInitialState().handlers,
        ...(payload.handlers ?? {})
      };

      set({
        ...createInitialState(),
        ...payload,
        handlers: nextHandlers,
        isActive: true
      });
    },
    updateContext(payload = {}) {
      update((current) => {
        const nextHandlers = {
          ...current.handlers,
          ...(payload.handlers ?? {})
        };

        return {
          ...current,
          ...payload,
          handlers: nextHandlers,
          isActive: true
        };
      });
    },
    reset() {
      set(createInitialState());
    }
  };
}

export const reactionDial = createReactionDialStore();

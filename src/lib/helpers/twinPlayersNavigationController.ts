import { goto } from '$app/navigation';
import { getPlaylist, getQueueBySlug, getReaction } from '$lib/helpers/firebase';
import { writePlaylistProgress } from '$lib/helpers/playlistProgress';
import { writeQueueProgress } from '$lib/helpers/queueProgress';
import {
  findPlaylistCurrentIndex,
  getPlaylistSequenceItems,
  toPlaylistQueueItem,
} from '$lib/helpers/reactionSequence';
import { writeAutoPlayCookie } from '$lib/helpers/reactionPlayer';
import type { TwinPlayersState } from '$lib/helpers/twinPlayersStateController';
import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';

type LoadReactionInPlaceOptions = {
  preserveReactionTime?: boolean;
  autoPlay?: boolean;
};

type TwinPlayersDebugClickGate = (
  label: string,
  details?: Record<string, any>,
  includeStack?: boolean
) => void;

type TwinPlayersLog = (message: string, data?: any) => void;

type CreateTwinPlayersNavigationControllerOptions = {
  getSnapshot: () => TwinPlayersState;
  updateState: (patch: Partial<TwinPlayersState>) => void;
  userId?: string | null;
  setUpVideos: (reactionData: any) => Promise<void>;
  loadReactionInPlace: (nextReactionDocumentId: string, options?: LoadReactionInPlaceOptions) => Promise<void>;
  onResetStandaloneTransition: (params: { nextReactionDocumentId: string; source: 'playlist' | 'queue' }) => void;
  debugClickGate: TwinPlayersDebugClickGate;
  log: TwinPlayersLog;
};

export function createTwinPlayersNavigationController({
  getSnapshot,
  updateState,
  userId,
  setUpVideos,
  loadReactionInPlace,
  onResetStandaloneTransition,
  debugClickGate,
  log
}: CreateTwinPlayersNavigationControllerOptions) {
  let playlistFetchPromise: Promise<void> | undefined;
  let buildInterfaceSeq = 0;

  const updateUIElements = (slugValue: string) => {
    updateState({ pageSlug: slugValue });
    if (typeof window !== 'undefined') {
      (window as any).currentReactionDocumentId = slugValue;
    }
  };

  const toggleAutoPlaylist = () => {
    const snapshot = getSnapshot();
    const nextValue = !snapshot.isPlaylistAutoPlay;
    updateState({ isPlaylistAutoPlay: nextValue });
    writeAutoPlayCookie(nextValue, snapshot.playlistDocumentId);
  };

  const setPlaylistData = async (
    playlistId: string | null | undefined,
    youtubePlaylistId?: string,
    currentReactionDocumentId?: string,
    currentOriginalVideoId?: string,
  ) => {
    if (!playlistId) {
      updateState({ playlistItems: [], playlistDocument: undefined, hasNextIndexInPlaylist: false });
      return;
    }

    playlistFetchPromise = (async () => {
      const playlistDocument = await getPlaylist(playlistId);
      const snapshot = getSnapshot();
      const sequenceItems = getPlaylistSequenceItems(playlistDocument);
      if (sequenceItems.length) {
        const playlistItems = sequenceItems.map((item: any, index: number) => toPlaylistQueueItem(item, index));
        const currentIndex = findPlaylistCurrentIndex({
          playlistDocument,
          reactionDocumentId: currentReactionDocumentId ?? snapshot.pageSlug,
          originalVideoId: currentOriginalVideoId ?? snapshot.originalVideoId,
        });
        updateState({
          playlistItems,
          playlistDocument,
          hasNextIndexInPlaylist: currentIndex >= 0 && currentIndex < playlistItems.length - 1,
          currentIndexInPlaylist: currentIndex >= 0 ? currentIndex : 0
        });
        return;
      }

      if (!youtubePlaylistId) {
        updateState({ playlistItems: [], playlistDocument, hasNextIndexInPlaylist: false, currentIndexInPlaylist: 0 });
        return;
      }

      const playlistItems = await fetchFirstPlaylistVideos(youtubePlaylistId);
      const filteredItems = playlistItems.filter((item: any) =>
        playlistDocument.originalVideoIds.includes(item.snippet.resourceId.videoId)
      );
      const targetOriginalVideoId = currentOriginalVideoId ?? snapshot.originalVideoId;
      const currentIndex = filteredItems.findIndex(
        (item: any) => item.snippet.resourceId.videoId === targetOriginalVideoId
      );

      updateState({
        playlistItems: filteredItems,
        playlistDocument,
        hasNextIndexInPlaylist: currentIndex < filteredItems.length - 1,
        currentIndexInPlaylist: currentIndex
      });
    })();

    await playlistFetchPromise;
  };

  const setPlaylistDocumentId = async (playlistDocumentId: string | null) => {
    updateState({ playlistDocumentId });
    const snapshot = getSnapshot();
    await setPlaylistData(
      playlistDocumentId,
      snapshot.youtubePlaylistId,
      snapshot.pageSlug,
      snapshot.originalVideoId,
    );
  };

  const buildInterface = async (slugValue: string, { isUpdate = false }: { isUpdate?: boolean } = {}) => {
    const seq = (buildInterfaceSeq += 1);
    debugClickGate('[TwinPlayers] buildInterface start', { seq, slugValue, isUpdate }, true);

    if (typeof window !== 'undefined') {
      (window as any).currentReactionDocumentId = slugValue;
    }

    const reaction = await getReaction(slugValue);
    await setUpVideos(reaction);

    if (isUpdate) {
      updateUIElements(slugValue);
    }

    debugClickGate('[TwinPlayers] buildInterface done', { seq, slugValue, isUpdate });

    try {
      const snapshot = getSnapshot();
      if (typeof window !== 'undefined' && userId && snapshot.queueSlug) {
        writeQueueProgress(userId, snapshot.queueSlug, {
          reactionId: slugValue,
          index: Number(snapshot.queueIndex) || 0
        });
      }
    } catch (error) {
      console.warn('[TwinPlayers] failed to persist queue progress', error);
    }
  };

  const setPlaylistSelectionIndex = (index: number) => {
    const snapshot = getSnapshot();
    const totalFromDoc = Array.isArray(snapshot.playlistDocument?.reactionBinomeIds)
      ? snapshot.playlistDocument.reactionBinomeIds.length
      : 0;
    const totalFromItems = Array.isArray(snapshot.playlistItems) ? snapshot.playlistItems.length : 0;
    const total = Math.max(totalFromDoc, totalFromItems);

    if (!total) {
      updateState({ currentIndexInPlaylist: 0, hasNextIndexInPlaylist: false });
      return;
    }

    const clamped = Math.max(0, Math.min(total - 1, Math.trunc(Number(index) || 0)));
    updateState({
      currentIndexInPlaylist: clamped,
      hasNextIndexInPlaylist: clamped < total - 1
    });
  };

  const loadNextReactionInPlaylist = () => {
    const snapshot = getSnapshot();
    const { hasNextIndexInPlaylist, playlistDocument, currentIndexInPlaylist, playlistItems } = snapshot;
    if (!hasNextIndexInPlaylist || !playlistDocument) {
      return;
    }

    const nextIndex = currentIndexInPlaylist + 1;
    const nextReactionDocumentId = playlistDocument.reactionBinomeIds[nextIndex];

    if (
      nextReactionDocumentId === snapshot.pageSlug ||
      (typeof window !== 'undefined' && (window as any).currentReactionDocumentId === nextReactionDocumentId)
    ) {
      return;
    }

    const isPlaylistPage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/playlist/');
    const sequenceItems = getPlaylistSequenceItems(playlistDocument);
    const currentSequenceItem = sequenceItems[currentIndexInPlaylist];
    const nextSequenceItem = sequenceItems[nextIndex];
    const shouldPreserveReactionTime = Boolean(
      currentSequenceItem &&
      nextSequenceItem &&
      currentSequenceItem.originalVideoId === nextSequenceItem.originalVideoId &&
      currentSequenceItem.originalVideoPlatform === nextSequenceItem.originalVideoPlatform,
    );

    if (isPlaylistPage) {
      const nextOriginalVideoId = nextSequenceItem?.originalVideoId || playlistDocument.originalVideoIds?.[nextIndex];
      if (typeof nextOriginalVideoId === 'string' && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('item', nextOriginalVideoId);
        window.history.pushState(window.history.state, '', url.toString());
      }

      if (typeof window !== 'undefined' && userId && snapshot.playlistDocumentId) {
        writePlaylistProgress(userId, snapshot.playlistDocumentId, {
          reactionId: nextReactionDocumentId,
          index: nextIndex
        });
      }

      loadReactionInPlace(nextReactionDocumentId, {
        preserveReactionTime: shouldPreserveReactionTime,
        autoPlay: true
      }).then(() => {
        const updatedIndex = nextIndex;
        const hasNext = updatedIndex < playlistItems.length - 1;
        updateState({
          currentIndexInPlaylist: updatedIndex,
          hasNextIndexInPlaylist: hasNext
        });
      });
      return;
    }

    buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
      const updatedIndex = nextIndex;
      const hasNext = updatedIndex < playlistItems.length - 1;
      updateState({
        currentIndexInPlaylist: updatedIndex,
        hasNextIndexInPlaylist: hasNext
      });
      if (typeof window !== 'undefined' && userId) {
        writePlaylistProgress(userId, playlistSlug, {
          reactionId: nextReactionDocumentId,
          index: nextIndex
        });
      }
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.pathname = `/reaction/${nextReactionDocumentId}`;
        window.history.pushState(window.history.state, '', url.toString());
      }
      onResetStandaloneTransition({ nextReactionDocumentId, source: 'playlist' });
    });
  };

  const getNextReactionIdInQueue = async (queueSlug: string, nextIndex: number) => {
    if (!userId) {
      return null;
    }
    const queueDefinition = await getQueueBySlug(queueSlug, userId);
    const items = Array.isArray(queueDefinition?.data?.items) ? queueDefinition.data.items : [];
    if (!items.length) {
      return null;
    }

    const queue: string[] = [];
    for (const item of items) {
      if (item?.type === 'reaction' && item?.id) {
        queue.push(item.id);
        continue;
      }
      if (item?.type === 'playlist' && item?.id) {
        const playlistDoc = await getPlaylist(item.id);
        const ids = Array.isArray(playlistDoc?.reactionBinomeIds) ? playlistDoc.reactionBinomeIds : [];
        ids.filter(Boolean).forEach((reactionId: string) => queue.push(reactionId));
      }
    }

    return typeof queue[nextIndex] === 'string' ? queue[nextIndex] : null;
  };

  const getNextReactionIdInAdHocQueue = (adHocQueue: string[], nextIndex: number) => {
    return typeof adHocQueue[nextIndex] === 'string' ? adHocQueue[nextIndex] : null;
  };

  const hasNextInQueue = async () => {
    const snapshot = getSnapshot();

    // Handle ad-hoc queue
    if (snapshot.adHocQueue && snapshot.adHocQueue.length) {
      const nextIndex = (Number(snapshot.adHocQueueIndex) || 0) + 1;
      return Boolean(getNextReactionIdInAdHocQueue(snapshot.adHocQueue, nextIndex));
    }

    // Handle regular queue
    if (!snapshot.queueSlug) {
      return false;
    }
    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    const nextId = await getNextReactionIdInQueue(snapshot.queueSlug, nextIndex);
    return Boolean(nextId);
  };

  const navigateToNextReactionInQueue = async () => {
    const snapshot = getSnapshot();

    // Handle ad-hoc queue
    if (snapshot.adHocQueue && snapshot.adHocQueue.length) {
      const nextIndex = (Number(snapshot.adHocQueueIndex) || 0) + 1;
      const nextReactionDocumentId = getNextReactionIdInAdHocQueue(snapshot.adHocQueue, nextIndex);
      if (!nextReactionDocumentId) {
        return { ok: false as const, reason: 'end-of-queue' as const };
      }

      const url = new URL(typeof window !== 'undefined' ? window.location.href : 'https://purereactions.com');
      url.pathname = `/reaction/${nextReactionDocumentId}`;
      url.searchParams.set('adHocQueue', JSON.stringify(snapshot.adHocQueue));
      url.searchParams.set('adHocQueueIndex', String(nextIndex));
      url.searchParams.set('queueAutoPlay', 'true');
      url.searchParams.delete('isFullscreen');
      await goto(url.pathname + url.search);
      return { ok: true as const, reason: 'navigated' as const };
    }

    // Handle regular queue
    const queueSlug = snapshot.queueSlug;
    if (!queueSlug) {
      return { ok: false as const, reason: 'missing-queue' as const };
    }

    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    const nextReactionDocumentId = await getNextReactionIdInQueue(queueSlug, nextIndex);
    if (!nextReactionDocumentId) {
      return { ok: false as const, reason: 'end-of-queue' as const };
    }

    if (typeof window !== 'undefined' && userId) {
      writeQueueProgress(userId, queueSlug, { reactionId: nextReactionDocumentId, index: nextIndex });
    }

    const url = new URL(typeof window !== 'undefined' ? window.location.href : 'https://purereactions.com');
    url.pathname = `/reaction/${nextReactionDocumentId}`;
    url.searchParams.set('queueSlug', queueSlug);
    url.searchParams.set('queueIndex', String(nextIndex));
    url.searchParams.set('queueReactionId', nextReactionDocumentId);
    url.searchParams.set('queueAutoPlay', 'true');
    url.searchParams.delete('isFullscreen');
    await goto(url.pathname + url.search);
    return { ok: true as const, reason: 'navigated' as const };
  };

  const loadNextReactionInQueue = () => {
    const snapshot = getSnapshot();

    // Handle ad-hoc queue
    if (snapshot.adHocQueue && snapshot.adHocQueue.length && snapshot.isQueueAutoPlay) {
      const nextIndex = (Number(snapshot.adHocQueueIndex) || 0) + 1;
      const nextReactionDocumentId = getNextReactionIdInAdHocQueue(snapshot.adHocQueue, nextIndex);
      if (!nextReactionDocumentId) {
        return;
      }

      buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
        updateState({ adHocQueueIndex: nextIndex });
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.pathname = `/reaction/${nextReactionDocumentId}`;
          url.searchParams.set('adHocQueue', JSON.stringify(snapshot.adHocQueue));
          url.searchParams.set('adHocQueueIndex', String(nextIndex));
          url.searchParams.set('queueAutoPlay', 'true');
          window.history.pushState(window.history.state, '', url.toString());
        }
        onResetStandaloneTransition({ nextReactionDocumentId, source: 'queue' });
      });
      return;
    }

    // Handle regular queue
    const queueSlug = snapshot.queueSlug;
    if (!snapshot.isQueueAutoPlay || !queueSlug) {
      return;
    }

    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    getNextReactionIdInQueue(queueSlug, nextIndex)
      .then((nextReactionDocumentId) => {
        if (!nextReactionDocumentId) {
          return;
        }

        buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
          updateState({ queueIndex: nextIndex });
          if (typeof window !== 'undefined' && userId) {
            writeQueueProgress(userId, queueSlug, { reactionId: nextReactionDocumentId, index: nextIndex });
          }
          if (typeof window !== 'undefined' && userId && getSnapshot().playlistDocumentId) {
            writePlaylistProgress(userId, getSnapshot().playlistDocumentId as string, {
              reactionId: nextReactionDocumentId,
              index: nextIndex
            });
          }
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.pathname = `/reaction/${nextReactionDocumentId}`;
            url.searchParams.set('queueSlug', queueSlug);
            url.searchParams.set('queueIndex', String(nextIndex));
            url.searchParams.set('queueReactionId', nextReactionDocumentId);
            url.searchParams.set('queueAutoPlay', 'true');
            window.history.pushState(window.history.state, '', url.toString());
          }
          onResetStandaloneTransition({ nextReactionDocumentId, source: 'queue' });
        });
      })
      .catch((error) => {
        console.error('Failed to load next reaction in queue', error);
      });
  };

  const handleSlugChange = async (nextSlug: string) => {
    const snapshot = getSnapshot();
    if (nextSlug === snapshot.pageSlug) {
      return;
    }

    updateState({ pageSlug: nextSlug });
    await buildInterface(nextSlug, { isUpdate: false });
  };

  return {
    buildInterface,
    toggleAutoPlaylist,
    setPlaylistData,
    setPlaylistDocumentId,
    setPlaylistSelectionIndex,
    loadNextReactionInPlaylist,
    hasNextInQueue,
    navigateToNextReactionInQueue,
    loadNextReactionInQueue,
    handleSlugChange,
  };
}
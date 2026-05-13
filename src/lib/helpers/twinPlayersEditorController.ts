import { firestoreDeleteField, requestReactionEnrichment, updateFirebaseDocument } from '$lib/helpers/firebase';
import {
  normalizeFullscreenOverlayCorner,
  normalizeFullscreenOverlayWidthPercent,
  normalizeFullscreenPrimaryVideo,
  type FullscreenOverlayCorner,
  type FullscreenPrimaryVideo
} from '$lib/helpers/twinPlayersReactionData';
import {
  buildPlayerEventTimeline,
  overlayVisibilityTimelineArrayToMap,
  type OverlayPrimaryVideo,
  playbackTimelineArrayToMap,
  roundPlaybackRate,
  roundReactionTime,
  roundTargetTime,
  roundVolume,
  timelineArrayToMap,
  volumeTimelineArrayToMap
} from '$lib/helpers/twinPlayersTimeline';
import type { TwinPlayersState } from '$lib/helpers/twinPlayersStateController';
import { downloadBasicVideoDetails, extractYouTubeVideoId } from '$lib/helpers/youtube';

type CreatePlayerConfigParams = {
  timeInReaction: number;
  targetTime: number;
  state: number;
};

type CreateVolumeConfigParams = {
  timeInReaction: number;
  volume: number;
};

type CreateReactionVolumeConfigParams = {
  timeInReaction: number;
  volume: number;
};

type CreatePlaybackRateConfigParams = {
  timeInReaction: number;
  rate: number;
};

type DeletePlayerConfigParams = {
  timeInReaction: number;
};

type DeletePlaybackRateConfigParams = {
  timeInReaction: number;
};

type DeleteReactionVolumeConfigParams = {
  timeInReaction: number;
};

type DeleteVolumeConfigParams = {
  timeInReaction: number;
};

type UpdatePlayerConfigParams = {
  timeInReaction: number;
  targetTime?: number;
  state?: number;
  previousTimeInReaction?: number;
};

type UpdatePlaybackRateConfigParams = {
  timeInReaction: number;
  rate?: number;
  previousTimeInReaction?: number;
};

type UpdateReactionVolumeConfigParams = {
  timeInReaction: number;
  volume?: number;
  previousTimeInReaction?: number;
};

type UpdateVolumeConfigParams = {
  timeInReaction: number;
  volume?: number;
  previousTimeInReaction?: number;
};

type UpdateOverlayVisibilityConfigParams = {
  timeInReaction: number;
  visible: boolean;
  primary: OverlayPrimaryVideo;
  previousTimeInReaction: number;
};

type CreateTwinPlayersEditorControllerOptions = {
  getSnapshot: () => TwinPlayersState;
  updateState: (patch: Partial<TwinPlayersState>) => void;
  seekReactionTo: (seconds: number) => void;
  enforceReactionMuteMode: (eventState?: number) => void;
};

const getBasicDetailsReaction = async (videoId: string) => {
  const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
  return { videoAuthor, videoTitle };
};

export function createTwinPlayersEditorController({
  getSnapshot,
  updateState,
  seekReactionTo,
  enforceReactionMuteMode
}: CreateTwinPlayersEditorControllerOptions) {
  const performPostSaveRewind = (referenceTime: number) => {
    const snapshot = getSnapshot();
    if (!snapshot.isFineTuneModeOn) {
      return;
    }

    if (!Number.isFinite(referenceTime)) {
      return;
    }

    seekReactionTo(referenceTime - 5);
  };

  const persistPlayerTimelineMap = async (
    map: Map<string, { t: number; state: number; targetTime: number }>,
    referenceTime: number
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextPlayerConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          state: Number(entry.state),
          time: Number(entry.targetTime ?? 0).toFixed(2)
        }
      ])
    );

    await updateFirebaseDocument({
      stateTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        state: Number(entry.state),
        targetTime: Number(entry.targetTime ?? 0)
      })),
      reactionConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).playerConfigs = normalizedTimeline;
    }

    updateState({
      stateTimeline: normalizedTimeline,
      playerConfigs: nextPlayerConfigs,
      playerEventTimeline: buildPlayerEventTimeline(normalizedTimeline)
    });

    performPostSaveRewind(referenceTime);
  };

  const persistVolumeTimelineMap = async (
    map: Map<string, { t: number; volume: number }>,
    referenceTime: number
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextVolumeConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          volume: roundVolume(Number(entry.volume ?? 100))
        }
      ])
    );

    await updateFirebaseDocument({
      volumeTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        volume: roundVolume(Number(entry.volume ?? 100))
      })),
      volumeConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).volumeConfigs = normalizedTimeline;
    }

    updateState({
      volumeTimeline: normalizedTimeline,
      volumeConfigs: nextVolumeConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistReactionVolumeTimelineMap = async (
    map: Map<string, { t: number; volume: number }>,
    referenceTime: number
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextVolumeConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          volume: roundVolume(Number(entry.volume ?? 100))
        }
      ])
    );

    await updateFirebaseDocument({
      reactionVolumeTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        volume: roundVolume(Number(entry.volume ?? 100))
      })),
      reactionVolumeConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).reactionVolumeConfigs = normalizedTimeline;
    }

    updateState({
      reactionVolumeTimeline: normalizedTimeline,
      reactionVolumeConfigs: nextVolumeConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistPlaybackTimelineMap = async (
    map: Map<string, { t: number; rate: number }>,
    referenceTime: number
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextPlaybackRateConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          rate: roundPlaybackRate(Number(entry.rate ?? 1))
        }
      ])
    );

    await updateFirebaseDocument({
      playbackTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        rate: roundPlaybackRate(Number(entry.rate ?? 1))
      })),
      playbackRateConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).playbackRateConfigs = normalizedTimeline;
    }

    updateState({
      playbackRateTimeline: normalizedTimeline,
      playbackRateConfigs: nextPlaybackRateConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistOverlayVisibilityTimelineMap = async (
    map: Map<string, { t: number; visible: boolean; primary: OverlayPrimaryVideo }>,
    referenceTime: number
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);

    await updateFirebaseDocument({
      overlayVisibilityTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        visible: typeof entry.visible === 'boolean' ? entry.visible : true,
        primary: entry.primary === 'reaction' ? 'reaction' : 'original'
      }))
    });

    if (typeof window !== 'undefined') {
      (window as any).overlayVisibilityTimeline = normalizedTimeline;
    }

    updateState({
      overlayVisibilityTimeline: normalizedTimeline
    });

    performPostSaveRewind(referenceTime);
  };

  const setReactionVideoId = async (value: string) => {
    const cleanedId = extractYouTubeVideoId(value);
    const { videoAuthor, videoTitle } = await getBasicDetailsReaction(cleanedId);
    await updateFirebaseDocument({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
    updateState({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
  };

  const setOffsetStartTime = async (value: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const clamped = Math.max(0, parsed);
    const rounded = Math.round(clamped * 10) / 10;
    const snapshot = getSnapshot();
    const oldStart = snapshot.offsetStartTime;

    await updateFirebaseDocument({ offsetStartTime: rounded });
    updateState({ offsetStartTime: rounded, reactionCurrentTime: rounded });

    if (rounded <= oldStart) {
      return;
    }

    const oldKey = roundReactionTime(oldStart).toFixed(3);
    const newKey = roundReactionTime(rounded).toFixed(3);

    const playerMap = timelineArrayToMap(snapshot.stateTimeline);
    if (playerMap.has(oldKey) && !playerMap.has(newKey)) {
      const entry = playerMap.get(oldKey)!;
      entry.t = rounded;
      playerMap.set(newKey, entry);
      playerMap.delete(oldKey);
      await persistPlayerTimelineMap(playerMap, rounded);
    }

    const volumeMap = volumeTimelineArrayToMap(snapshot.volumeTimeline);
    if (volumeMap.has(oldKey) && !volumeMap.has(newKey)) {
      const entry = volumeMap.get(oldKey)!;
      entry.t = rounded;
      volumeMap.set(newKey, entry);
      volumeMap.delete(oldKey);
      await persistVolumeTimelineMap(volumeMap, rounded);
    }

    const reactionVolumeMap = volumeTimelineArrayToMap(snapshot.reactionVolumeTimeline);
    if (reactionVolumeMap.has(oldKey) && !reactionVolumeMap.has(newKey)) {
      const entry = reactionVolumeMap.get(oldKey)!;
      entry.t = rounded;
      reactionVolumeMap.set(newKey, entry);
      reactionVolumeMap.delete(oldKey);
      await persistReactionVolumeTimelineMap(reactionVolumeMap, rounded);
    }

    const playbackMap = playbackTimelineArrayToMap(snapshot.playbackRateTimeline);
    if (playbackMap.has(oldKey) && !playbackMap.has(newKey)) {
      const entry = playbackMap.get(oldKey)!;
      entry.t = rounded;
      playbackMap.set(newKey, entry);
      playbackMap.delete(oldKey);
      await persistPlaybackTimelineMap(playbackMap, rounded);
    }
  };

  const setIntroBufferTime = async (value: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    await updateFirebaseDocument({ timeOffset: parsed });
    updateState({ timeOffset: parsed, introBufferTime: parsed });
  };

  const setReactionFinishTime = async (value: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    const snapshot = getSnapshot();
    let finalValue = parsed;
    if (Number.isFinite(snapshot.reactionDuration) && snapshot.reactionDuration > 0) {
      finalValue = Math.min(finalValue, snapshot.reactionDuration);
    }

    await updateFirebaseDocument({ reactionFinishTime: finalValue });
    updateState({ reactionFinishTime: finalValue });
  };

  const setSoundLevel = async (value: number) => {
    const gain = Number(value) / 100;
    await updateFirebaseDocument({ globalGain: Number.isNaN(gain) ? 1.0 : gain });
    updateState({ globalGain: Number.isNaN(gain) ? 1.0 : gain, soundLevel: value });
  };

  const setReactionMuteMode = async (value: boolean) => {
    const nextValue = Boolean(value);
    await updateFirebaseDocument({ muteReactionWhileOriginalPlays: nextValue });
    updateState({ isReactionMuteModeEnabled: nextValue });
    enforceReactionMuteMode();
  };

  const setFullscreenPrimaryVideo = async (value: FullscreenPrimaryVideo) => {
    const normalized = normalizeFullscreenPrimaryVideo(value);
    await updateFirebaseDocument({ fullscreenPrimaryVideo: normalized });
    updateState({ fullscreenPrimaryVideo: normalized, fullscreenPrimaryVideoDefault: normalized });
  };

  const setFullscreenOverlayWidthPercent = async (value: number) => {
    const normalized = normalizeFullscreenOverlayWidthPercent(value);
    await updateFirebaseDocument({ fullscreenOverlayWidthPercent: normalized });
    updateState({ fullscreenOverlayWidthPercent: normalized });
  };

  const setFullscreenOverlayCorner = async (value: FullscreenOverlayCorner) => {
    const normalized = normalizeFullscreenOverlayCorner(value);
    await updateFirebaseDocument({ fullscreenOverlayCorner: normalized });
    updateState({ fullscreenOverlayCorner: normalized });
  };

  const createPlayerConfig = async ({ timeInReaction, targetTime, state: rawState }: CreatePlayerConfigParams) => {
    const snapshot = getSnapshot();
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const sanitizedTargetTime = Number.isFinite(targetTime) ? Math.max(0, targetTime) : 0;
    const sanitizedState = Number.isFinite(rawState) ? rawState : 2;

    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedTargetTime = roundTargetTime(sanitizedTargetTime);
    const timelineMap = timelineArrayToMap(Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : []);

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      state: sanitizedState,
      targetTime: roundedTargetTime
    });

    try {
      await persistPlayerTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create player config', error);
      throw error;
    }
  };

  const createVolumeConfig = async ({ timeInReaction, volume }: CreateVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedVolume = roundVolume(Number.isFinite(volume) ? volume : 100);
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : []);

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistVolumeTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create volume config', error);
      throw error;
    }
  };

  const createReactionVolumeConfig = async ({ timeInReaction, volume }: CreateReactionVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedVolume = roundVolume(Number.isFinite(volume) ? volume : 100);
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : []);

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistReactionVolumeTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create reaction volume config', error);
      throw error;
    }
  };

  const createPlaybackRateConfig = async ({ timeInReaction, rate }: CreatePlaybackRateConfigParams) => {
    const snapshot = getSnapshot();
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const roundedRate = roundPlaybackRate(sanitizedRate);
    const timelineMap = playbackTimelineArrayToMap(Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : []);

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      rate: roundedRate
    });

    try {
      await persistPlaybackTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create playback rate config', error);
      throw error;
    }
  };

  const createOverlayVisibilityConfig = async ({
    timeInReaction,
    visible,
    primary
  }: {
    timeInReaction: number;
    visible: boolean;
    primary: OverlayPrimaryVideo;
  }) => {
    const snapshot = getSnapshot();
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedVisible = typeof visible === 'boolean' ? visible : true;
    const timelineMap = overlayVisibilityTimelineArrayToMap(
      Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [],
      snapshot.fullscreenPrimaryVideoDefault
    );

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      visible: sanitizedVisible,
      primary: primary === 'reaction' ? 'reaction' : 'original'
    });

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create overlay visibility config', error);
      throw error;
    }
  };

  const updatePlayerConfig = async ({
    timeInReaction,
    targetTime,
    state: rawState,
    previousTimeInReaction
  }: UpdatePlayerConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = timelineArrayToMap(Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : []);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const currentEntry = timelineMap.get(previousKey);

    if (!currentEntry) {
      return;
    }

    const resolvedState =
      typeof rawState === 'number' && Number.isFinite(rawState)
        ? rawState
        : Number(currentEntry?.state ?? 2);
    const resolvedTarget =
      typeof targetTime === 'number' && Number.isFinite(targetTime)
        ? Math.max(0, targetTime)
        : Number(currentEntry?.targetTime ?? 0);
    const roundedTargetTime = roundTargetTime(resolvedTarget);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      state: resolvedState,
      targetTime: roundedTargetTime
    });

    try {
      await persistPlayerTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update player config', error);
      throw error;
    }
  };

  const deletePlayerConfig = async ({ timeInReaction }: DeletePlayerConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = timelineArrayToMap(Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : []);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistPlayerTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete player config', error);
      throw error;
    }
  };

  const updateVolumeConfig = async ({ timeInReaction, volume, previousTimeInReaction }: UpdateVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : []);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const currentEntry = timelineMap.get(previousKey);

    if (!currentEntry) {
      return;
    }

    const resolvedVolume =
      typeof volume === 'number' && Number.isFinite(volume)
        ? volume
        : Number(currentEntry?.volume ?? 100);
    const roundedVolume = roundVolume(resolvedVolume);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistVolumeTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update volume config', error);
      throw error;
    }
  };

  const updateReactionVolumeConfig = async ({
    timeInReaction,
    volume,
    previousTimeInReaction
  }: UpdateReactionVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : []);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const currentEntry = timelineMap.get(previousKey);

    if (!currentEntry) {
      return;
    }

    const resolvedVolume =
      typeof volume === 'number' && Number.isFinite(volume)
        ? volume
        : Number(currentEntry?.volume ?? 100);
    const roundedVolume = roundVolume(resolvedVolume);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistReactionVolumeTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update reaction volume config', error);
      throw error;
    }
  };

  const deleteVolumeConfig = async ({ timeInReaction }: DeleteVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : []);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistVolumeTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete volume config', error);
      throw error;
    }
  };

  const deleteReactionVolumeConfig = async ({ timeInReaction }: DeleteReactionVolumeConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = volumeTimelineArrayToMap(Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : []);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistReactionVolumeTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete reaction volume config', error);
      throw error;
    }
  };

  const updatePlaybackRateConfig = async ({
    timeInReaction,
    rate,
    previousTimeInReaction
  }: UpdatePlaybackRateConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = playbackTimelineArrayToMap(Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : []);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const currentEntry = timelineMap.get(previousKey);

    if (!currentEntry) {
      return;
    }

    const resolvedRate =
      typeof rate === 'number' && Number.isFinite(rate) && rate > 0
        ? rate
        : Number(currentEntry?.rate ?? 1);
    const roundedRate = roundPlaybackRate(resolvedRate);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      rate: roundedRate
    });

    try {
      await persistPlaybackTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update playback rate config', error);
      throw error;
    }
  };

  const deletePlaybackRateConfig = async ({ timeInReaction }: DeletePlaybackRateConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = playbackTimelineArrayToMap(Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : []);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistPlaybackTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete playback rate config', error);
      throw error;
    }
  };

  const updateOverlayVisibilityConfig = async ({
    timeInReaction,
    visible,
    primary,
    previousTimeInReaction
  }: UpdateOverlayVisibilityConfigParams) => {
    const snapshot = getSnapshot();
    const timelineMap = overlayVisibilityTimelineArrayToMap(
      Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [],
      snapshot.fullscreenPrimaryVideoDefault
    );

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const currentEntry = timelineMap.get(previousKey);

    if (!currentEntry) {
      return;
    }

    const resolvedVisible = typeof visible === 'boolean' ? visible : (currentEntry?.visible ?? true);
    const resolvedPrimary = primary === 'reaction' || primary === 'original'
      ? primary
      : (currentEntry?.primary ?? snapshot.fullscreenPrimaryVideoDefault);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      visible: resolvedVisible,
      primary: resolvedPrimary
    });

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update overlay visibility config', error);
      throw error;
    }
  };

  const deleteOverlayVisibilityConfig = async ({ timeInReaction }: { timeInReaction: number }) => {
    const snapshot = getSnapshot();
    const timelineMap = overlayVisibilityTimelineArrayToMap(
      Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [],
      snapshot.fullscreenPrimaryVideoDefault
    );

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete overlay visibility config', error);
      throw error;
    }
  };

  const setIsPublished = async () => {
    await updateFirebaseDocument({ isPublished: true });
    const reactionId =
      typeof window !== 'undefined' ? window.currentReactionDocumentId : undefined;
    if (reactionId) {
      requestReactionEnrichment(reactionId, { force: true }).catch((error: unknown) => {
        console.error('Failed to enqueue reaction enrichment on publish', error);
      });
    }
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const setIsUnpublished = async () => {
    await updateFirebaseDocument({ isPublished: false });
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const enterEditMode = () => {
    updateState({ canShowCloseEditModeButton: true, isEditModeOn: true, canShowEditModeButton: false });
  };

  const closeEditMode = () => {
    updateState({ isEditModeOn: false, canShowEditModeButton: true, canShowCloseEditModeButton: false });
  };

  const toggleFineTuneMode = () => {
    updateState({ isFineTuneModeOn: !getSnapshot().isFineTuneModeOn });
  };

  const editActionEntryPoint = async (callback: () => Promise<void>) => {
    await callback();
    await setIsUnpublished();
  };

  return {
    enterEditMode,
    closeEditMode,
    toggleFineTuneMode,
    setReactionVideoId,
    setOffsetStartTime,
    setIntroBufferTime,
    setReactionFinishTime,
    setSoundLevel,
    setReactionMuteMode,
    setFullscreenPrimaryVideo,
    setFullscreenOverlayWidthPercent,
    setFullscreenOverlayCorner,
    createPlayerConfig,
    createVolumeConfig,
    createReactionVolumeConfig,
    createPlaybackRateConfig,
    createOverlayVisibilityConfig,
    updatePlayerConfig,
    deletePlayerConfig,
    updateVolumeConfig,
    deleteVolumeConfig,
    updateReactionVolumeConfig,
    deleteReactionVolumeConfig,
    updatePlaybackRateConfig,
    deletePlaybackRateConfig,
    updateOverlayVisibilityConfig,
    deleteOverlayVisibilityConfig,
    setIsPublished,
    setIsUnpublished,
    editActionEntryPoint,
  };
}

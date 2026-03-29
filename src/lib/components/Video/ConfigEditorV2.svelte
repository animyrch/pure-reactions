<script>
  import { createEventDispatcher } from "svelte";
  import { page } from "$app/stores";
  import DebugConfigs from "./DebugConfigs.svelte";
  import InteractiveSynchronizer from "./InteractiveSynchronizer.svelte";
  const dispatch = createEventDispatcher();

  export let volumeConfigs = {};
  export let reactionVolumeConfigs = {};
  export let playerConfigs = {};
  export let stateTimeline = [];
  export let volumeTimeline = [];
  export let reactionVolumeTimeline = [];
  export let playbackRateConfigs = {};
  export let playbackRateTimeline = [];
  export let overlayVisibilityTimeline = [];
  export let reactionTransportTrack = [];
  export let reactionCurrentTime = 0;
  export let reactionDuration = 0;
  export let seekMin = 0;
  export let seekMax = Number.POSITIVE_INFINITY;
  export let playerEventTimeline = [];
  export let allowPlaybackRate = true;

  const YOUTUBE_STATE_LABELS = {
    "-1": "Unstarted",
    0: "Ended",
    1: "Playing",
    2: "Paused",
    3: "Buffering",
    5: "Video cued",
  };

  const TYPE_META = {
    volume: {
      label: "Volume change",
      badgeClass:
        "border border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
    },
    player: {
      label: "Playback state",
      badgeClass: "border border-border-strong bg-surface/50 text-text-primary",
    },
    speed: {
      label: "Speed shift",
      badgeClass:
        "border border-accent-secondary/40 bg-accent-secondary/10 text-accent-secondary",
    },
  };

  const parseSeconds = (value) => {
    const numeric =
      typeof value === "string" ? Number.parseFloat(value) : value;
    return Number.isFinite(numeric) ? numeric : null;
  };

  const formatSeconds = (value) => {
    if (!Number.isFinite(value)) return "—";
    const rounded = Math.round(value * 100) / 100;
    return `${rounded.toString()}s`;
  };

  const formatPercent = (value) => {
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value)}%`;
  };

  const formatRate = (value) => {
    if (!Number.isFinite(value)) return "—";
    const rounded = Math.round(value * 100) / 100;
    return `${rounded.toString()}×`;
  };

  const resolveStateLabel = (state) => {
    if (!Number.isFinite(state)) return "Unknown state";
    return YOUTUBE_STATE_LABELS[state] ?? `State ${state}`;
  };

  const normalizeVolumeEvents = (timeline, configs, trackId = "volume") => {
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .map((event, index) => {
          const timeInReaction = parseSeconds(event?.t);
          const volume = Number.parseFloat(event?.volume);
          if (!Number.isFinite(timeInReaction) || Number.isNaN(volume))
            return null;
          return {
            id: `volume-array-${trackId}-${index}-${timeInReaction}`,
            type: "volume",
            trackId,
            timeInReaction,
            volume,
          };
        })
        .filter(Boolean);
    }

    return Object.entries(configs ?? {})
      .map(([timeKey, value], index) => {
        const timeInReaction = parseSeconds(timeKey);
        const volume = Number.parseFloat(value?.volume ?? value);
        if (!Number.isFinite(timeInReaction) || Number.isNaN(volume))
          return null;
        return {
          id: `volume-map-${trackId}-${index}-${timeInReaction}`,
          type: "volume",
          trackId,
          timeInReaction,
          volume,
        };
      })
      .filter(Boolean);
  };

  const normalizePlayerEvents = (timeline, configs) => {
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .map((event, index) => {
          const timeInReaction = parseSeconds(event?.t);
          const state = Number.parseFloat(event?.state);
          const targetTime = parseSeconds(event?.targetTime);
          if (!Number.isFinite(timeInReaction) || Number.isNaN(state))
            return null;
          return {
            id: `player-array-${index}-${timeInReaction}`,
            type: "player",
            trackId: "player",
            timeInReaction,
            state,
            targetTime,
          };
        })
        .filter(Boolean);
    }

    return Object.entries(configs ?? {})
      .map(([timeKey, value], index) => {
        const timeInReaction = parseSeconds(timeKey);
        const state = Number.parseFloat(value?.state ?? value);
        const targetTime = parseSeconds(value?.time);
        if (!Number.isFinite(timeInReaction) || Number.isNaN(state))
          return null;
        return {
          id: `player-map-${index}-${timeInReaction}`,
          type: "player",
          trackId: "player",
          timeInReaction,
          state,
          targetTime,
        };
      })
      .filter(Boolean);
  };

  const normalizePlaybackEvents = (timeline, configs) => {
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .map((event, index) => {
          const timeInReaction = parseSeconds(event?.t);
          const rate = Number.parseFloat(event?.rate);
          if (!Number.isFinite(timeInReaction) || Number.isNaN(rate))
            return null;
          return {
            id: `speed-array-${index}-${timeInReaction}`,
            type: "speed",
            trackId: "speed",
            timeInReaction,
            rate,
          };
        })
        .filter(Boolean);
    }

    return Object.entries(configs ?? {})
      .map(([timeKey, value], index) => {
        const timeInReaction = parseSeconds(timeKey);
        const rate = Number.parseFloat(value?.rate ?? value);
        if (!Number.isFinite(timeInReaction) || Number.isNaN(rate)) return null;
        return {
          id: `speed-map-${index}-${timeInReaction}`,
          type: "speed",
          trackId: "speed",
          timeInReaction,
          rate,
        };
      })
      .filter(Boolean);
  };

  const normalizeOverlayVisibilityEvents = (timeline) => {
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .map((event, index) => {
          const timeInReaction = parseSeconds(event?.t);
          const visible = typeof event?.visible === 'boolean' ? event.visible : true;
          if (!Number.isFinite(timeInReaction)) return null;
          return {
            id: `overlay-visibility-array-${index}-${timeInReaction}`,
            type: "overlayVisibility",
            trackId: "overlayVisibility",
            timeInReaction,
            visible,
          };
        })
        .filter(Boolean);
    }
    return [];
  };

  const normalizeReactionTransportEvents = (timeline) => {
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .map((event, index) => {
          const timeInReaction = parseSeconds(event?.t);
          const state = Number.parseFloat(event?.state);
          if (!Number.isFinite(timeInReaction) || Number.isNaN(state)) return null;
          return {
            id: `reaction-transport-array-${index}-${timeInReaction}`,
            type: "reactionTransport",
            trackId: "reactionTransport",
            timeInReaction,
            state,
          };
        })
        .filter(Boolean);
    }
    return [];
  };

  $: volumeEvents = normalizeVolumeEvents(
    volumeTimeline,
    volumeConfigs,
    "volume",
  );
  $: reactionVolumeEvents = normalizeVolumeEvents(
    reactionVolumeTimeline,
    reactionVolumeConfigs,
    "reactionVolume",
  );
  $: normalizedPlayerEvents = normalizePlayerEvents(
    stateTimeline,
    playerConfigs,
  );
  $: playerEvents =
    Array.isArray(playerEventTimeline) && playerEventTimeline.length
      ? playerEventTimeline
      : normalizedPlayerEvents;
  $: playbackEvents = normalizePlaybackEvents(
    playbackRateTimeline,
    playbackRateConfigs,
  );
  $: overlayVisibilityEvents = normalizeOverlayVisibilityEvents(
    overlayVisibilityTimeline,
  );
  $: reactionTransportEvents = normalizeReactionTransportEvents(
    reactionTransportTrack,
  );

  $: timelineEntries = [
    ...volumeEvents,
    ...reactionVolumeEvents,
    ...playerEvents,
    ...playbackEvents,
    ...overlayVisibilityEvents,
    ...reactionTransportEvents,
  ].sort((a, b) => a.timeInReaction - b.timeInReaction);

  $: summary = {
    total: timelineEntries.length,
    volume: volumeEvents.length,
    reactionVolume: reactionVolumeEvents.length,
    player: playerEvents.length,
    speed: playbackEvents.length,
    overlayVisibility: overlayVisibilityEvents.length,
    reactionTransport: reactionTransportEvents.length,
    spanStart: timelineEntries[0]?.timeInReaction ?? null,
    spanEnd:
      timelineEntries[timelineEntries.length - 1]?.timeInReaction ?? null,
  };

  let showDebugConfigs = false;
  $: showDebugConfigs = $page.url.searchParams.get("debug") === "true";

  let showIgnoredConfigs = false;

  $: isEntryIgnored = (entry) => {
    const t = entry?.timeInReaction;
    if (!Number.isFinite(t)) return false;
    if (t < seekMin) return true;
    if (Number.isFinite(seekMax) && t > seekMax) return true;
    return false;
  };

  $: ignoredTimelineEntries = timelineEntries.filter(isEntryIgnored);
  $: ignoredSummary = {
    total: ignoredTimelineEntries.length,
    volume: ignoredTimelineEntries.filter((entry) => entry?.type === "volume")
      .length,
    player: ignoredTimelineEntries.filter((entry) => entry?.type === "player")
      .length,
    speed: ignoredTimelineEntries.filter((entry) => entry?.type === "speed")
      .length,
    spanStart: ignoredTimelineEntries[0]?.timeInReaction ?? null,
    spanEnd:
      ignoredTimelineEntries[ignoredTimelineEntries.length - 1]
        ?.timeInReaction ?? null,
  };

  $: if (showDebugConfigs && showIgnoredConfigs) {
    showIgnoredConfigs = false;
  }

  $: if (
    !showDebugConfigs &&
    showIgnoredConfigs &&
    !ignoredTimelineEntries.length
  ) {
    showIgnoredConfigs = false;
  }
</script>

<div class="flex flex-col gap-6">
  {#if !showDebugConfigs && ignoredTimelineEntries.length}
    <button
      type="button"
      class="inline-flex items-center justify-center self-start rounded-md px-3 py-2 text-xs font-medium text-text-muted transition hover:bg-surface/70 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40"
      aria-expanded={showIgnoredConfigs}
      on:click={() => {
        showIgnoredConfigs = !showIgnoredConfigs;
      }}
    >
      {showIgnoredConfigs
        ? "Close ignored configs"
        : "Show ignored configuration entries"}
    </button>
  {/if}

  {#if showDebugConfigs}
    <DebugConfigs
      {summary}
      {timelineEntries}
      typeMeta={TYPE_META}
      {formatSeconds}
      {resolveStateLabel}
      {formatPercent}
      {formatRate}
      {seekMin}
      {seekMax}
      on:deletePlayerConfig={(event) =>
        dispatch("deletePlayerConfig", event.detail)}
      on:deleteVolumeConfig={(event) =>
        dispatch("deleteVolumeConfig", event.detail)}
      on:deleteReactionVolumeConfig={(event) =>
        dispatch("deleteReactionVolumeConfig", event.detail)}
      on:deletePlaybackRateConfig={(event) =>
        dispatch("deletePlaybackRateConfig", event.detail)}
    />
  {:else if showIgnoredConfigs && ignoredTimelineEntries.length}
    <DebugConfigs
      summary={ignoredSummary}
      timelineEntries={ignoredTimelineEntries}
      typeMeta={TYPE_META}
      {formatSeconds}
      {resolveStateLabel}
      {formatPercent}
      {formatRate}
      {seekMin}
      {seekMax}
      on:deletePlayerConfig={(event) =>
        dispatch("deletePlayerConfig", event.detail)}
      on:deleteVolumeConfig={(event) =>
        dispatch("deleteVolumeConfig", event.detail)}
      on:deleteReactionVolumeConfig={(event) =>
        dispatch("deleteReactionVolumeConfig", event.detail)}
      on:deletePlaybackRateConfig={(event) =>
        dispatch("deletePlaybackRateConfig", event.detail)}
    />
  {/if}

  <div class="rounded-2xl border border-border-subtle/80 bg-surface/60 p-4">
    <div class="mb-3 flex items-center justify-between">
      <p class="text-sm font-semibold text-text-primary">
        Live reaction timeline
      </p>
      <p class="text-xs text-text-muted">
        Tracks playback position in real time
      </p>
    </div>
    <InteractiveSynchronizer
      currentTime={reactionCurrentTime}
      duration={reactionDuration}
      {seekMin}
      {seekMax}
      {playerEvents}
      {volumeEvents}
      {reactionVolumeEvents}
      playbackRateEvents={playbackEvents}
      overlayVisibilityEvents={overlayVisibilityEvents}
      reactionTransportEvents={reactionTransportEvents}
      {allowPlaybackRate}
      on:createPlayerConfig={(event) =>
        dispatch("createPlayerConfig", event.detail)}
      on:createVolumeConfig={(event) =>
        dispatch("createVolumeConfig", event.detail)}
      on:createReactionVolumeConfig={(event) =>
        dispatch("createReactionVolumeConfig", event.detail)}
      on:createPlaybackRateConfig={(event) =>
        dispatch("createPlaybackRateConfig", event.detail)}
      on:createOverlayVisibilityConfig={(event) =>
        dispatch("createOverlayVisibilityConfig", event.detail)}
      on:createReactionTransportConfig={(event) =>
        dispatch("createReactionTransportConfig", event.detail)}
      on:updatePlayerConfig={(event) =>
        dispatch("updatePlayerConfig", event.detail)}
      on:deletePlayerConfig={(event) =>
        dispatch("deletePlayerConfig", event.detail)}
      on:updateVolumeConfig={(event) =>
        dispatch("updateVolumeConfig", event.detail)}
      on:deleteVolumeConfig={(event) =>
        dispatch("deleteVolumeConfig", event.detail)}
      on:updateReactionVolumeConfig={(event) =>
        dispatch("updateReactionVolumeConfig", event.detail)}
      on:deleteReactionVolumeConfig={(event) =>
        dispatch("deleteReactionVolumeConfig", event.detail)}
      on:updatePlaybackRateConfig={(event) =>
        dispatch("updatePlaybackRateConfig", event.detail)}
      on:deletePlaybackRateConfig={(event) =>
        dispatch("deletePlaybackRateConfig", event.detail)}
      on:updateOverlayVisibilityConfig={(event) =>
        dispatch("updateOverlayVisibilityConfig", event.detail)}
      on:deleteOverlayVisibilityConfig={(event) =>
        dispatch("deleteOverlayVisibilityConfig", event.detail)}
      on:updateReactionTransportConfig={(event) =>
        dispatch("updateReactionTransportConfig", event.detail)}
      on:deleteReactionTransportConfig={(event) =>
        dispatch("deleteReactionTransportConfig", event.detail)}
      on:seek={(event) => dispatch("seek", event.detail)}
    />
  </div>
</div>

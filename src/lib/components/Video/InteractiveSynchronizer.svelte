<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import { PlaySolid, PauseSolid, EyeSolid, EyeSlashSolid } from "flowbite-svelte-icons";
  import AdvancedVolumeControl from "./AdvancedVolumeControl.svelte";

  export let currentTime = 0;
  export let duration = 0;
  export let playerEvents = [];
  export let volumeEvents = [];
  export let reactionVolumeEvents = [];
  export let playbackRateEvents = [];
  export let overlayVisibilityEvents = [];
  export let overlayPrimaryDefault = "original";
  export let seekMin = 0;
  export let seekMax = Number.POSITIVE_INFINITY;
  export let allowPlaybackRate = true;

  const clamp01 = (value) => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), 1);
  };

  const cueBoundsClamped = ({
    value,
    min = 0,
    max = Number.POSITIVE_INFINITY,
  }) => {
    const numericValue = Number(value);
    const numericMin = Number(min);
    const numericMax = Number(max);
    const safeMin = Number.isFinite(numericMin) ? numericMin : 0;
    const safeMax = Number.isFinite(numericMax)
      ? numericMax
      : Number.POSITIVE_INFINITY;
    const orderedMin = Math.min(safeMin, safeMax);
    const orderedMax = Math.max(safeMin, safeMax);
    const safeValue = Number.isFinite(numericValue) ? numericValue : orderedMin;
    return {
      min: orderedMin,
      max: orderedMax,
      value: Math.min(Math.max(safeValue, orderedMin), orderedMax),
    };
  };

  const formatTimecode = (value) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatRateDisplay = (value) => {
    if (!Number.isFinite(value)) return "1×";
    const normalized = Math.round(value * 100) / 100;
    return `${normalized.toString()}×`;
  };

  const formatVolumeDisplay = (value) => {
    if (!Number.isFinite(value)) return "0%";
    const bounded = Math.min(Math.max(value, 0), 100);
    return `${Math.round(bounded)}%`;
  };

  const STATE_MARKERS = {
    1: { label: "Resumed original", tone: "resume", icon: PlaySolid },
    2: { label: "Stopped original", tone: "stop", icon: PauseSolid },
  };

  const MARKER_STYLES = {
    resume:
      "border border-accent-primary/40 bg-accent-primary/15 text-accent-primary",
    stop: "border border-border-strong/60 bg-background/90 text-text-primary",
    speed:
      "border border-accent-secondary/50 bg-accent-secondary/10 text-accent-secondary",
    volume:
      "border border-accent-primary/30 bg-accent-primary/10 text-accent-primary",
    overlayVisible:
      "border border-accent-primary/30 bg-accent-primary/10 text-accent-primary",
    overlayHidden:
      "border border-border-strong/60 bg-background/90 text-text-muted",
  };

  const TIMELINE_REGION_SELECTOR = '[data-timeline-region="true"]';
  const MARKER_INTERACTION_SELECTOR = '[data-marker-interaction="true"]';

  const MIN_ZOOM_RATIO = 0.01;
  const MIN_ZOOM_SPAN_SECONDS = 0.5;

  const dispatch = createEventDispatcher();

  let pendingConfig = null;
  let activeMarker = null;
  let maxEventTime = 0;
  let effectiveDuration = 0;
  let pendingTargetMinutesInput = "0";
  let pendingTargetSecondsInput = "0.00";
  let activeTargetMinutesInput = "0";
  let activeTargetSecondsInput = "0.00";
  let pendingReactionMinutesInput = "0";
  let pendingReactionSecondsInput = "0.00";
  let activeReactionMinutesInput = "0";
  let activeReactionSecondsInput = "0.00";
  let pendingTargetSeconds = 0;
  let activeTargetSeconds = 0;
  let pendingReactionSeconds = 0;
  let activeReactionSeconds = 0;
  let activeMarkerIsDirty = false;
  let shouldLockActivePauseTarget = false;
  let hoverViewportRatio = null;
  let hoverTimeLabel = null;
  let hoverIndicatorLeftPx = null;
  let viewportInitialized = false;
  let viewportStart = 0;
  let viewportEnd = 0;
  let safeViewportStart = 0;
  let safeViewportEnd = 0;
  let viewportSpan = 0;
  let isZoomed = false;
  let displayProgress = 0;
  let zoomSelectionActive = false;
  let zoomDragStartViewportRatio = null;
  let zoomDragCurrentViewportRatio = null;
  let zoomSelectionLeft = null;
  let zoomSelectionWidth = null;
  let zoomBoundingRect = null;
  let zoomDragCommitted = false;
  let suppressNextClick = false;
  let isSelectingZoom = false;
  let lastDuration = 0;
  let visibleTracks = [];
  let hasManualZoom = false;
  let timelineContainer = null;

  // Playhead drag state
  let isDraggingPlayhead = false;
  let playheadDragRect = null;
  let playheadContainerEl = null;

  const PLAYBACK_RATE_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  let pendingVolumeInput = "100";
  let pendingPlaybackRateInput = "1";
  let pendingOverlayVisibleInput = true;
  let pendingOverlayPrimaryInput = "original";

  let activeVolumeInput = "100";
  let activePlaybackRateInput = "1";
  let activeOverlayVisibleInput = true;
  let activeOverlayPrimaryInput = "original";

  // Advanced options state
  let showAdvancedPending = false;
  let showAdvancedActive = false;

  const PENDING_TARGET_MINUTES_INPUT_ID = "pending-target-minutes";
  const PENDING_TARGET_SECONDS_INPUT_ID = "pending-target-seconds";
  const ACTIVE_TARGET_MINUTES_INPUT_ID = "active-target-minutes";
  const ACTIVE_TARGET_SECONDS_INPUT_ID = "active-target-seconds";
  const PENDING_REACTION_MINUTES_INPUT_ID = "pending-reaction-minutes";
  const PENDING_REACTION_SECONDS_INPUT_ID = "pending-reaction-seconds";
  const ACTIVE_REACTION_MINUTES_INPUT_ID = "active-reaction-minutes";
  const ACTIVE_REACTION_SECONDS_INPUT_ID = "active-reaction-seconds";

  const sanitizeNumber = (value, fallback = 0) => {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const formatSecondsForInput = (value) => {
    if (!Number.isFinite(value)) {
      return { minutes: "0", seconds: "0.00" };
    }
    const clamped = Math.max(0, value);
    const totalSeconds = Math.floor(clamped);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = clamped - minutes * 60;
    return {
      minutes: String(minutes),
      seconds: (Math.round(remainingSeconds * 100) / 100)
        .toFixed(2)
        .padStart(4, "0"),
    };
  };

  const parseInputsToSeconds = (minutesInput, secondsInput, fallback = 0) => {
    const minutesValue = Number.parseInt(minutesInput, 10);
    const secondsValue = Number.parseFloat(secondsInput);
    if (!Number.isFinite(minutesValue) || minutesValue < 0) {
      return fallback;
    }
    if (!Number.isFinite(secondsValue) || secondsValue < 0) {
      return fallback;
    }
    return minutesValue * 60 + secondsValue;
  };

  $: safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  $: safeCurrentTime =
    Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  $: if (safeDuration !== lastDuration) {
    lastDuration = safeDuration;
    if (safeDuration > 0) {
      viewportInitialized = true;
      if (!hasManualZoom) {
        viewportStart = seekMin;
        viewportEnd = Number.isFinite(seekMax) ? seekMax : safeDuration;
      } else if (viewportEnd > safeDuration) {
        viewportEnd = safeDuration;
      }
    } else {
      viewportInitialized = false;
      viewportStart = seekMin;
      viewportEnd = seekMin;
      hasManualZoom = false;
    }
  }
  $: if (viewportEnd > effectiveDuration && effectiveDuration > 0) {
    viewportEnd = effectiveDuration;
  }
  $: {
    const startCandidate = Math.min(viewportStart, viewportEnd);
    const endCandidate = Math.max(viewportStart, viewportEnd);
    const boundedStart = Math.max(0, startCandidate);
    const durationCeiling = safeDuration > 0 ? safeDuration : endCandidate;
    const minEnd = boundedStart + 0.001;
    safeViewportStart = boundedStart;
    safeViewportEnd = Math.max(minEnd, Math.min(endCandidate, durationCeiling));
    viewportSpan = Math.max(0.001, safeViewportEnd - safeViewportStart);
  }
  $: isZoomed = hasManualZoom;
  $: displayProgress = clamp01(
    viewportSpan <= 0
      ? 0
      : (safeCurrentTime - safeViewportStart) / viewportSpan,
  );
  $: indicatorPosition = `${(displayProgress * 100).toFixed(3)}%`;
  $: playerEventsSorted = Array.isArray(playerEvents)
    ? [...playerEvents]
        .map((event) => ({
          ...event,
          timeInReaction: sanitizeNumber(event?.timeInReaction),
          targetTime: sanitizeNumber(event?.targetTime ?? event?.time),
        }))
        .filter((event) => Number.isFinite(event.timeInReaction))
        .sort((a, b) => a.timeInReaction - b.timeInReaction)
    : [];
  $: volumeEventsSorted = Array.isArray(volumeEvents)
    ? [...volumeEvents]
        .map((event) => ({
          ...event,
          timeInReaction: sanitizeNumber(event?.timeInReaction ?? event?.t),
          volume: Number.parseFloat(event?.volume ?? event?.value),
        }))
        .filter(
          (event) =>
            Number.isFinite(event.timeInReaction) &&
            Number.isFinite(event.volume),
        )
        .sort((a, b) => a.timeInReaction - b.timeInReaction)
    : [];
  $: reactionVolumeEventsSorted = Array.isArray(reactionVolumeEvents)
    ? [...reactionVolumeEvents]
        .map((event) => ({
          ...event,
          timeInReaction: sanitizeNumber(event?.timeInReaction ?? event?.t),
          volume: Number.parseFloat(event?.volume ?? event?.value),
        }))
        .filter(
          (event) =>
            Number.isFinite(event.timeInReaction) &&
            Number.isFinite(event.volume),
        )
        .sort((a, b) => a.timeInReaction - b.timeInReaction)
    : [];
  $: playbackRateEventsSorted = Array.isArray(playbackRateEvents)
    ? [...playbackRateEvents]
        .map((event) => ({
          ...event,
          timeInReaction: sanitizeNumber(event?.timeInReaction ?? event?.t),
          rate: Number.parseFloat(event?.rate ?? event?.value),
        }))
        .filter(
          (event) =>
            Number.isFinite(event.timeInReaction) &&
            Number.isFinite(event.rate),
        )
        .sort((a, b) => a.timeInReaction - b.timeInReaction)
    : [];
  $: overlayVisibilityEventsSorted = Array.isArray(overlayVisibilityEvents)
    ? (() => {
        const sorted = [...overlayVisibilityEvents]
        .map((event) => ({
          ...event,
          timeInReaction: sanitizeNumber(event?.timeInReaction ?? event?.t),
          visible: typeof event?.visible === 'boolean' ? event.visible : true,
          primary: event?.primary === "reaction" ? "reaction" : undefined,
        }))
        .filter((event) => Number.isFinite(event.timeInReaction))
        .sort((a, b) => a.timeInReaction - b.timeInReaction);
        let previousPrimary = overlayPrimaryDefault === "reaction" ? "reaction" : "original";
        return sorted.map((event) => {
          const primary = event.primary ?? previousPrimary;
          previousPrimary = primary;
          return { ...event, primary };
        });
      })()
    : [];
  $: playerMarkers = playerEventsSorted
    .map((event, index) => {
      if (!Number.isFinite(event?.timeInReaction)) return null;
      const markerMeta = STATE_MARKERS[event?.state];
      if (!markerMeta?.icon) return null;
      const normalized =
        effectiveDuration <= 0
          ? 0
          : clamp01(event.timeInReaction / effectiveDuration);
      const targetTime = sanitizeNumber(event?.targetTime ?? event?.time, 0);
      return {
        id: event?.id ?? `player-marker-${index}`,
        trackId: "player",
        label: markerMeta.label,
        tone: markerMeta.tone,
        position: `${(normalized * 100).toFixed(3)}%`,
        ratio: normalized,
        timeLabel: formatTimecode(event.timeInReaction),
        timeInReaction: event.timeInReaction,
        targetTime,
        state: Number(event.state),
        icon: markerMeta.icon,
        editable: true,
      };
    })
    .filter(Boolean);
  $: playMarkers = playerMarkers.filter((marker) => marker.state === 1);
  $: pauseMarkers = playerMarkers.filter((marker) => marker.state === 2);
  $: playbackRateMarkers = playbackRateEventsSorted
    .map((event, index) => {
      const timeInReaction = event.timeInReaction;
      const rate = event.rate;
      if (!Number.isFinite(timeInReaction) || !Number.isFinite(rate))
        return null;
      const normalized =
        effectiveDuration <= 0
          ? 0
          : clamp01(timeInReaction / effectiveDuration);
      const displayValue = formatRateDisplay(rate);
      return {
        id: event?.id ?? `speed-marker-${index}`,
        trackId: "speed",
        label: `Playback speed ${displayValue}`,
        tone: "speed",
        position: `${(normalized * 100).toFixed(3)}%`,
        ratio: normalized,
        timeLabel: formatTimecode(timeInReaction),
        timeInReaction,
        rate,
        displayValue,
        editable: true,
      };
    })
    .filter(Boolean);
  $: volumeMarkers = volumeEventsSorted
    .map((event, index) => {
      const timeInReaction = event.timeInReaction;
      const volume = event.volume;
      if (!Number.isFinite(timeInReaction) || !Number.isFinite(volume))
        return null;
      const normalized =
        effectiveDuration <= 0
          ? 0
          : clamp01(timeInReaction / effectiveDuration);
      const displayValue = formatVolumeDisplay(volume);
      return {
        id: event?.id ?? `volume-marker-${index}`,
        trackId: "volume",
        label: `Volume ${displayValue}`,
        tone: "volume",
        position: `${(normalized * 100).toFixed(3)}%`,
        ratio: normalized,
        timeLabel: formatTimecode(timeInReaction),
        timeInReaction,
        volume,
        displayValue,
        editable: true,
      };
    })
    .filter(Boolean);
  $: reactionVolumeMarkers = reactionVolumeEventsSorted
    .map((event, index) => {
      const timeInReaction = event.timeInReaction;
      const volume = event.volume;
      if (!Number.isFinite(timeInReaction) || !Number.isFinite(volume))
        return null;
      const normalized =
        effectiveDuration <= 0
          ? 0
          : clamp01(timeInReaction / effectiveDuration);
      const displayValue = formatVolumeDisplay(volume);
      return {
        id: event?.id ?? `reaction-volume-marker-${index}`,
        trackId: "reactionVolume",
        label: `Reaction volume ${displayValue}`,
        tone: "volume",
        position: `${(normalized * 100).toFixed(3)}%`,
        ratio: normalized,
        timeLabel: formatTimecode(timeInReaction),
        timeInReaction,
        volume,
        displayValue,
        editable: true,
      };
    })
    .filter(Boolean);
  $: overlayVisibilityMarkers = overlayVisibilityEventsSorted
    .map((event, index) => {
      const timeInReaction = event.timeInReaction;
      const visible = event.visible;
      const primary = event.primary === "reaction" ? "reaction" : "original";
      if (!Number.isFinite(timeInReaction)) return null;
      const normalized =
        effectiveDuration <= 0
          ? 0
          : clamp01(timeInReaction / effectiveDuration);
      const icon = visible ? EyeSolid : EyeSlashSolid;
      const tone = visible ? "overlayVisible" : "overlayHidden";
      const primaryLabel = primary === "reaction" ? "Reaction" : "Original";
      const label = `${visible ? "Show" : "Hide"} overlay (${primaryLabel} primary)`;
      return {
        id: event?.id ?? `overlay-visibility-marker-${index}`,
        trackId: "overlayVisibility",
        label,
        tone,
        position: `${(normalized * 100).toFixed(3)}%`,
        ratio: normalized,
        timeLabel: formatTimecode(timeInReaction),
        timeInReaction,
        visible,
        primary,
        primaryIndicator: primary === "reaction" ? "R" : "O",
        icon,
        editable: true,
      };
    })
    .filter(Boolean);
  $: if (effectiveDuration <= 0) {
    hoverViewportRatio = null;
    hoverTimeLabel = null;
  }
  $: hoverIndicatorLeft =
    Number.isFinite(hoverIndicatorLeftPx) && hoverIndicatorLeftPx !== null
      ? `${hoverIndicatorLeftPx.toFixed(2)}px`
      : null;
  $: maxPlayerEventTime = playerEventsSorted.length
    ? playerEventsSorted[playerEventsSorted.length - 1].timeInReaction
    : 0;
  $: maxVolumeEventTime = volumeEventsSorted.length
    ? volumeEventsSorted[volumeEventsSorted.length - 1].timeInReaction
    : 0;
  $: maxReactionVolumeEventTime = reactionVolumeEventsSorted.length
    ? reactionVolumeEventsSorted[reactionVolumeEventsSorted.length - 1]
        .timeInReaction
    : 0;
  $: maxPlaybackRateEventTime = playbackRateEventsSorted.length
    ? playbackRateEventsSorted[playbackRateEventsSorted.length - 1]
        .timeInReaction
    : 0;
  $: maxOverlayVisibilityEventTime = overlayVisibilityEventsSorted.length
    ? overlayVisibilityEventsSorted[overlayVisibilityEventsSorted.length - 1]
        .timeInReaction
    : 0;
  $: maxEventTime = Math.max(
    maxPlayerEventTime,
    maxVolumeEventTime,
    maxReactionVolumeEventTime,
    maxPlaybackRateEventTime,
    maxOverlayVisibilityEventTime,
  );
  $: effectiveDuration =
    safeDuration > 0 ? safeDuration : Math.max(maxEventTime, safeCurrentTime);
  $: if (!viewportInitialized && effectiveDuration > 0) {
    viewportInitialized = true;
    viewportStart = seekMin;
    viewportEnd = Number.isFinite(seekMax) ? seekMax : effectiveDuration;
    hasManualZoom = false;
  }
  $: tracks = [
    {
      id: "originalVideo",
      label: "Original video",
      markers: playerMarkers,
      showProgress: true,
      interactive: true,
    },
    ...(allowPlaybackRate
      ? [
          {
            id: "speed",
            label: "Playback speed",
            markers: playbackRateMarkers,
            showProgress: false,
            interactive: false,
          },
        ]
      : []),
    {
      id: "volume",
      label: "Volume Original",
      markers: volumeMarkers,
      showProgress: false,
      interactive: false,
    },
    {
      id: "reactionVolume",
      label: "Volume Reaction",
      markers: reactionVolumeMarkers,
      showProgress: false,
      interactive: false,
    },
    {
      id: "overlayVisibility",
      label: "Overlay",
      markers: overlayVisibilityMarkers,
      showProgress: false,
      interactive: false,
    },
  ];
  $: {
    const viewportStartBoundary = safeViewportStart - 0.0005;
    const viewportEndBoundary = safeViewportEnd + 0.0005;
    visibleTracks = tracks.map((track) => ({
      ...track,
      markers: track.markers.filter((marker) => {
        const markerTime = marker?.timeInReaction;
        return (
          Number.isFinite(markerTime) &&
          markerTime >= viewportStartBoundary &&
          markerTime <= viewportEndBoundary
        );
      }),
    }));
  }
  $: if (
    zoomSelectionActive &&
    zoomDragStartViewportRatio !== null &&
    zoomDragCurrentViewportRatio !== null
  ) {
    const minRatio = Math.min(
      zoomDragStartViewportRatio,
      zoomDragCurrentViewportRatio,
    );
    const maxRatio = Math.max(
      zoomDragStartViewportRatio,
      zoomDragCurrentViewportRatio,
    );
    const span = maxRatio - minRatio;
    if (span > 0.0005) {
      zoomSelectionLeft = `${(minRatio * 100).toFixed(3)}%`;
      zoomSelectionWidth = `${(span * 100).toFixed(3)}%`;
    } else {
      zoomSelectionLeft = null;
      zoomSelectionWidth = null;
    }
  } else {
    zoomSelectionLeft = null;
    zoomSelectionWidth = null;
  }
  $: if (pendingConfig && effectiveDuration <= 0) {
    closeConfigPopup();
  }
  $: if (pendingConfig && effectiveDuration > 0) {
    const clamped = cueBoundsClamped({
      value: pendingConfig.reactionTime,
      min: seekMin,
      max: Number.isFinite(seekMax) ? seekMax : effectiveDuration,
    });
    if (Math.abs(clamped.value - pendingConfig.reactionTime) > 0.0005) {
      pendingReactionSeconds = clamped.value;
      const formatted = formatSecondsForInput(clamped.value);
      pendingReactionMinutesInput = formatted.minutes;
      pendingReactionSecondsInput = formatted.seconds;
      pendingConfig = {
        ...pendingConfig,
        reactionTime: clamped.value,
      };
    }
  }

  $: if (activeMarker && effectiveDuration <= 0) {
    closeMarkerEditor();
  }
  $: if (activeMarker && effectiveDuration > 0) {
    const clamped = cueBoundsClamped({
      value: activeMarker.timeInReaction,
      min: seekMin,
      max: Number.isFinite(seekMax) ? seekMax : effectiveDuration,
    });
    if (Math.abs(clamped.value - activeMarker.timeInReaction) > 0.0005) {
      activeReactionSeconds = clamped.value;
      const formatted = formatSecondsForInput(clamped.value);
      activeReactionMinutesInput = formatted.minutes;
      activeReactionSecondsInput = formatted.seconds;
      const nextRatio =
        viewportSpan > 0
          ? clamp01((clamped.value - safeViewportStart) / viewportSpan)
          : 0;
        const {
          initialTimeInReaction,
          initialTargetTime,
          initialState,
          initialVolume,
          initialRate,
          initialVisible,
          initialPrimary,
        } = activeMarker;
        activeMarker = {
          ...activeMarker,
          timeInReaction: clamped.value,
          ratio: nextRatio,
        initialTimeInReaction,
        initialTargetTime,
          initialState,
          initialVolume,
          initialRate,
          initialVisible,
          initialPrimary,
        };
    }
  }
  $: if (pendingConfig) {
    const nextRatio =
      viewportSpan > 0
        ? clamp01((pendingReactionSeconds - safeViewportStart) / viewportSpan)
        : 0;
    if (Math.abs(nextRatio - pendingConfig.ratio) > 0.0005) {
      pendingConfig = {
        ...pendingConfig,
        ratio: nextRatio,
      };
    }
  }

  $: if (activeMarker) {
    const nextRatio =
      viewportSpan > 0
        ? clamp01((activeReactionSeconds - safeViewportStart) / viewportSpan)
        : 0;
    if (Math.abs(nextRatio - activeMarker.ratio) > 0.0005) {
      const { initialTimeInReaction, initialTargetTime, initialState, initialVolume, initialRate, initialVisible } =
        activeMarker;
      activeMarker = {
        ...activeMarker,
        ratio: nextRatio,
        timeInReaction: activeReactionSeconds,
        targetTime: activeTargetSeconds,
        initialTimeInReaction,
        initialTargetTime,
        initialState,
        initialVolume,
        initialRate,
        initialVisible,
        initialPrimary: activeMarker.initialPrimary,
      };
    }
  }

  $: if (activeMarker && !activeMarkerIsDirty) {
    const markerList =
      activeMarker.trackId === "volume"
        ? volumeMarkers
        : activeMarker.trackId === "reactionVolume"
          ? reactionVolumeMarkers
          : activeMarker.trackId === "speed"
            ? playbackRateMarkers
            : activeMarker.trackId === "overlayVisibility"
              ? overlayVisibilityMarkers
            : playerMarkers;
    const exists = markerList.some(
      (marker) =>
        Math.abs(marker.timeInReaction - activeMarker.initialTimeInReaction) <
        0.001,
    );
    if (!exists) {
      closeMarkerEditor();
    }
  }

  const findPreviousPlayerEvent = (reactionTime, exclude) => {
    if (!playerEventsSorted.length) return null;
    let candidate = null;
    const excludeTime = Number.isFinite(exclude?.timeInReaction)
      ? exclude.timeInReaction
      : null;
    const excludeState = Number.isFinite(exclude?.state)
      ? Number(exclude.state)
      : null;
    const hasExcludeTime = Number.isFinite(excludeTime);
    const hasExcludeState = Number.isFinite(excludeState);
    for (const event of playerEventsSorted) {
      const eventTime = sanitizeNumber(event?.timeInReaction);
      if (
        exclude &&
        hasExcludeTime &&
        Math.abs(eventTime - excludeTime) < 0.0005 &&
        (!hasExcludeState || Number(event?.state) === excludeState)
      ) {
        continue;
      }
      if (eventTime <= reactionTime) {
        candidate = event;
      } else {
        break;
      }
    }
    return candidate;
  };

  $: {
    if (!activeMarker || activeMarker.trackId !== "player") {
      shouldLockActivePauseTarget = false;
    } else if (Number(activeMarker.state) !== 2) {
      shouldLockActivePauseTarget = false;
    } else {
      const previous = findPreviousPlayerEvent(activeReactionSeconds, {
        timeInReaction: activeMarker.initialTimeInReaction,
        state: activeMarker.initialState,
      });
      shouldLockActivePauseTarget = Number(previous?.state) === 1;
    }
  }

  const computeOriginalTimeForNewEvent = (reactionTime, exclude) => {
    const previous = findPreviousPlayerEvent(reactionTime, exclude);
    if (!previous) return 0;
    const previousTargetTime = Number.isFinite(previous.targetTime)
      ? previous.targetTime
      : 0;
    const delta = Math.max(
      0,
      reactionTime - sanitizeNumber(previous.timeInReaction),
    );
    return Number(previous.state) === 1
      ? previousTargetTime + delta
      : previousTargetTime;
  };

  const toViewportRatio = (timeInSeconds) => {
    if (!Number.isFinite(timeInSeconds) || viewportSpan <= 0) {
      return null;
    }
    return clamp01((timeInSeconds - safeViewportStart) / viewportSpan);
  };

  const toViewportPosition = (timeInSeconds) => {
    const ratio = toViewportRatio(timeInSeconds);
    if (ratio === null) {
      return "0%";
    }
    return `${(ratio * 100).toFixed(3)}%`;
  };

  const getTimelineCoordinates = (event, rectOverride = null) => {
    if (viewportSpan <= 0) {
      return null;
    }
    let rect = rectOverride;
    const target = event?.target;
    if (!rect && target?.closest) {
      const matchedRegion = target.closest(TIMELINE_REGION_SELECTOR);
      if (matchedRegion) {
        rect = matchedRegion.getBoundingClientRect?.();
      }
    }
    if (!rect) {
      rect = event.currentTarget?.getBoundingClientRect?.();
    }
    if (!rect || rect.width <= 0) {
      return null;
    }
    const clientX = event.clientX;
    if (typeof clientX !== "number" || !Number.isFinite(clientX)) {
      return null;
    }
    const viewportRatio = clamp01((clientX - rect.left) / rect.width);
    const absoluteTime = safeViewportStart + viewportRatio * viewportSpan;
    const boundedAbsoluteTime =
      effectiveDuration > 0
        ? Math.min(Math.max(absoluteTime, 0), effectiveDuration)
        : absoluteTime;
    const overallRatio =
      effectiveDuration > 0
        ? clamp01(boundedAbsoluteTime / effectiveDuration)
        : 0;
    return {
      viewportRatio,
      absoluteTime: boundedAbsoluteTime,
      overallRatio,
      clientX,
      regionRect: rect,
    };
  };

  const updateHover = (event) => {
    const timelineRegion = event?.target?.closest?.(TIMELINE_REGION_SELECTOR);
    if (!timelineRegion) {
      hoverViewportRatio = null;
      hoverTimeLabel = null;
      hoverIndicatorLeftPx = null;
      return;
    }
    const regionRect = timelineRegion.getBoundingClientRect();
    const coordinates = getTimelineCoordinates(event, regionRect);
    if (!coordinates) {
      hoverViewportRatio = null;
      hoverTimeLabel = null;
      hoverIndicatorLeftPx = null;
      return;
    }
    hoverViewportRatio = coordinates.viewportRatio;
    hoverTimeLabel = formatTimecode(coordinates.absoluteTime);
    const containerRect = timelineContainer?.getBoundingClientRect?.();
    if (containerRect && containerRect.width > 0) {
      const rawLeft = coordinates.clientX - containerRect.left;
      hoverIndicatorLeftPx = Math.min(
        Math.max(rawLeft, 0),
        containerRect.width,
      );
    } else {
      hoverIndicatorLeftPx = null;
    }
  };

  const clearHover = () => {
    hoverViewportRatio = null;
    hoverTimeLabel = null;
    hoverIndicatorLeftPx = null;
  };

  const cleanupZoomListeners = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("mousemove", handleZoomMouseMove);
    window.removeEventListener("mouseup", handleZoomMouseUp);
  };

  const startZoomSelection = (event) => {
    if (typeof window === "undefined") return;
    if (event.button !== 0) return;
    if (event.defaultPrevented) return;
    if (viewportSpan <= 0) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    if (event?.target?.closest?.(MARKER_INTERACTION_SELECTOR)) return;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return;
    const coordinates = getTimelineCoordinates(event, rect);
    if (!coordinates) return;
    event.preventDefault();
    cleanupZoomListeners();
    isSelectingZoom = true;
    zoomBoundingRect = rect;
    zoomDragStartViewportRatio = coordinates.viewportRatio;
    zoomDragCurrentViewportRatio = coordinates.viewportRatio;
    zoomDragCommitted = false;
    zoomSelectionActive = true;
    suppressNextClick = false;
    hoverViewportRatio = null;
    hoverTimeLabel = null;
    window.addEventListener("mousemove", handleZoomMouseMove);
    window.addEventListener("mouseup", handleZoomMouseUp);
  };

  const handleZoomMouseMove = (event) => {
    if (typeof window === "undefined") return;
    if (!isSelectingZoom || !zoomBoundingRect) return;
    event.preventDefault();
    const coordinates = getTimelineCoordinates(event, zoomBoundingRect);
    if (!coordinates) return;
    zoomDragCurrentViewportRatio = coordinates.viewportRatio;
    if (
      !zoomDragCommitted &&
      Math.abs(
        zoomDragCurrentViewportRatio - (zoomDragStartViewportRatio ?? 0),
      ) >
        MIN_ZOOM_RATIO / 2
    ) {
      zoomDragCommitted = true;
    }
  };

  const handleZoomMouseUp = (event) => {
    if (typeof window === "undefined") return;
    if (!isSelectingZoom) return;
    const coordinates = zoomBoundingRect
      ? getTimelineCoordinates(event, zoomBoundingRect)
      : null;
    if (coordinates) {
      zoomDragCurrentViewportRatio = coordinates.viewportRatio;
    }
    finalizeZoomSelection();
  };

  const finalizeZoomSelection = () => {
    cleanupZoomListeners();
    if (!isSelectingZoom) {
      zoomSelectionActive = false;
      return;
    }
    const startRatio = clamp01(zoomDragStartViewportRatio ?? 0);
    const endRatio = clamp01(zoomDragCurrentViewportRatio ?? startRatio);
    const minRatio = Math.min(startRatio, endRatio);
    const maxRatio = Math.max(startRatio, endRatio);
    const ratioSpan = Math.abs(maxRatio - minRatio);
    const spanSeconds = ratioSpan * viewportSpan;
    const meetsThreshold =
      zoomDragCommitted &&
      (ratioSpan >= MIN_ZOOM_RATIO || spanSeconds >= MIN_ZOOM_SPAN_SECONDS);
    if (meetsThreshold) {
      const newStart = safeViewportStart + minRatio * viewportSpan;
      const newEnd = safeViewportStart + maxRatio * viewportSpan;
      if (newEnd - newStart >= 0.1) {
        viewportStart = newStart;
        viewportEnd = newEnd;
        hasManualZoom = true;
        suppressNextClick = true;
        closeConfigPopup();
        closeMarkerEditor();
      } else {
        suppressNextClick = false;
      }
    } else {
      suppressNextClick = false;
    }
    isSelectingZoom = false;
    zoomSelectionActive = false;
    zoomBoundingRect = null;
    zoomDragStartViewportRatio = null;
    zoomDragCurrentViewportRatio = null;
    zoomDragCommitted = false;
  };

  const resetZoom = () => {
    cleanupZoomListeners();
    isSelectingZoom = false;
    zoomSelectionActive = false;
    zoomDragStartViewportRatio = null;
    zoomDragCurrentViewportRatio = null;
    zoomBoundingRect = null;
    zoomDragCommitted = false;
    suppressNextClick = false;
    hoverViewportRatio = null;
    hoverTimeLabel = null;
    const fallbackDuration =
      effectiveDuration > 0 ? effectiveDuration : safeDuration;
    viewportStart = seekMin;
    viewportEnd = Number.isFinite(seekMax) ? seekMax : fallbackDuration;
    hasManualZoom = false;
    closeConfigPopup();
    closeMarkerEditor();
  };

  const refreshPendingDerivedValues = () => {
    pendingReactionSeconds = parseInputsToSeconds(
      pendingReactionMinutesInput,
      pendingReactionSecondsInput,
      pendingReactionSeconds,
    );

    if (effectiveDuration > 0) {
      const clamped = cueBoundsClamped({
        value: pendingReactionSeconds,
        min: seekMin,
        max: Number.isFinite(seekMax) ? seekMax : effectiveDuration,
      });
      if (Math.abs(clamped.value - pendingReactionSeconds) > 0.0005) {
        pendingReactionSeconds = clamped.value;
        const formatted = formatSecondsForInput(clamped.value);
        pendingReactionMinutesInput = formatted.minutes;
        pendingReactionSecondsInput = formatted.seconds;
      }
    }

    pendingTargetSeconds = parseInputsToSeconds(
      pendingTargetMinutesInput,
      pendingTargetSecondsInput,
      pendingTargetSeconds,
    );
    if (pendingConfig) {
      const nextRatio =
        viewportSpan > 0
          ? clamp01((pendingReactionSeconds - safeViewportStart) / viewportSpan)
          : 0;
      pendingConfig = {
        ...pendingConfig,
        reactionTime: pendingReactionSeconds,
        ratio: nextRatio,
      };
    }
  };

  const refreshActiveDerivedValues = () => {
    activeReactionSeconds = parseInputsToSeconds(
      activeReactionMinutesInput,
      activeReactionSecondsInput,
      activeReactionSeconds,
    );

    if (effectiveDuration > 0) {
      const clamped = cueBoundsClamped({
        value: activeReactionSeconds,
        min: 0,
        max: effectiveDuration,
      });
      if (Math.abs(clamped.value - activeReactionSeconds) > 0.0005) {
        activeReactionSeconds = clamped.value;
        const formatted = formatSecondsForInput(clamped.value);
        activeReactionMinutesInput = formatted.minutes;
        activeReactionSecondsInput = formatted.seconds;
      }
    }

    activeTargetSeconds = parseInputsToSeconds(
      activeTargetMinutesInput,
      activeTargetSecondsInput,
      activeTargetSeconds,
    );
    enforceActiveTargetLock();
    if (activeMarker) {
      const {
        initialTimeInReaction,
        initialTargetTime,
        initialState,
        initialVolume,
        initialRate,
        initialVisible,
        initialPrimary,
      } = activeMarker;
      const nextRatio =
        viewportSpan > 0
          ? clamp01((activeReactionSeconds - safeViewportStart) / viewportSpan)
          : 0;
      activeMarker = {
        ...activeMarker,
        timeInReaction: activeReactionSeconds,
        targetTime: activeTargetSeconds,
        ratio: nextRatio,
        initialTimeInReaction,
        initialTargetTime,
        initialState,
        initialVolume,
        initialRate,
        initialVisible,
        initialPrimary,
      };
    }
  };

  const enforceActiveTargetLock = () => {
    if (!shouldLockActivePauseTarget) {
      return;
    }
    const derived = computeOriginalTimeForNewEvent(activeReactionSeconds, {
      timeInReaction: activeMarker.initialTimeInReaction,
      state: activeMarker.initialState,
    });
    const safeDerived = Number.isFinite(derived) ? derived : 0;
    if (Math.abs(safeDerived - activeTargetSeconds) > 0.0005) {
      activeTargetSeconds = safeDerived;
      const formatted = formatSecondsForInput(safeDerived);
      activeTargetMinutesInput = formatted.minutes;
      activeTargetSecondsInput = formatted.seconds;
    }
  };

  const closeConfigPopup = () => {
    pendingConfig = null;
    pendingTargetMinutesInput = "0";
    pendingTargetSecondsInput = "0.00";
    pendingReactionMinutesInput = "0";
    pendingReactionSecondsInput = "0.00";
    pendingTargetSeconds = 0;
    pendingReactionSeconds = 0;
    pendingVolumeInput = "100";
    pendingPlaybackRateInput = "1";
    pendingOverlayVisibleInput = true;
    pendingOverlayPrimaryInput = overlayPrimaryDefault === "reaction" ? "reaction" : "original";
    showAdvancedPending = false;
  };

  const closeMarkerEditor = () => {
    activeMarker = null;
    activeTargetMinutesInput = "0";
    activeTargetSecondsInput = "0.00";
    activeReactionMinutesInput = "0";
    activeReactionSecondsInput = "0.00";
    activeTargetSeconds = 0;
    activeReactionSeconds = 0;
    activeMarkerIsDirty = false;
    activeVolumeInput = "100";
    activePlaybackRateInput = "1";
    activeOverlayVisibleInput = true;
    activeOverlayPrimaryInput = overlayPrimaryDefault === "reaction" ? "reaction" : "original";
    showAdvancedActive = false;
  };

  const handleTimelineClick = (event) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (event?.target?.closest?.(MARKER_INTERACTION_SELECTOR)) {
      return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    closeMarkerEditor();
    const timelineRegion = event?.target?.closest?.(TIMELINE_REGION_SELECTOR);
    if (!timelineRegion) {
      hoverViewportRatio = null;
      hoverTimeLabel = null;
      return;
    }
    const trackId = timelineRegion?.dataset?.trackId ?? "originalVideo";
    const coordinates = getTimelineCoordinates(
      event,
      timelineRegion.getBoundingClientRect(),
    );
    if (!coordinates) return;
    const reactionTime = coordinates.absoluteTime;
    const targetTime = computeOriginalTimeForNewEvent(reactionTime);
    hoverViewportRatio = coordinates.viewportRatio;
    hoverTimeLabel = formatTimecode(reactionTime);
    pendingConfig = {
      ratio: coordinates.viewportRatio,
      reactionTime,
      targetTime,
      trackId,
    };
    const reactionFormatted = formatSecondsForInput(reactionTime);
    pendingReactionMinutesInput = reactionFormatted.minutes;
    pendingReactionSecondsInput = reactionFormatted.seconds;
    const targetFormatted = formatSecondsForInput(targetTime);
    pendingTargetMinutesInput = targetFormatted.minutes;
    pendingTargetSecondsInput = targetFormatted.seconds;

    const volumeSource =
      trackId === "reactionVolume"
        ? reactionVolumeEventsSorted
        : volumeEventsSorted;
    const previousVolumeEvent = [...volumeSource]
      .filter(
        (entry) =>
          Number.isFinite(entry?.timeInReaction) &&
          entry.timeInReaction <= reactionTime,
      )
      .pop();
    const initialVolume = Number.isFinite(previousVolumeEvent?.volume)
      ? previousVolumeEvent.volume
      : 100;
    pendingVolumeInput = String(
      Math.round(Math.min(Math.max(initialVolume, 0), 100)),
    );

    const previousRateEvent = [...playbackRateEventsSorted]
      .filter(
        (entry) =>
          Number.isFinite(entry?.timeInReaction) &&
          entry.timeInReaction <= reactionTime,
      )
      .pop();
    const initialRate = Number.isFinite(previousRateEvent?.rate)
      ? previousRateEvent.rate
      : 1;
    pendingPlaybackRateInput = String(Math.round(initialRate * 100) / 100);

    const previousOverlayEvent = [...overlayVisibilityEventsSorted]
      .filter(
        (entry) =>
          Number.isFinite(entry?.timeInReaction) &&
          entry.timeInReaction <= reactionTime,
      )
      .pop();
    const initialVisible = typeof previousOverlayEvent?.visible === 'boolean'
      ? previousOverlayEvent.visible
      : true;
    const initialPrimary = previousOverlayEvent?.primary === "reaction"
      ? "reaction"
      : overlayPrimaryDefault === "reaction"
        ? "reaction"
        : "original";
    pendingOverlayVisibleInput = initialVisible;
    pendingOverlayPrimaryInput = initialPrimary;

    refreshPendingDerivedValues();
  };

  const handleTimelineKeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (effectiveDuration <= 0) return;
    closeMarkerEditor();
    const ratio = displayProgress;
    const reactionTime = safeViewportStart + ratio * viewportSpan;
    const targetTime = computeOriginalTimeForNewEvent(reactionTime);
    pendingConfig = {
      ratio,
      reactionTime,
      targetTime,
      trackId: "originalVideo",
    };
    const reactionFormatted = formatSecondsForInput(reactionTime);
    pendingReactionMinutesInput = reactionFormatted.minutes;
    pendingReactionSecondsInput = reactionFormatted.seconds;
    const targetFormatted = formatSecondsForInput(targetTime);
    pendingTargetMinutesInput = targetFormatted.minutes;
    pendingTargetSecondsInput = targetFormatted.seconds;
    pendingVolumeInput = "100";
    pendingPlaybackRateInput = "1";
    refreshPendingDerivedValues();
  };

  const handleWindowKeydown = (event) => {
    if (event.key === "Escape") {
      closeConfigPopup();
      closeMarkerEditor();
    }
  };

  const confirmConfigCreation = (rawState) => {
    if (!pendingConfig) return;
    const timeInReaction = Number.isFinite(pendingReactionSeconds)
      ? pendingReactionSeconds
      : pendingConfig.reactionTime;
    const targetTime = Number.isFinite(pendingTargetSeconds)
      ? pendingTargetSeconds
      : pendingConfig.targetTime;
    const state = Number.isFinite(rawState) ? Number(rawState) : 2;
    dispatch("createPlayerConfig", {
      timeInReaction,
      targetTime,
      state,
    });
    closeConfigPopup();
  };

  const confirmVolumeCreation = () => {
    if (!pendingConfig) return;
    const volume = Math.round(
      Math.min(Math.max(Number.parseFloat(pendingVolumeInput), 0), 100),
    );
    dispatch("createVolumeConfig", {
      timeInReaction: pendingConfig.reactionTime,
      volume,
    });
    closeConfigPopup();
  };

  const confirmReactionVolumeCreation = () => {
    if (!pendingConfig) return;
    const volume = Math.round(
      Math.min(Math.max(Number.parseFloat(pendingVolumeInput), 0), 100),
    );
    dispatch("createReactionVolumeConfig", {
      timeInReaction: pendingConfig.reactionTime,
      volume,
    });
    closeConfigPopup();
  };

  const confirmPlaybackRateCreation = () => {
    if (!pendingConfig) return;
    const rateCandidate = Number.parseFloat(pendingPlaybackRateInput);
    const rate =
      Number.isFinite(rateCandidate) && rateCandidate > 0 ? rateCandidate : 1;
    dispatch("createPlaybackRateConfig", {
      timeInReaction: pendingConfig.reactionTime,
      rate,
    });
    closeConfigPopup();
  };

  const confirmOverlayVisibilityCreation = () => {
    if (!pendingConfig) return;
    dispatch("createOverlayVisibilityConfig", {
      timeInReaction: pendingConfig.reactionTime,
      visible: pendingOverlayVisibleInput,
      primary:
        pendingOverlayPrimaryInput === "reaction" ? "reaction" : "original",
    });
    closeConfigPopup();
  };

  const openMarkerEditor = (marker) => {
    if (!marker) return;
    pendingConfig = null;
    hoverViewportRatio = null;
    hoverTimeLabel = null;
    const trackId = marker.trackId ?? "player";
    const markerTargetTime = Number.isFinite(marker.targetTime)
      ? marker.targetTime
      : 0;
    const markerState =
      typeof marker.state === "number" && Number.isFinite(marker.state)
        ? marker.state
        : 0;
    activeMarker = {
      id: marker.id,
      trackId,
      ratio: marker.ratio,
      timeInReaction: marker.timeInReaction,
      targetTime: markerTargetTime,
      state: markerState,
      volume: marker.volume,
      rate: marker.rate,
      visible: marker.visible,
      primary: marker.primary,
      initialTimeInReaction: marker.timeInReaction,
      initialTargetTime: markerTargetTime,
      initialState: markerState,
      initialVolume: marker.volume,
      initialRate: marker.rate,
      initialVisible: marker.visible,
      initialPrimary: marker.primary,
    };
    const reactionFormatted = formatSecondsForInput(marker.timeInReaction);
    activeReactionMinutesInput = reactionFormatted.minutes;
    activeReactionSecondsInput = reactionFormatted.seconds;

    if (trackId === "player") {
      const targetFormatted = formatSecondsForInput(markerTargetTime);
      activeTargetMinutesInput = targetFormatted.minutes;
      activeTargetSecondsInput = targetFormatted.seconds;
    } else {
      activeTargetMinutesInput = "0";
      activeTargetSecondsInput = "0.00";
      activeTargetSeconds = 0;
    }

    if (trackId === "volume" || trackId === "reactionVolume") {
      const initialVolume = Number.isFinite(marker.volume)
        ? marker.volume
        : 100;
      activeVolumeInput = String(
        Math.round(Math.min(Math.max(initialVolume, 0), 100)),
      );
    }

    if (trackId === "speed") {
      const initialRate =
        Number.isFinite(marker.rate) && marker.rate > 0 ? marker.rate : 1;
      activePlaybackRateInput = String(Math.round(initialRate * 100) / 100);
    }

    if (trackId === "overlayVisibility") {
      const initialVisible = typeof marker.visible === 'boolean' ? marker.visible : true;
      activeOverlayVisibleInput = initialVisible;
      activeOverlayPrimaryInput = marker.primary === "reaction" ? "reaction" : "original";
    }

    activeMarkerIsDirty = false;
    refreshActiveDerivedValues();
  };

  const confirmVolumeUpdate = () => {
    if (!activeMarker) return;
    const volume = Math.round(
      Math.min(Math.max(Number.parseFloat(activeVolumeInput), 0), 100),
    );
    dispatch("updateVolumeConfig", {
      timeInReaction: activeMarker.timeInReaction,
      volume,
      previousTimeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const confirmReactionVolumeUpdate = () => {
    if (!activeMarker) return;
    const volume = Math.round(
      Math.min(Math.max(Number.parseFloat(activeVolumeInput), 0), 100),
    );
    dispatch("updateReactionVolumeConfig", {
      timeInReaction: activeMarker.timeInReaction,
      volume,
      previousTimeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const confirmPlaybackRateUpdate = () => {
    if (!activeMarker) return;
    const rateCandidate = Number.parseFloat(activePlaybackRateInput);
    const rate =
      Number.isFinite(rateCandidate) && rateCandidate > 0 ? rateCandidate : 1;
    dispatch("updatePlaybackRateConfig", {
      timeInReaction: activeMarker.timeInReaction,
      rate,
      previousTimeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const confirmOverlayVisibilityUpdate = () => {
    if (!activeMarker) return;
    dispatch("updateOverlayVisibilityConfig", {
      timeInReaction: activeMarker.timeInReaction,
      visible: activeOverlayVisibleInput,
      primary: activeOverlayPrimaryInput === "reaction" ? "reaction" : "original",
      previousTimeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const handleActiveMarkerDelete = () => {
    if (!activeMarker) return;
    if (activeMarker.trackId === "volume") {
      dispatch("deleteVolumeConfig", {
        timeInReaction: activeMarker.initialTimeInReaction,
      });
    } else if (activeMarker.trackId === "reactionVolume") {
      dispatch("deleteReactionVolumeConfig", {
        timeInReaction: activeMarker.initialTimeInReaction,
      });
    } else if (activeMarker.trackId === "speed") {
      dispatch("deletePlaybackRateConfig", {
        timeInReaction: activeMarker.initialTimeInReaction,
      });
    } else if (activeMarker.trackId === "overlayVisibility") {
      dispatch("deleteOverlayVisibilityConfig", {
        timeInReaction: activeMarker.initialTimeInReaction,
      });
    } else {
      handleMarkerDelete();
      return;
    }
    closeMarkerEditor();
  };

  const handleMarkerKeydown = (event, marker) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openMarkerEditor(marker);
  };

  const confirmMarkerUpdate = (state) => {
    if (!activeMarker) return;
    dispatch("updatePlayerConfig", {
      state,
      timeInReaction: activeMarker.timeInReaction,
      targetTime: activeTargetSeconds,
      previousTimeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const handleMarkerDelete = () => {
    if (!activeMarker) return;
    dispatch("deletePlayerConfig", {
      timeInReaction: activeMarker.initialTimeInReaction,
    });
    closeMarkerEditor();
  };

  const isMarkerActive = (marker) =>
    !!activeMarker &&
    Math.abs(marker.timeInReaction - activeMarker.initialTimeInReaction) <
      0.001;

  const mirrorVolumeConfig = (event) => {
    const config = pendingConfig || activeMarker;
    if (!config) return;

    const { volume } = event.detail;

    const currentTrack = config.trackId;
    const timeInReaction = Number.isFinite(config.reactionTime)
      ? config.reactionTime
      : config.timeInReaction;

    if (currentTrack === "volume") {
      // Mirror to reactionVolume
      dispatch("createReactionVolumeConfig", {
        timeInReaction,
        volume,
      });
    } else if (currentTrack === "reactionVolume") {
      // Mirror to volume
      dispatch("createVolumeConfig", {
        timeInReaction,
        volume,
      });
    }

    if (pendingConfig) closeConfigPopup();
    if (activeMarker) closeMarkerEditor();
  };

  // Playhead drag handlers
  const updatePlayheadDrag = (event) => {
    if (!isDraggingPlayhead || !playheadDragRect) return;
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const offsetX = clientX - playheadDragRect.left;
    const ratio = Math.max(0, Math.min(1, offsetX / playheadDragRect.width));
    const targetTime = safeViewportStart + ratio * viewportSpan;
    dispatch("seek", { time: targetTime });
  };

  const endPlayheadDrag = () => {
    isDraggingPlayhead = false;
    playheadDragRect = null;
    window.removeEventListener("mousemove", updatePlayheadDrag);
    window.removeEventListener("mouseup", endPlayheadDrag);
    window.removeEventListener("touchmove", updatePlayheadDrag);
    window.removeEventListener("touchend", endPlayheadDrag);
  };

  const startPlayheadDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!playheadContainerEl) return;
    playheadDragRect = playheadContainerEl.getBoundingClientRect();
    isDraggingPlayhead = true;
    window.addEventListener("mousemove", updatePlayheadDrag);
    window.addEventListener("mouseup", endPlayheadDrag);
    window.addEventListener("touchmove", updatePlayheadDrag, {
      passive: false,
    });
    window.addEventListener("touchend", endPlayheadDrag);
    // Immediately seek to clicked position
    updatePlayheadDrag(event);
  };

  const cleanupPlayheadListeners = () => {
    window.removeEventListener("mousemove", updatePlayheadDrag);
    window.removeEventListener("mouseup", endPlayheadDrag);
    window.removeEventListener("touchmove", updatePlayheadDrag);
    window.removeEventListener("touchend", endPlayheadDrag);
  };

  onDestroy(cleanupZoomListeners);
  onDestroy(cleanupPlayheadListeners);
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="flex flex-col gap-3">
  <div
    class="flex items-center justify-between text-xs font-medium text-text-muted"
  >
    <span aria-label="Current time">{formatTimecode(safeCurrentTime)}</span>
    <span aria-label="Total duration">{formatTimecode(safeDuration)}</span>
  </div>
  <div
    class="relative rounded-xl border border-border-subtle/50 bg-surface/60 px-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
    on:mousemove={updateHover}
    on:mouseleave={clearHover}
    on:click={handleTimelineClick}
    on:keydown={handleTimelineKeydown}
    role="button"
    tabindex="0"
    aria-label="Reaction playback timeline"
    bind:this={timelineContainer}
  >

    {#if hoverIndicatorLeft && hoverTimeLabel && !pendingConfig && !activeMarker}
      <div
        class="pointer-events-none absolute -top-6 flex -translate-x-1/2 justify-center text-[10px] font-medium text-text-primary"
        style={`left: ${hoverIndicatorLeft}`}
        aria-hidden="true"
      >
        <span
          class="rounded-md border border-border-strong/60 bg-background/95 px-2 py-0.5 shadow-sm"
        >
          {hoverTimeLabel}
        </span>
      </div>
    {/if}

    <!-- Replace the tracks wrapper with a relative wrapper that has room for the global indicator -->
    <div class="relative flex flex-col gap-4 pt-6">
      <!-- Global current-time indicator (aligned to the region column: w-28 + gap-3) -->
      <div
        class="pointer-events-auto absolute left-[calc(7rem+0.75rem)] right-0 top-0 h-6 cursor-ew-resize"
        aria-label="Playhead scrubber"
        role="slider"
        aria-valuenow={safeCurrentTime}
        aria-valuemin={safeViewportStart}
        aria-valuemax={safeViewportEnd}
        tabindex="0"
        bind:this={playheadContainerEl}
        on:mousedown={startPlayheadDrag}
        on:touchstart={startPlayheadDrag}
      >
        <button
          type="button"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
          style={`left: ${indicatorPosition}`}
          aria-label="Drag to scrub playback"
          tabindex="-1"
        >
          <!-- Playhead icon: upward triangle (pointing down at timeline) -->
          <svg
            class="h-5 w-5 text-accent-primary drop-shadow rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M10 3a1 1 0 0 1 .894.553l5 10A1 1 0 0 1 15 15H5a1 1 0 0 1-.894-1.447l5-10A1 1 0 0 1 10 3z"
            />
          </svg>
        </button>
      </div>

      {#each visibleTracks as track (track.id)}
        <div class="flex items-center gap-3">
          <span
            class="w-28 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >{track.label}</span
          >
          <div
            class="relative flex-1 py-2"
            data-timeline-region="true"
            data-track-id={track.id}
            on:mousedown={startZoomSelection}
            role="button"
            aria-label={`${track.label} timeline`}
            tabindex="-1"
          >
            {#if zoomSelectionLeft && zoomSelectionWidth}
              <div
                class="pointer-events-none absolute top-0 bottom-0 z-10 rounded-full bg-accent-secondary/15"
                style={`left: ${zoomSelectionLeft}; width: ${zoomSelectionWidth};`}
                aria-hidden="true"
              ></div>
            {/if}
            <div
              class="absolute left-0 right-0 top-1/2 z-0 h-2 -translate-y-1/2 rounded-full bg-border-subtle/40"
            ></div>

            {#each track.markers as marker (marker.id)}
              <div
                class="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={`left: ${toViewportPosition(marker.timeInReaction)}`}
              >
                {#if marker.editable}
                  <button
                    type="button"
                    class={`pointer-events-auto relative inline-flex items-center justify-center rounded-full transition backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 hover:z-30 focus-visible:z-30 ${marker.icon ? "h-4 w-4 hover:h-8 hover:w-8 hover:z-30" : "min-w-[2.25rem] px-2 py-1 text-[10px] font-semibold leading-none"} ${MARKER_STYLES[marker.tone] ?? "bg-background/80 text-text-muted"} ${isMarkerActive(marker) ? "ring-2 ring-accent-primary/60" : ""}`}
                    title={`${marker.label} at ${marker.timeLabel}`}
                    aria-label={`${marker.label} at ${marker.timeLabel}`}
                    data-marker-interaction="true"
                    on:click|stopPropagation={() => openMarkerEditor(marker)}
                    on:keydown|stopPropagation={(event) =>
                      handleMarkerKeydown(event, marker)}
                    on:mousedown|stopPropagation
                  >
                    <span class="sr-only"
                      >{marker.label} at {marker.timeLabel}</span
                    >
                    {#if marker.icon}
                      <span class="pointer-events-none inline-flex items-center gap-1" aria-hidden="true">
                        <svelte:component
                          this={marker.icon}
                          class="h-2 w-2 hover:h-4 hover:w-4 hover:z-30 transition-transform"
                        />
                        {#if marker.primaryIndicator}
                          <span class="text-[9px] font-bold leading-none">{marker.primaryIndicator}</span>
                        {/if}
                      </span>
                    {:else}
                      <span aria-hidden="true">{marker.displayValue}</span>
                    {/if}
                  </button>
                {:else}
                  <div
                    class={`pointer-events-auto relative inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none transition hover:z-30 ${MARKER_STYLES[marker.tone] ?? "bg-background/80 text-text-muted"}`}
                    title={`${marker.label} at ${marker.timeLabel}`}
                    aria-label={`${marker.label} at ${marker.timeLabel}`}
                    data-marker-interaction="true"
                  >
                    {marker.displayValue}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    {#if pendingConfig}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div
        class="pointer-events-auto absolute top-full mt-4 flex min-w-[18rem] w-max -translate-x-1/2 flex-col gap-2 rounded-lg border border-border-strong/60 bg-background/95 p-3 text-xs shadow-lg z-10"
        style={`left: ${(pendingConfig.ratio * 100).toFixed(3)}%`}
        role="dialog"
        aria-modal="false"
        aria-label="New playback configuration"
        on:click|stopPropagation
        on:keydown|stopPropagation
        tabindex="-1"
      >
        <div
          class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 text-left"
        >
          <span class="text-xs text-text-muted whitespace-nowrap"
            >Reaction at</span
          >
          <div class="flex flex-nowrap items-end gap-3">
            <div class="flex items-center gap-1">
              <label class="sr-only" for={PENDING_REACTION_MINUTES_INPUT_ID}
                >Reaction minutes</label
              >
              <input
                id={PENDING_REACTION_MINUTES_INPUT_ID}
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="w-16 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={pendingReactionMinutesInput}
                on:input={(event) => {
                  pendingReactionMinutesInput = event.currentTarget.value;
                  refreshPendingDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">min</span>
            </div>
            <div class="flex items-center gap-1">
              <label class="sr-only" for={PENDING_REACTION_SECONDS_INPUT_ID}
                >Reaction seconds</label
              >
              <input
                id={PENDING_REACTION_SECONDS_INPUT_ID}
                type="number"
                min="0"
                max="59.99"
                step="0.5"
                inputmode="decimal"
                class="w-20 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={pendingReactionSecondsInput}
                on:input={(event) => {
                  pendingReactionSecondsInput = event.currentTarget.value;
                  refreshPendingDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">sec</span>
            </div>
          </div>
          <span class="text-xs text-text-muted whitespace-nowrap"
            >Original video at</span
          >
          <div class="flex flex-nowrap items-end gap-3">
            <div class="flex items-center gap-1">
              <label class="sr-only" for={PENDING_TARGET_MINUTES_INPUT_ID}
                >Original minutes</label
              >
              <input
                id={PENDING_TARGET_MINUTES_INPUT_ID}
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="w-16 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={pendingTargetMinutesInput}
                on:input={(event) => {
                  pendingTargetMinutesInput = event.currentTarget.value;
                  refreshPendingDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">min</span>
            </div>
            <div class="flex items-center gap-1">
              <label class="sr-only" for={PENDING_TARGET_SECONDS_INPUT_ID}
                >Original seconds</label
              >
              <input
                id={PENDING_TARGET_SECONDS_INPUT_ID}
                type="number"
                min="0"
                max="59.99"
                step="0.5"
                inputmode="decimal"
                class="w-20 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={pendingTargetSecondsInput}
                on:input={(event) => {
                  pendingTargetSecondsInput = event.currentTarget.value;
                  refreshPendingDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">sec</span>
            </div>
          </div>
        </div>
        {#if pendingConfig.trackId === "originalVideo"}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="flex-1 rounded-md border border-border-strong/70 bg-surface/90 px-2 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
              on:click|stopPropagation={() => confirmConfigCreation(1)}
            >
              Play original here
            </button>
            <button
              type="button"
              class="flex-1 rounded-md border border-border-strong/70 bg-surface/90 px-2 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
              on:click|stopPropagation={() => confirmConfigCreation(2)}
            >
              Pause original here
            </button>
          </div>
        {:else if pendingConfig.trackId === "speed"}
          <div class="flex flex-col gap-2">
            <label
              class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              for="pending-playback-rate"
            >
              Playback speed
            </label>
            <div class="flex gap-2">
              <select
                id="pending-playback-rate"
                class="flex-1 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                bind:value={pendingPlaybackRateInput}
              >
                {#each PLAYBACK_RATE_OPTIONS as option}
                  <option value={option.toString()}
                    >{formatRateDisplay(option)}</option
                  >
                {/each}
              </select>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-secondary/60 hover:text-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={confirmPlaybackRateCreation}
              >
                Set speed
              </button>
            </div>
          </div>
        {:else if pendingConfig.trackId === "volume" || pendingConfig.trackId === "reactionVolume"}
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <label
                class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                for="pending-volume"
              >
                {pendingConfig.trackId === "reactionVolume"
                  ? "Reaction volume"
                  : "Original volume"}
              </label>
            </div>
            <div class="flex gap-2">
              <input
                id="pending-volume"
                type="number"
                min="0"
                max="100"
                step="1"
                inputmode="numeric"
                class="flex-1 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                bind:value={pendingVolumeInput}
              />
              <span class="self-center text-xs text-text-muted">%</span>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={() =>
                  pendingConfig?.trackId === "reactionVolume"
                    ? confirmReactionVolumeCreation()
                    : confirmVolumeCreation()}
              >
                Set volume
              </button>
            </div>
            {#if showAdvancedPending}
              <div id="pending-advanced-options">
                <AdvancedVolumeControl on:mirror={mirrorVolumeConfig} />
              </div>
            {/if}
          </div>
        {:else if pendingConfig.trackId === "overlayVisibility"}
          <div class="flex flex-col gap-2">
            <label
              class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              for="pending-overlay-visible"
            >
              Overlay settings
            </label>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  id="pending-overlay-visible"
                  type="checkbox"
                  class="h-4 w-4 rounded border-border-strong/50 bg-surface/90 text-accent-primary focus:ring-2 focus:ring-accent-primary/40"
                  bind:checked={pendingOverlayVisibleInput}
                />
                <span class="text-sm text-text-primary">Show overlay</span>
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${pendingOverlayPrimaryInput === "original" ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary hover:border-accent-primary/50 hover:text-accent-primary"}`}
                  on:click|stopPropagation={() => {
                    pendingOverlayPrimaryInput = "original";
                  }}
                >
                  Original primary (O)
                </button>
                <button
                  type="button"
                  class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${pendingOverlayPrimaryInput === "reaction" ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary hover:border-accent-primary/50 hover:text-accent-primary"}`}
                  on:click|stopPropagation={() => {
                    pendingOverlayPrimaryInput = "reaction";
                  }}
                >
                  Reaction primary (R)
                </button>
              </div>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={confirmOverlayVisibilityCreation}
              >
                Set overlay cue
              </button>
            </div>
            <p class="text-[10px] text-text-muted">
              {pendingOverlayVisibleInput 
                ? `Overlay will be shown with ${pendingOverlayPrimaryInput === "reaction" ? "reaction" : "original"} as primary.`
                : `Overlay will be hidden and ${pendingOverlayPrimaryInput === "reaction" ? "reaction" : "original"} remains primary.`}
            </p>
          </div>
        {/if}
        <button
          type="button"
          class="self-end rounded-md bg-transparent px-2 py-1 text-[11px] font-medium text-text-muted transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle"
          on:click|stopPropagation={closeConfigPopup}
        >
          Cancel
        </button>
      </div>
    {/if}
    {#if activeMarker}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div
        class="pointer-events-auto absolute top-full mt-4 flex min-w-[18rem] w-max -translate-x-1/2 flex-col gap-3 rounded-lg border border-border-strong/60 bg-background/95 p-3 text-xs shadow-lg z-10"
        style={`left: ${(activeMarker.ratio * 100).toFixed(3)}%`}
        role="dialog"
        aria-modal="false"
        aria-label={activeMarker.trackId === "volume" ||
        activeMarker.trackId === "reactionVolume"
          ? "Edit volume cue"
          : activeMarker.trackId === "speed"
            ? "Edit playback speed cue"
            : activeMarker.trackId === "overlayVisibility"
              ? "Edit overlay cue"
            : "Edit playback cue"}
        on:click|stopPropagation
        on:keydown|stopPropagation
        tabindex="-1"
      >
        <div
          class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 text-left"
        >
          <span class="text-xs text-text-muted whitespace-nowrap"
            >Reaction at</span
          >
          <div class="flex flex-nowrap items-end gap-3">
            <div class="flex items-center gap-1">
              <label class="sr-only" for={ACTIVE_REACTION_MINUTES_INPUT_ID}
                >Reaction minutes</label
              >
              <input
                id={ACTIVE_REACTION_MINUTES_INPUT_ID}
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="w-16 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={activeReactionMinutesInput}
                on:input={(event) => {
                  activeReactionMinutesInput = event.currentTarget.value;
                  activeMarkerIsDirty = true;
                  refreshActiveDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">min</span>
            </div>
            <div class="flex items-center gap-1">
              <label class="sr-only" for={ACTIVE_REACTION_SECONDS_INPUT_ID}
                >Reaction seconds</label
              >
              <input
                id={ACTIVE_REACTION_SECONDS_INPUT_ID}
                type="number"
                min="0"
                max="59.99"
                step="0.5"
                inputmode="decimal"
                class="w-20 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                value={activeReactionSecondsInput}
                on:input={(event) => {
                  activeReactionSecondsInput = event.currentTarget.value;
                  activeMarkerIsDirty = true;
                  refreshActiveDerivedValues();
                }}
              />
              <span class="text-xs text-text-muted">sec</span>
            </div>
          </div>
          {#if activeMarker.trackId === "player"}
            <span class="text-xs text-text-muted whitespace-nowrap"
              >Original video at</span
            >
            <div class="flex flex-nowrap items-end gap-3">
              <div class="flex items-center gap-1">
                <label class="sr-only" for={ACTIVE_TARGET_MINUTES_INPUT_ID}
                  >Original minutes</label
                >
                <input
                  id={ACTIVE_TARGET_MINUTES_INPUT_ID}
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class={`w-16 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${shouldLockActivePauseTarget ? "cursor-not-allowed opacity-60" : ""}`}
                  readonly={shouldLockActivePauseTarget}
                  disabled={shouldLockActivePauseTarget}
                  value={activeTargetMinutesInput}
                  on:input={(event) => {
                    activeTargetMinutesInput = event.currentTarget.value;
                    activeMarkerIsDirty = true;
                    refreshActiveDerivedValues();
                  }}
                />
                <span class="text-xs text-text-muted">min</span>
              </div>
              <div class="flex items-center gap-1">
                <label class="sr-only" for={ACTIVE_TARGET_SECONDS_INPUT_ID}
                  >Original seconds</label
                >
                <input
                  id={ACTIVE_TARGET_SECONDS_INPUT_ID}
                  type="number"
                  min="0"
                  max="59.99"
                  step="0.5"
                  inputmode="decimal"
                  class={`w-20 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${shouldLockActivePauseTarget ? "cursor-not-allowed opacity-60" : ""}`}
                  readonly={shouldLockActivePauseTarget}
                  disabled={shouldLockActivePauseTarget}
                  value={activeTargetSecondsInput}
                  on:input={(event) => {
                    activeTargetSecondsInput = event.currentTarget.value;
                    activeMarkerIsDirty = true;
                    refreshActiveDerivedValues();
                  }}
                />
                <span class="text-xs text-text-muted">sec</span>
              </div>
            </div>
          {/if}
        </div>
        {#if activeMarker.trackId === "player"}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 hover:border-accent-primary/50 hover:text-accent-primary ${activeMarker.state === 1 ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary"}`}
              aria-pressed={activeMarker.state === 1}
              on:click|stopPropagation={() => confirmMarkerUpdate(1)}
            >
              Play original here
            </button>
            <button
              type="button"
              class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 hover:border-accent-primary/50 hover:text-accent-primary ${activeMarker.state === 2 ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary"}`}
              aria-pressed={activeMarker.state === 2}
              on:click|stopPropagation={() => confirmMarkerUpdate(2)}
            >
              Pause original here
            </button>
          </div>
        {:else if activeMarker.trackId === "speed"}
          <div class="flex flex-col gap-2">
            <label
              class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              for="active-playback-rate"
            >
              Playback speed
            </label>
            <div class="flex gap-2">
              <select
                id="active-playback-rate"
                class="flex-1 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                bind:value={activePlaybackRateInput}
                on:change={() => {
                  activeMarkerIsDirty = true;
                }}
              >
                {#each PLAYBACK_RATE_OPTIONS as option}
                  <option value={option.toString()}
                    >{formatRateDisplay(option)}</option
                  >
                {/each}
              </select>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-secondary/60 hover:text-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={confirmPlaybackRateUpdate}
              >
                Set speed
              </button>
            </div>
          </div>
        {:else if activeMarker.trackId === "volume" || activeMarker.trackId === "reactionVolume"}
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <label
                class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                for="active-volume"
              >
                {activeMarker.trackId === "reactionVolume"
                  ? "Reaction volume"
                  : "Original volume"}
              </label>
            </div>
            <div class="flex gap-2">
              <input
                id="active-volume"
                type="number"
                min="0"
                max="100"
                step="1"
                inputmode="numeric"
                class="flex-1 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                bind:value={activeVolumeInput}
                on:input={() => {
                  activeMarkerIsDirty = true;
                }}
              />
              <span class="self-center text-xs text-text-muted">%</span>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={() =>
                  activeMarker?.trackId === "reactionVolume"
                    ? confirmReactionVolumeUpdate()
                    : confirmVolumeUpdate()}
              >
                Set volume
              </button>
            </div>
            {#if showAdvancedActive}
              <div id="active-advanced-options">
                <AdvancedVolumeControl on:mirror={mirrorVolumeConfig} />
              </div>
            {/if}
          </div>
        {:else if activeMarker.trackId === "overlayVisibility"}
          <div class="flex flex-col gap-2">
            <label
              class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              for="active-overlay-visible"
            >
              Overlay settings
            </label>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  id="active-overlay-visible"
                  type="checkbox"
                  class="h-4 w-4 rounded border-border-strong/50 bg-surface/90 text-accent-primary focus:ring-2 focus:ring-accent-primary/40"
                  bind:checked={activeOverlayVisibleInput}
                  on:change={() => {
                    activeMarkerIsDirty = true;
                  }}
                />
                <span class="text-sm text-text-primary">Show overlay</span>
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${activeOverlayPrimaryInput === "original" ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary hover:border-accent-primary/50 hover:text-accent-primary"}`}
                  on:click|stopPropagation={() => {
                    activeOverlayPrimaryInput = "original";
                    activeMarkerIsDirty = true;
                  }}
                >
                  Original primary (O)
                </button>
                <button
                  type="button"
                  class={`flex-1 rounded-md border bg-surface/90 px-2 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60 ${activeOverlayPrimaryInput === "reaction" ? "border-accent-primary/60 text-accent-primary" : "border-border-strong/70 text-text-primary hover:border-accent-primary/50 hover:text-accent-primary"}`}
                  on:click|stopPropagation={() => {
                    activeOverlayPrimaryInput = "reaction";
                    activeMarkerIsDirty = true;
                  }}
                >
                  Reaction primary (R)
                </button>
              </div>
              <button
                type="button"
                class="rounded-md border border-border-strong/70 bg-surface/90 px-3 py-1 font-semibold text-text-primary transition hover:border-accent-primary/50 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                on:click|stopPropagation={confirmOverlayVisibilityUpdate}
              >
                Set overlay cue
              </button>
            </div>
            <p class="text-[10px] text-text-muted">
              {activeOverlayVisibleInput
                ? `Overlay will be shown with ${activeOverlayPrimaryInput === "reaction" ? "reaction" : "original"} as primary.`
                : `Overlay will be hidden and ${activeOverlayPrimaryInput === "reaction" ? "reaction" : "original"} remains primary.`}
            </p>
          </div>
        {/if}
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            {#if activeMarker.trackId === "volume" || activeMarker.trackId === "reactionVolume"}
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-border-subtle/60 bg-surface/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted transition hover:border-accent-primary/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
                aria-expanded={showAdvancedActive}
                aria-controls="active-advanced-options"
                on:mouseenter={() => (showAdvancedActive = true)}
                on:click|stopPropagation={() => {
                  showAdvancedActive = !showAdvancedActive;
                }}
              >
                Advanced
              </button>
            {/if}
            <button
              type="button"
              class="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 font-semibold text-danger transition hover:border-danger/60 hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
              on:click|stopPropagation={handleActiveMarkerDelete}
            >
              Delete cue
            </button>
          </div>
          <button
            type="button"
            class="rounded-md bg-transparent px-2 py-1 text-[11px] font-medium text-text-muted transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle"
            on:click|stopPropagation={closeMarkerEditor}
          >
            Close
          </button>
        </div>
      </div>
    {/if}
  </div>
  {#if isZoomed}
    <div class="flex justify-end pt-1">
      <button
        type="button"
        class="inline-flex items-center rounded-md border border-border-subtle/60 bg-surface/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted transition hover:border-accent-primary/60 hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
        on:click={resetZoom}
      >
        Reset zoom
      </button>
    </div>
  {/if}
  <span class="sr-only" aria-live="polite">
    Timeline position {formatTimecode(safeCurrentTime)} of {formatTimecode(
      safeDuration,
    )}.
    {#if playerMarkers.length}
      Original video: {#each playerMarkers as marker, index}{marker.label} at {marker.timeLabel}{index <
        playerMarkers.length - 1
          ? "; "
          : "."}{/each}
    {/if}
    {#if playbackRateMarkers.length}
      Speed changes: {#each playbackRateMarkers as marker, index}{marker.displayValue}
        at {marker.timeLabel}{index < playbackRateMarkers.length - 1
          ? "; "
          : "."}{/each}
    {/if}
    {#if volumeMarkers.length}
      Volume changes: {#each volumeMarkers as marker, index}{marker.displayValue}
        at {marker.timeLabel}{index < volumeMarkers.length - 1
          ? "; "
          : "."}{/each}
    {/if}
  </span>
</div>

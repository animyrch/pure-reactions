<script>
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";
  import HelpfulTip from "$lib/components/design-system/HelpfulTip.svelte";
  import TimeStepper from "$lib/components/reaction/TimeStepper.svelte";
  import ConfigEditorV2 from "$lib/components/Video/ConfigEditorV2.svelte";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";

  export let isReactionMissing = false;
  export let isEditModeOn = false;
  export let isFineTuneModeOn = false;
  export let isPlaylist = false;
  export let reactionVideoId = "";
  export let reactionVideoTitle = "";
  export let reactionVideoIdError = "";
  export let isSettingReactionVideoId = false;
  export let remixMode = false;
  export let isSettingRemixMode = false;
  export let offsetStartTime = 0;
  export let introBufferTime = 0;
  export let reactionFinishTime = 0;
  export let soundLevel = 100;
  export let isReactionMuteModeEnabled = false;
  export let playerConfigs = {};
  export let volumeConfigs = {};
  export let reactionVolumeConfigs = {};
  export let stateTimeline = [];
  export let volumeTimeline = [];
  export let reactionVolumeTimeline = [];
  export let playbackRateConfigs = {};
  export let playbackRateTimeline = [];
  export let overlayVisibilityTimeline = [];
  export let reactionCurrentTime = 0;
  export let reactionDuration = 0;
  export let originalCurrentTime = 0;
  export let originalDuration = 0;
  export let playerEventTimeline = [];
  export let fullscreenPrimaryVideoDefault = "original";
  export let fullscreenOverlayWidthPercent = 35;
  export let fullscreenOverlayCorner = "top-right";
  /** Original video platform. Controls which editing capabilities are available. */
  export let originalVideoPlatform = "youtube";
  export let onCreatePlayerConfig = async () => {};
  export let onCreateVolumeConfig = async () => {};
  export let onCreateReactionVolumeConfig = async () => {};
  export let onCreatePlaybackRateConfig = async () => {};
  export let onCreateOverlayVisibilityConfig = async () => {};
  export let onUpdatePlayerConfig = async () => {};
  export let onDeletePlayerConfig = async () => {};
  export let onUpdateVolumeConfig = async () => {};
  export let onUpdateReactionVolumeConfig = async () => {};
  export let onDeleteVolumeConfig = async () => {};
  export let onDeleteReactionVolumeConfig = async () => {};
  export let onUpdatePlaybackRateConfig = async () => {};
  export let onDeletePlaybackRateConfig = async () => {};
  export let onUpdateOverlayVisibilityConfig = async () => {};
  export let onDeleteOverlayVisibilityConfig = async () => {};

  export let onSetReactionVideoId = () => {};
  export let onSetRemixMode = async () => {};
  export let onSaveGeneralSettings = async () => {};
  export let onSeek = (_time) => {};

  $: isTikTokOriginal = originalVideoPlatform === "tiktok";

  const SOUND_LEVEL_MIN = 0;
  const SOUND_LEVEL_MAX = 200;
  const SOUND_LEVEL_STEP = 1;
  const OVERLAY_WIDTH_MIN = 5;
  const OVERLAY_WIDTH_MAX = 80;
  const OVERLAY_WIDTH_STEP = 5;
  const DEFAULT_OVERLAY_WIDTH = 35;

  // Off tracks use a lifted gray and a light thumb. The on state stays the accent fill with a dark thumb.
  const switchTrackBase =
    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";
  const switchTrackOff =
    "border-text-muted/70 bg-border-strong hover:brightness-125";
  const switchTrackOn = "border-accent-primary bg-accent-primary";
  const switchThumbBase =
    "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-surface transition duration-subtle ease-cinematic";
  const switchThumbOff = "translate-x-0.5 bg-text-primary";
  const switchThumbOn = "translate-x-5 bg-surface";

  const OVERLAY_POSITIONS = [
    { value: "top-left", label: "Top left", x: 3, y: 3 },
    { value: "top-center", label: "Top center", x: 8, y: 3 },
    { value: "top-right", label: "Top right", x: 13, y: 3 },
    { value: "middle-left", label: "Middle left", x: 3, y: 9 },
    { value: "middle-right", label: "Middle right", x: 13, y: 9 },
    { value: "bottom-left", label: "Bottom left", x: 3, y: 15 },
    { value: "bottom-center", label: "Bottom center", x: 8, y: 15 },
    { value: "bottom-right", label: "Bottom right", x: 13, y: 15 },
  ];

  const clampOverlayWidth = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_OVERLAY_WIDTH;
    const snapped = Math.round(parsed / OVERLAY_WIDTH_STEP) * OVERLAY_WIDTH_STEP;
    return Math.max(OVERLAY_WIDTH_MIN, Math.min(OVERLAY_WIDTH_MAX, snapped));
  };

  const formatDurationLabel = (seconds) => {
    const total = Math.round(Number(seconds) || 0);
    if (total <= 0) return "";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  let reactionVideoIdValue = reactionVideoId ?? "";
  let offsetStartMinutesValue = "0";
  let offsetStartSecondsValue = "0";
  let reactionFinishMinutesValue = "0";
  let reactionFinishSecondsValue = "0";
  let introBufferTimeValue = introBufferTime?.toString?.() ?? "";
  let soundLevelValue = Number.isFinite(soundLevel) ? soundLevel : 100;
  let primaryDraft = fullscreenPrimaryVideoDefault || "original";
  let cornerDraft = fullscreenOverlayCorner || "top-right";
  let muteDraft = Boolean(isReactionMuteModeEnabled);
  let overlayWidthValue = clampOverlayWidth(fullscreenOverlayWidthPercent);
  let isSavingGeneral = false;
  // One general-config section stays open. Source is open on first paint.
  let openGeneralSection = "source";

  const toggleGeneralSection = (id) => {
    openGeneralSection = openGeneralSection === id ? "" : id;
  };

  let lastReactionVideoIdProp = reactionVideoId;
  let lastOffsetStartTimeProp = offsetStartTime;
  let lastIntroBufferTimeProp = introBufferTime;
  let lastReactionFinishTimeProp = reactionFinishTime;
  let lastSoundLevelProp = soundLevel;
  let lastPrimaryProp = fullscreenPrimaryVideoDefault;
  let lastCornerProp = fullscreenOverlayCorner;
  let lastMuteProp = isReactionMuteModeEnabled;
  let lastOverlayWidthProp = fullscreenOverlayWidthPercent;

  $: if (reactionVideoId !== lastReactionVideoIdProp) {
    lastReactionVideoIdProp = reactionVideoId;
    reactionVideoIdValue = reactionVideoId ?? "";
  }

  const syncOffsetStartInputs = (value) => {
    const totalSeconds = Math.max(0, Number(value) || 0);
    const minutesPart = Math.floor(totalSeconds / 60);
    const secondsPartRaw = totalSeconds - minutesPart * 60;
    const secondsPart = Math.round(secondsPartRaw * 10) / 10; // 1 decimal
    offsetStartMinutesValue = String(minutesPart);
    offsetStartSecondsValue = Number.isInteger(secondsPart)
      ? String(secondsPart)
      : secondsPart.toFixed(1);
  };

  syncOffsetStartInputs(offsetStartTime);

  const syncReactionFinishInputs = (value) => {
    // If value is 0 (or falsy) use reactionDuration, otherwise use the value.
    const effectiveValue =
      Number(value) > 0 ? Number(value) : reactionDuration || 0;
    const totalSeconds = Math.max(0, effectiveValue);
    const minutesPart = Math.floor(totalSeconds / 60);
    const secondsPartRaw = totalSeconds - minutesPart * 60;
    const secondsPart = Math.round(secondsPartRaw * 10) / 10; // 1 decimal
    reactionFinishMinutesValue = String(minutesPart);
    reactionFinishSecondsValue = Number.isInteger(secondsPart)
      ? String(secondsPart)
      : secondsPart.toFixed(1);
  };

  syncReactionFinishInputs(reactionFinishTime);

  $: if (!isSavingGeneral && offsetStartTime !== lastOffsetStartTimeProp) {
    lastOffsetStartTimeProp = offsetStartTime;
    syncOffsetStartInputs(offsetStartTime);
  }

  $: if (!isSavingGeneral && introBufferTime !== lastIntroBufferTimeProp) {
    lastIntroBufferTimeProp = introBufferTime;
    introBufferTimeValue = introBufferTime?.toString?.() ?? "";
  }

  $: if (!isSavingGeneral && reactionFinishTime !== lastReactionFinishTimeProp) {
    lastReactionFinishTimeProp = reactionFinishTime;
    syncReactionFinishInputs(reactionFinishTime);
  }

  // A stored finish of 0 means "play until the video ends", so show the duration.
  $: if (!isSavingGeneral && reactionDuration && reactionFinishTime <= 0) {
    syncReactionFinishInputs(reactionFinishTime);
  }

  $: if (!isSavingGeneral && soundLevel !== lastSoundLevelProp) {
    lastSoundLevelProp = soundLevel;
    soundLevelValue = Number.isFinite(soundLevel) ? soundLevel : 100;
  }

  $: if (!isSavingGeneral && fullscreenPrimaryVideoDefault !== lastPrimaryProp) {
    lastPrimaryProp = fullscreenPrimaryVideoDefault;
    primaryDraft = fullscreenPrimaryVideoDefault || "original";
  }

  $: if (!isSavingGeneral && fullscreenOverlayCorner !== lastCornerProp) {
    lastCornerProp = fullscreenOverlayCorner;
    cornerDraft = fullscreenOverlayCorner || "top-right";
  }

  $: if (!isSavingGeneral && isReactionMuteModeEnabled !== lastMuteProp) {
    lastMuteProp = isReactionMuteModeEnabled;
    muteDraft = Boolean(isReactionMuteModeEnabled);
  }

  $: if (!isSavingGeneral && fullscreenOverlayWidthPercent !== lastOverlayWidthProp) {
    lastOverlayWidthProp = fullscreenOverlayWidthPercent;
    overlayWidthValue = clampOverlayWidth(fullscreenOverlayWidthPercent);
  }

  $: trimmedReactionVideoIdValue = (reactionVideoIdValue ?? "").trim();
  $: currentReactionVideoId = (reactionVideoId ?? "").trim();
  $: isReactionVideoIdDirty =
    trimmedReactionVideoIdValue.length > 0 &&
    trimmedReactionVideoIdValue !== currentReactionVideoId;

  $: parsedIntroBufferTimeValue = Number.parseFloat(introBufferTimeValue);
  $: isIntroBufferTimeValid = !Number.isNaN(parsedIntroBufferTimeValue);
  $: isIntroBufferTimeDirty =
    isIntroBufferTimeValid && parsedIntroBufferTimeValue !== introBufferTime;

  $: parsedOffsetStartMinutes = Number.parseInt(offsetStartMinutesValue, 10);
  $: parsedOffsetStartSeconds = Number.parseFloat(offsetStartSecondsValue);
  $: isOffsetStartValid =
    Number.isFinite(parsedOffsetStartMinutes) &&
    parsedOffsetStartMinutes >= 0 &&
    Number.isFinite(parsedOffsetStartSeconds) &&
    parsedOffsetStartSeconds >= 0 &&
    parsedOffsetStartSeconds < 60;
  $: nextOffsetStartTimeSeconds = isOffsetStartValid
    ? parsedOffsetStartMinutes * 60 + parsedOffsetStartSeconds
    : 0;
  $: isOffsetStartDirty =
    isOffsetStartValid &&
    Math.abs(nextOffsetStartTimeSeconds - Number(offsetStartTime || 0)) >
      0.0001;

  $: parsedReactionFinishMinutes = Number.parseInt(
    reactionFinishMinutesValue,
    10,
  );
  $: parsedReactionFinishSeconds = Number.parseFloat(
    reactionFinishSecondsValue,
  );
  $: isReactionFinishTimeValid =
    Number.isFinite(parsedReactionFinishMinutes) &&
    parsedReactionFinishMinutes >= 0 &&
    Number.isFinite(parsedReactionFinishSeconds) &&
    parsedReactionFinishSeconds >= 0 &&
    parsedReactionFinishSeconds < 60;
  $: nextReactionFinishTimeSeconds = isReactionFinishTimeValid
    ? parsedReactionFinishMinutes * 60 + parsedReactionFinishSeconds
    : 0;
  // Stored 0 displays as the video duration, so that default is not an unsaved edit.
  $: effectiveStoredFinishSeconds =
    Number(reactionFinishTime) > 0
      ? Number(reactionFinishTime)
      : Number(reactionDuration) > 0
        ? Number(reactionDuration)
        : 0;
  $: isReactionFinishTimeDirty =
    isReactionFinishTimeValid &&
    Math.abs(nextReactionFinishTimeSeconds - effectiveStoredFinishSeconds) >
      0.0001;

  $: isSoundLevelDirty =
    Number.isFinite(soundLevelValue) && soundLevelValue !== soundLevel;
  $: overlayWidthClamped = clampOverlayWidth(overlayWidthValue);
  $: isOverlayWidthDirty =
    !remixMode &&
    overlayWidthClamped !== clampOverlayWidth(fullscreenOverlayWidthPercent);
  $: isPrimaryDirty =
    !remixMode && primaryDraft !== (fullscreenPrimaryVideoDefault || "original");
  $: isCornerDirty = !remixMode && cornerDraft !== (fullscreenOverlayCorner || "top-right");
  $: isMuteDirty = !remixMode && muteDraft !== Boolean(isReactionMuteModeEnabled);
  $: isGeneralDirty =
    isOffsetStartDirty ||
    isReactionFinishTimeDirty ||
    isIntroBufferTimeDirty ||
    isSoundLevelDirty ||
    isOverlayWidthDirty ||
    isPrimaryDirty ||
    isCornerDirty ||
    isMuteDirty;
  $: isGeneralValid =
    isOffsetStartValid && isReactionFinishTimeValid && isIntroBufferTimeValid;

  const overlayPositionGrid = [
    OVERLAY_POSITIONS[0],
    OVERLAY_POSITIONS[1],
    OVERLAY_POSITIONS[2],
    OVERLAY_POSITIONS[3],
    null,
    OVERLAY_POSITIONS[4],
    OVERLAY_POSITIONS[5],
    OVERLAY_POSITIONS[6],
    OVERLAY_POSITIONS[7],
  ];

  const handleReactionVideoSubmit = () => {
    if (remixMode || !trimmedReactionVideoIdValue) return;
    onSetReactionVideoId(trimmedReactionVideoIdValue);
  };

  const handleRemixModeToggle = async () => {
    if (isSettingRemixMode) return;
    try {
      await onSetRemixMode(!remixMode);
    } catch (error) {
      console.error("Failed to update remix mode", error);
      showToast("Unable to update remix mode. Try again.", TOASTS.WARNING);
    }
  };

  const clearReactionVideoInput = () => {
    reactionVideoIdValue = "";
  };

  const handleRangeInput = (event) => {
    const value = Number.parseFloat(event.currentTarget.value);
    soundLevelValue = Number.isNaN(value) ? SOUND_LEVEL_MIN : value;
  };

  const handleOverlayWidthInput = (event) => {
    const value = Number.parseFloat(event.currentTarget.value);
    overlayWidthValue = Number.isNaN(value) ? DEFAULT_OVERLAY_WIDTH : value;
  };

  export function discardGeneralSettings() {
    if (isSavingGeneral) return;
    syncOffsetStartInputs(offsetStartTime);
    syncReactionFinishInputs(reactionFinishTime);
    introBufferTimeValue = introBufferTime?.toString?.() ?? "";
    soundLevelValue = Number.isFinite(soundLevel) ? soundLevel : 100;
    primaryDraft = fullscreenPrimaryVideoDefault || "original";
    cornerDraft = fullscreenOverlayCorner || "top-right";
    muteDraft = Boolean(isReactionMuteModeEnabled);
    overlayWidthValue = clampOverlayWidth(fullscreenOverlayWidthPercent);
  }

  export async function saveGeneralSettings() {
    if (!isGeneralDirty || !isGeneralValid || isSavingGeneral) return;
    const patch = {
      ...(isOffsetStartDirty
        ? { offsetStartTime: nextOffsetStartTimeSeconds }
        : {}),
      ...(isReactionFinishTimeDirty
        ? { reactionFinishTime: nextReactionFinishTimeSeconds }
        : {}),
      ...(isIntroBufferTimeDirty
        ? { introBufferTime: parsedIntroBufferTimeValue }
        : {}),
      ...(isSoundLevelDirty ? { soundLevel: soundLevelValue } : {}),
      ...(isMuteDirty ? { isReactionMuteModeEnabled: muteDraft } : {}),
      ...(isPrimaryDirty ? { fullscreenPrimaryVideo: primaryDraft } : {}),
      ...(isOverlayWidthDirty
        ? { fullscreenOverlayWidthPercent: overlayWidthClamped }
        : {}),
      ...(isCornerDirty ? { fullscreenOverlayCorner: cornerDraft } : {}),
    };
    isSavingGeneral = true;
    try {
      await onSaveGeneralSettings(patch);
      showToast("Settings saved.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to save reaction settings", error);
      showToast("Unable to save those settings. Try again.", TOASTS.WARNING);
    } finally {
      isSavingGeneral = false;
    }
  }

  const handleCreatePlayerConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onCreatePlayerConfig(detail);
      showToast("Playback cue added.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to add playback config", error);
      showToast("Unable to add that cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleCreateVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onCreateVolumeConfig(detail);
      showToast("Volume cue added.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to add volume config", error);
      showToast("Unable to add that volume cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleCreateReactionVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onCreateReactionVolumeConfig(detail);
      showToast("Reaction volume cue added.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to add reaction volume config", error);
      showToast(
        "Unable to add that reaction volume cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleCreatePlaybackRateConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onCreatePlaybackRateConfig(detail);
      showToast("Playback speed cue added.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to add playback rate config", error);
      showToast("Unable to add that speed cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleCreateOverlayVisibilityConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onCreateOverlayVisibilityConfig(detail);
      showToast("Overlay visibility cue added.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to add overlay visibility config", error);
      showToast(
        "Unable to add that visibility cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleUpdatePlayerConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onUpdatePlayerConfig(detail);
      showToast("Playback cue updated.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to update playback config", error);
      showToast("Unable to update that cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleDeletePlayerConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onDeletePlayerConfig(detail);
      showToast("Playback cue removed.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to delete playback config", error);
      showToast("Unable to remove that cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleUpdateVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onUpdateVolumeConfig(detail);
      showToast("Volume cue updated.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to update volume config", error);
      showToast("Unable to update that volume cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleUpdateReactionVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onUpdateReactionVolumeConfig(detail);
      showToast("Reaction volume cue updated.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to update reaction volume config", error);
      showToast(
        "Unable to update that reaction volume cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleDeleteVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onDeleteVolumeConfig(detail);
      showToast("Volume cue removed.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to delete volume config", error);
      showToast("Unable to remove that volume cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleDeleteReactionVolumeConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onDeleteReactionVolumeConfig(detail);
      showToast("Reaction volume cue removed.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to delete reaction volume config", error);
      showToast(
        "Unable to remove that reaction volume cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleUpdatePlaybackRateConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onUpdatePlaybackRateConfig(detail);
      showToast("Playback speed cue updated.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to update playback rate config", error);
      showToast("Unable to update that speed cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleDeletePlaybackRateConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onDeletePlaybackRateConfig(detail);
      showToast("Playback speed cue removed.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to delete playback rate config", error);
      showToast("Unable to remove that speed cue. Try again.", TOASTS.WARNING);
    }
  };

  const handleUpdateOverlayVisibilityConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onUpdateOverlayVisibilityConfig(detail);
      showToast("Overlay visibility cue updated.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to update overlay visibility config", error);
      showToast(
        "Unable to update that visibility cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleDeleteOverlayVisibilityConfig = async (event) => {
    const detail = event?.detail;
    if (!detail) return;
    try {
      await onDeleteOverlayVisibilityConfig(detail);
      showToast("Overlay visibility cue removed.", TOASTS.SUCCESS);
    } catch (error) {
      console.error("Failed to delete overlay visibility config", error);
      showToast(
        "Unable to remove that visibility cue. Try again.",
        TOASTS.WARNING,
      );
    }
  };

  const handleSeek = (event) => {
    const time = event?.detail?.time;
    if (Number.isFinite(time)) {
      onSeek(time);
    }
  };
</script>

<div class="editor-config flex flex-col gap-3" data-testid="editor-general-settings">
  {#if (isReactionMissing || isEditModeOn) && !isFineTuneModeOn}
    <section class="rounded-xl border border-border-subtle bg-surface/75">
      <h2>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          aria-expanded={openGeneralSection === "source"}
          aria-controls="general-section-source"
          on:click={() => toggleGeneralSection("source")}
        >
          <svg class="h-4 w-4 shrink-0 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" stroke-linecap="round" />
            <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 19" stroke-linecap="round" />
          </svg>
          <span class="min-w-0 flex-1 text-sm font-semibold text-text-primary">1. Reaction video source</span>
          <svg class={`h-4 w-4 shrink-0 text-text-muted transition-transform ${openGeneralSection === "source" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </h2>
      {#if openGeneralSection === "source"}
      <div id="general-section-source" class="px-3 pb-3">
      <p class="text-xs leading-snug text-text-muted">
        Link your YouTube reaction video so we can load it in our editor.
      </p>

      <form class="mt-2 flex flex-col gap-1.5" on:submit|preventDefault={handleReactionVideoSubmit}>
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <input
              id="reaction-video-id"
              class="h-9 w-full rounded-lg border border-border-subtle bg-background/80 px-2.5 pr-8 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-text-muted"
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              aria-label="Reaction video URL or ID"
              bind:value={reactionVideoIdValue}
              disabled={remixMode || (!isEditModeOn && !isReactionMissing)}
              aria-invalid={reactionVideoIdError ? "true" : undefined}
            />
            {#if reactionVideoIdValue && !remixMode}
              <button
                type="button"
                class="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="Clear video link"
                on:click={clearReactionVideoInput}
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                </svg>
              </button>
            {/if}
          </div>
          <CinematicButton
            type="submit"
            size="sm"
            variant="primary"
            loading={isSettingReactionVideoId}
            disabled={remixMode || !isReactionVideoIdDirty}
          >
            <span>Update video</span>
          </CinematicButton>
        </div>
        <p class="text-[11px] text-text-muted">Paste a full YouTube URL or just the video ID.</p>
        {#if reactionVideoIdError}
          <p class="text-[11px] text-danger">{reactionVideoIdError}</p>
        {/if}
      </form>

      {#if currentReactionVideoId}
        {@const loadedDuration = formatDurationLabel(reactionDuration)}
        <div class="mt-2 flex items-center gap-2 rounded-lg border border-border-subtle bg-background/50 px-2 py-1.5">
          <img
            class="h-10 w-14 shrink-0 rounded object-cover"
            src={`https://i.ytimg.com/vi/${currentReactionVideoId}/mqdefault.jpg`}
            alt=""
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">
              {reactionVideoTitle || "Reaction video"}
            </p>
            <p class="text-[11px] text-text-muted">
              {loadedDuration ? `${loadedDuration} · ` : ""}YouTube
            </p>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-success">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Video loaded
          </span>
        </div>
      {/if}

      <div class="mt-3 border-t border-border-subtle pt-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1.5">
            <h3 class="text-xs font-medium text-text-secondary">Remix mode</h3>
            <HelpfulTip variant="tooltip" placement="top" label="About remix mode">
              Remix the original video without uploading a reaction. The original stays fullscreen with no overlay. Fine-tune cues use the original video's timing, and the reaction volume and overlay tracks stay hidden.
            </HelpfulTip>
          </div>
          <button
            type="button"
            class={`${switchTrackBase} ${remixMode ? switchTrackOn : switchTrackOff}`}
            role="switch"
            aria-checked={remixMode}
            aria-label={remixMode ? "Turn off remix mode" : "Turn on remix mode"}
            disabled={isSettingRemixMode}
            on:click={handleRemixModeToggle}
          >
            <span
              class={`${switchThumbBase} ${remixMode ? switchThumbOn : switchThumbOff}`}
            ></span>
          </button>
        </div>
        <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
          {remixMode
            ? "The original plays on its own. Turn remix mode off to link a reaction video."
            : "Turn this on to edit the original by itself, without a reaction video."}
        </p>
      </div>
      </div>
      {/if}
    </section>
  {/if}

  {#if isEditModeOn && !isFineTuneModeOn}
    <form class="flex flex-col gap-3" on:submit|preventDefault={saveGeneralSettings}>
      <section class="rounded-xl border border-border-subtle bg-surface/75">
        <h2>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            aria-expanded={openGeneralSection === "timing"}
            aria-controls="general-section-timing"
            on:click={() => toggleGeneralSection("timing")}
          >
            <svg class="h-4 w-4 shrink-0 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2" stroke-linecap="round" />
            </svg>
            <span class="min-w-0 flex-1 text-sm font-semibold text-text-primary">2. Timing</span>
            <svg class={`h-4 w-4 shrink-0 text-text-muted transition-transform ${openGeneralSection === "timing" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </h2>
        {#if openGeneralSection === "timing"}
        <div id="general-section-timing" class="px-3 pb-3">
        <div class="timing-grid">
          <div>
            <h3 class="text-xs font-medium text-text-secondary">Reaction start time</h3>
            <div class="mt-1.5 grid grid-cols-2 gap-1.5">
              <TimeStepper
                id="reaction-offset-minutes"
                label="Minutes"
                min={0}
                step={1}
                bind:value={offsetStartMinutesValue}
              />
              <TimeStepper
                id="reaction-offset-seconds"
                label="Seconds"
                min={0}
                max={59.9}
                step={1}
                bind:value={offsetStartSecondsValue}
              />
            </div>
            <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
              When you start playback, the reaction video will begin from this timestamp.
            </p>
          </div>

          <div>
            <h3 class="text-xs font-medium text-text-secondary">Reaction finish time</h3>
            <div class="mt-1.5 grid grid-cols-2 gap-1.5">
              <TimeStepper
                id="reaction-finish-minutes"
                label="Minutes"
                min={0}
                step={1}
                bind:value={reactionFinishMinutesValue}
              />
              <TimeStepper
                id="reaction-finish-seconds"
                label="Seconds"
                min={0}
                max={59.9}
                step={1}
                bind:value={reactionFinishSecondsValue}
              />
            </div>
            <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
              Stop the reaction video once it reaches this timestamp.
            </p>
          </div>

          <div>
            <div class="flex items-center gap-1.5">
              <h3 class="text-xs font-medium text-text-secondary">Original video lead-in</h3>
              <HelpfulTip variant="tooltip" placement="top" label="About original video lead-in">
                How long to play the original clip before your reaction starts. Negative values and fractions are allowed. Every cue shifts by this many seconds, which helps when the recording started out of sync.
              </HelpfulTip>
            </div>
            <div class="mt-1.5">
              <TimeStepper
                id="intro-buffer-time"
                label="Seconds"
                min={-3600}
                max={3600}
                step={0.1}
                bind:value={introBufferTimeValue}
              />
            </div>
            <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
              How long to play the original clip before your reaction starts.
            </p>
          </div>
        </div>
        {#if !isOffsetStartValid || !isReactionFinishTimeValid || !isIntroBufferTimeValid}
          <p class="mt-2 text-[11px] text-danger">
            Enter a valid time. Seconds stay under 60, and lead-in must be a number.
          </p>
        {/if}
        </div>
        {/if}
      </section>

      <section class="rounded-xl border border-border-subtle bg-surface/75">
        <h2>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            aria-expanded={openGeneralSection === "audio"}
            aria-controls="general-section-audio"
            on:click={() => toggleGeneralSection("audio")}
          >
            <svg class="h-4 w-4 shrink-0 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" stroke-linecap="round" />
            </svg>
            <span class="min-w-0 flex-1 text-sm font-semibold text-text-primary">3. Audio</span>
            <svg class={`h-4 w-4 shrink-0 text-text-muted transition-transform ${openGeneralSection === "audio" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </h2>
        {#if openGeneralSection === "audio"}
        <div id="general-section-audio" class="px-3 pb-3">

        {#if isTikTokOriginal}
          <p class="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200" role="note">
            TikTok originals only support mute or full volume. Playback speed and fine-grained volume are unavailable.
          </p>
        {/if}

        <div class="audio-grid mt-2">
          <div>
            <div class="flex items-center justify-between gap-3">
              <label class="text-xs font-medium text-text-secondary" for="original-sound-level">
                Original video audio level
              </label>
              <span class="text-xs tabular-nums text-text-muted">{soundLevelValue}%</span>
            </div>
            {#if isTikTokOriginal}
              <div class="mt-2 flex gap-2" role="radiogroup" aria-label="Original video audio level">
                <button
                  type="button"
                  role="radio"
                  aria-checked={soundLevelValue === 0}
                  class={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${soundLevelValue === 0 ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-background/50 text-text-secondary"}`}
                  on:click={() => (soundLevelValue = 0)}
                >
                  Mute
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={soundLevelValue === 100}
                  class={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${soundLevelValue === 100 ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-background/50 text-text-secondary"}`}
                  on:click={() => (soundLevelValue = 100)}
                >
                  Full volume
                </button>
              </div>
            {:else}
              <input
                id="original-sound-level"
                class="mt-3 h-2 w-full cursor-pointer accent-accent-primary"
                type="range"
                min={SOUND_LEVEL_MIN}
                max={SOUND_LEVEL_MAX}
                step={SOUND_LEVEL_STEP}
                value={soundLevelValue}
                on:input={handleRangeInput}
              />
            {/if}
          </div>

          {#if !remixMode}
          <div>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-xs font-medium text-text-secondary">Reaction mute mode</h3>
              <button
                type="button"
                class={`${switchTrackBase} ${muteDraft ? switchTrackOn : switchTrackOff}`}
                role="switch"
                aria-checked={muteDraft}
                aria-label={muteDraft ? "Disable reaction mute mode" : "Enable reaction mute mode"}
                on:click={() => (muteDraft = !muteDraft)}
              >
                <span
                  class={`${switchThumbBase} ${muteDraft ? switchThumbOn : switchThumbOff}`}
                ></span>
              </button>
            </div>
            <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
              Mute your reaction audio whenever the original video plays.
            </p>
          </div>
          {/if}
        </div>
        </div>
        {/if}
      </section>

      {#if !remixMode}
      <section class="rounded-xl border border-border-subtle bg-surface/75">
        <h2>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            aria-expanded={openGeneralSection === "layout"}
            aria-controls="general-section-layout"
            on:click={() => toggleGeneralSection("layout")}
          >
            <svg class="h-4 w-4 shrink-0 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 21h8" stroke-linecap="round" />
            </svg>
            <span class="min-w-0 flex-1 text-sm font-semibold text-text-primary">4. Player layout</span>
            <svg class={`h-4 w-4 shrink-0 text-text-muted transition-transform ${openGeneralSection === "layout" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </h2>
        {#if openGeneralSection === "layout"}
        <div id="general-section-layout" class="px-3 pb-3">
        <div class="layout-portions">
        <div>
        <p class="text-xs leading-snug text-text-muted">
          Choose which video is the primary (main) video, and how the reaction overlay looks.
        </p>

        <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Primary video">
          <button
            type="button"
            class={`rounded-lg border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${primaryDraft === "original" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
            aria-pressed={primaryDraft === "original"}
            on:click={() => (primaryDraft = "original")}
          >
            <svg class="h-8 w-full" viewBox="0 0 80 36" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="78" height="34" rx="4" stroke="currentColor" stroke-width="1.5" />
              <rect x="56" y="5" width="18" height="12" rx="2" fill="currentColor" opacity="0.85" />
            </svg>
            <span class="mt-1 block text-xs font-semibold">Original video (main)</span>
            <span class="mt-0.5 block text-[11px] leading-snug text-text-muted">
              The original video is the main video, with your reaction as an overlay.
            </span>
          </button>
          <button
            type="button"
            class={`rounded-lg border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${primaryDraft === "reaction" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
            aria-pressed={primaryDraft === "reaction"}
            on:click={() => (primaryDraft = "reaction")}
          >
            <svg class="h-8 w-full" viewBox="0 0 80 36" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="78" height="34" rx="4" stroke="currentColor" stroke-width="1.5" />
              <rect x="6" y="19" width="18" height="12" rx="2" fill="currentColor" opacity="0.85" />
            </svg>
            <span class="mt-1 block text-xs font-semibold">Reaction video (main)</span>
            <span class="mt-0.5 block text-[11px] leading-snug text-text-muted">
              Your reaction video is the main video, with the original video as an overlay.
            </span>
          </button>
        </div>
        </div>

        <div>
          <div class="flex items-center justify-between gap-3">
            <label class="text-xs font-medium text-text-secondary" for="fullscreen-overlay-width">
              Reaction overlay size
            </label>
            <span class="text-xs tabular-nums text-text-muted">{overlayWidthClamped}%</span>
          </div>
          <input
            id="fullscreen-overlay-width"
            class="mt-2 h-2 w-full cursor-pointer accent-accent-primary"
            type="range"
            min={OVERLAY_WIDTH_MIN}
            max={OVERLAY_WIDTH_MAX}
            step={OVERLAY_WIDTH_STEP}
            value={overlayWidthValue}
            on:input={handleOverlayWidthInput}
          />
          <p class="mt-1.5 text-[11px] leading-snug text-text-muted">
            Choose a width from 5% to 80% of the player.
          </p>
        </div>

        <div>
          <h3 class="text-xs font-medium text-text-secondary">Reaction overlay position</h3>
          <div class="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label="Reaction overlay position">
            {#each overlayPositionGrid as position, index (position?.value ?? `empty-${index}`)}
              {#if position}
                <button
                  type="button"
                  class={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${cornerDraft === position.value ? "border-accent-primary bg-accent-primary text-background" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
                  aria-pressed={cornerDraft === position.value}
                  aria-label={`Place the overlay at the ${position.label.toLowerCase()}`}
                  on:click={() => (cornerDraft = position.value)}
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" />
                    <rect x={position.x} y={position.y} width="8" height="5" rx="1" fill="currentColor" />
                  </svg>
                  <span>{position.label}</span>
                </button>
              {:else}
                <div aria-hidden="true"></div>
              {/if}
            {/each}
          </div>
        </div>
        </div>
        </div>
        {/if}
      </section>
      {/if}

      <div class="flex flex-wrap items-center justify-end gap-2">
        <CinematicButton
          type="button"
          variant="secondary"
          size="sm"
          disabled={!isGeneralDirty || isSavingGeneral}
          on:click={discardGeneralSettings}
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" stroke-linecap="round" />
            <path d="M3 4v5h5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Discard changes</span>
        </CinematicButton>
        <CinematicButton
          type="submit"
          variant="primary"
          size="sm"
          disabled={!isGeneralDirty || !isGeneralValid || isSavingGeneral}
          loading={isSavingGeneral}
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 4h11l3 3v13H5V4Z" />
            <path d="M8 4v5h7V4M8 20v-6h8v6" />
          </svg>
          <span>Save changes</span>
          <span slot="loading">Saving…</span>
        </CinematicButton>
      </div>
    </form>
  {/if}

  {#if isEditModeOn && isFineTuneModeOn}
    <section
      class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
    >
      <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 class="text-base font-semibold text-text-primary">
          Fine-tune mode
        </h2>
        <p class="text-sm text-text-muted">
          {remixMode
            ? "Cues follow the original video. The original stays fullscreen, with no reaction volume or overlay track."
            : "Adjust precise playback, volume, and state timelines when you need full control."}
        </p>
      </header>

      {#if isFineTuneModeOn}
        <div class="mt-4 flex flex-col gap-6">
          <div
            class="rounded-2xl border border-border-subtle bg-background/60 p-4 shadow-surface"
          >
            <ConfigEditorV2
              {playerConfigs}
              {volumeConfigs}
              {reactionVolumeConfigs}
              {stateTimeline}
              {volumeTimeline}
              {reactionVolumeTimeline}
              {playbackRateConfigs}
              {playbackRateTimeline}
              {overlayVisibilityTimeline}
              fullscreenPrimaryVideoDefault={fullscreenPrimaryVideoDefault}
              reactionCurrentTime={remixMode ? originalCurrentTime : reactionCurrentTime}
              reactionDuration={remixMode ? originalDuration : reactionDuration}
              seekMin={remixMode ? 0 : offsetStartTime}
              seekMax={remixMode
                ? (originalDuration > 0 ? originalDuration : Number.POSITIVE_INFINITY)
                : (reactionFinishTime > 0
                  ? reactionFinishTime
                  : Number.POSITIVE_INFINITY)}
              {playerEventTimeline}
              allowPlaybackRate={!isTikTokOriginal}
              timeAxis={remixMode ? "original" : "reaction"}
              showReactionVolumeTrack={!remixMode}
              showOverlayTrack={!remixMode}
              on:createPlayerConfig={handleCreatePlayerConfig}
              on:createVolumeConfig={handleCreateVolumeConfig}
              on:createReactionVolumeConfig={handleCreateReactionVolumeConfig}
              on:createPlaybackRateConfig={handleCreatePlaybackRateConfig}
              on:createOverlayVisibilityConfig={handleCreateOverlayVisibilityConfig}
              on:updatePlayerConfig={handleUpdatePlayerConfig}
              on:deletePlayerConfig={handleDeletePlayerConfig}
              on:updateVolumeConfig={handleUpdateVolumeConfig}
              on:deleteVolumeConfig={handleDeleteVolumeConfig}
              on:updateReactionVolumeConfig={handleUpdateReactionVolumeConfig}
              on:deleteReactionVolumeConfig={handleDeleteReactionVolumeConfig}
              on:updatePlaybackRateConfig={handleUpdatePlaybackRateConfig}
              on:deletePlaybackRateConfig={handleDeletePlaybackRateConfig}
              on:updateOverlayVisibilityConfig={handleUpdateOverlayVisibilityConfig}
              on:deleteOverlayVisibilityConfig={handleDeleteOverlayVisibilityConfig}
              on:seek={handleSeek}
            />
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .editor-config {
    container-type: inline-size;
  }

  .timing-grid,
  .audio-grid,
  .layout-portions {
    display: grid;
    gap: 0.75rem;
  }

  .timing-grid > *,
  .audio-grid > *,
  .layout-portions > * {
    position: relative;
    min-width: 0;
  }

  /* Stacked portions get a horizontal rule in the gap. Side-by-side portions get a vertical one. */
  .timing-grid > * + *::before,
  .audio-grid > * + *::before,
  .layout-portions > * + *::before {
    content: "";
    position: absolute;
    top: -0.375rem;
    left: 0;
    right: 0;
    height: 1px;
    @apply bg-border-subtle;
  }

  /* Three timing fields only fit once the config column is wide enough to keep the inputs readable. */
  @container (min-width: 26rem) {
    .timing-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .audio-grid {
      grid-template-columns: minmax(0, 1fr) 13rem;
    }

    .timing-grid > * + *::before,
    .audio-grid > * + *::before {
      top: 0;
      bottom: 0;
      left: -0.375rem;
      right: auto;
      width: 1px;
      height: auto;
    }
  }
</style>

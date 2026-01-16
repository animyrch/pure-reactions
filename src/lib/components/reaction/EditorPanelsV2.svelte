<script>
  import AccessibleInput from "$lib/components/design-system/AccessibleInput.svelte";
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";
  import FullscreenLayoutPanel from "$lib/components/reaction/FullscreenLayoutPanel.svelte";
  import ConfigEditorV2 from "$lib/components/Video/ConfigEditorV2.svelte";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";

  export let isReactionMissing = false;
  export let isEditModeOn = false;
  export let isFineTuneModeOn = false;
  export let isPlaylist = false;
  export let reactionVideoId = "";
  export let reactionVideoIdError = "";
  export let isSettingReactionVideoId = false;
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
  export let reactionCurrentTime = 0;
  export let reactionDuration = 0;
  export let playerEventTimeline = [];
  export let fullscreenPrimaryVideo = "original";
  export let fullscreenOverlayWidthPercent = 35;
  export let fullscreenOverlayCorner = "top-right";
  export let onCreatePlayerConfig = async () => {};
  export let onCreateVolumeConfig = async () => {};
  export let onCreateReactionVolumeConfig = async () => {};
  export let onCreatePlaybackRateConfig = async () => {};
  export let onUpdatePlayerConfig = async () => {};
  export let onDeletePlayerConfig = async () => {};
  export let onUpdateVolumeConfig = async () => {};
  export let onUpdateReactionVolumeConfig = async () => {};
  export let onDeleteVolumeConfig = async () => {};
  export let onDeleteReactionVolumeConfig = async () => {};
  export let onUpdatePlaybackRateConfig = async () => {};
  export let onDeletePlaybackRateConfig = async () => {};

  export let onSetReactionVideoId = () => {};
  export let onSetOffsetStartTime = () => {};
  export let onSetIntroBufferTime = () => {};
  export let onSetReactionFinishTime = () => {};
  export let onSetSoundLevel = () => {};
  export let onSetReactionMuteMode = () => {};
  export let onSetFullscreenPrimaryVideo = () => {};
  export let onSetFullscreenOverlayWidthPercent = () => {};
  export let onSetFullscreenOverlayCorner = () => {};
  export let onToggleFineTuneMode = () => {};
  export let onSeek = (_time) => {};

  const SOUND_LEVEL_MIN = 0;
  const SOUND_LEVEL_MAX = 200;
  const SOUND_LEVEL_STEP = 1;

  let reactionVideoIdValue = reactionVideoId ?? "";
  let offsetStartMinutesValue = "0";
  let offsetStartSecondsValue = "0";
  let reactionFinishMinutesValue = "0";
  let reactionFinishSecondsValue = "0";
  let introBufferTimeValue = introBufferTime?.toString?.() ?? "";
  let soundLevelValue = Number.isFinite(soundLevel) ? soundLevel : 100;

  let lastReactionVideoIdProp = reactionVideoId;
  let lastOffsetStartTimeProp = offsetStartTime;
  let lastIntroBufferTimeProp = introBufferTime;
  let lastReactionFinishTimeProp = reactionFinishTime;
  let lastSoundLevelProp = soundLevel;

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
    const totalSeconds = Math.max(0, Number(value) || 0);
    const minutesPart = Math.floor(totalSeconds / 60);
    const secondsPartRaw = totalSeconds - minutesPart * 60;
    const secondsPart = Math.round(secondsPartRaw * 10) / 10; // 1 decimal
    reactionFinishMinutesValue = String(minutesPart);
    reactionFinishSecondsValue = Number.isInteger(secondsPart)
      ? String(secondsPart)
      : secondsPart.toFixed(1);
  };

  syncReactionFinishInputs(reactionFinishTime);

  $: if (offsetStartTime !== lastOffsetStartTimeProp) {
    lastOffsetStartTimeProp = offsetStartTime;
    syncOffsetStartInputs(offsetStartTime);
  }

  $: if (introBufferTime !== lastIntroBufferTimeProp) {
    lastIntroBufferTimeProp = introBufferTime;
    introBufferTimeValue = introBufferTime?.toString?.() ?? "";
  }

  $: if (reactionFinishTime !== lastReactionFinishTimeProp) {
    lastReactionFinishTimeProp = reactionFinishTime;
    syncReactionFinishInputs(reactionFinishTime);
  }

  $: if (soundLevel !== lastSoundLevelProp) {
    lastSoundLevelProp = soundLevel;
    soundLevelValue = Number.isFinite(soundLevel) ? soundLevel : 100;
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
  $: isReactionFinishTimeDirty =
    isReactionFinishTimeValid &&
    Math.abs(nextReactionFinishTimeSeconds - Number(reactionFinishTime || 0)) >
      0.0001;

  $: isSoundLevelDirty =
    Number.isFinite(soundLevelValue) && soundLevelValue !== soundLevel;


  const handleReactionVideoSubmit = () => {
    if (!trimmedReactionVideoIdValue) return;
    onSetReactionVideoId(trimmedReactionVideoIdValue);
  };

  const handleIntroBufferSubmit = () => {
    if (!isIntroBufferTimeValid) return;
    onSetIntroBufferTime(parsedIntroBufferTimeValue);
  };

  const handleOffsetStartSubmit = () => {
    if (!isOffsetStartValid) {
      showToast("Enter a valid start time (mm:ss).", TOASTS.WARNING);
      return;
    }
    onSetOffsetStartTime(nextOffsetStartTimeSeconds);
  };

  const handleReactionFinishTimeSubmit = () => {
    if (!isReactionFinishTimeValid) {
      showToast("Enter a valid finish time (mm:ss).", TOASTS.WARNING);
      return;
    }
    onSetReactionFinishTime(nextReactionFinishTimeSeconds);
  };

  const handleSoundLevelSubmit = () => {
    if (!Number.isFinite(soundLevelValue)) return;
    onSetSoundLevel(soundLevelValue);
  };

  const handleRangeInput = (event) => {
    const value = Number.parseFloat(event.currentTarget.value);
    soundLevelValue = Number.isNaN(value) ? SOUND_LEVEL_MIN : value;
  };


  const handleToggleFineTuneMode = () => {
    onToggleFineTuneMode();
  };

  const handleToggleReactionMuteMode = () => {
    onSetReactionMuteMode(!isReactionMuteModeEnabled);
  };


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

  const handleSeek = (event) => {
    const time = event?.detail?.time;
    if (Number.isFinite(time)) {
      onSeek(time);
    }
  };
</script>

<div class="flex flex-col gap-8">
  {#if (isReactionMissing || isEditModeOn) && !isFineTuneModeOn}
    <section
      class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
    >
      <header
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-text-primary">
            Reaction video source
          </h2>
          <p class="text-sm text-text-muted">
            Link the YouTube video you reacted to so we can load it in the
            editor.
          </p>
        </div>
      </header>

      <form
        class="mt-6 flex flex-col gap-4 md:flex-row md:items-center"
        on:submit|preventDefault={handleReactionVideoSubmit}
      >
        <div class="flex-1">
          <AccessibleInput
            id="reaction-video-id"
            label="Reaction video URL or ID"
            placeholder="https://www.youtube.com/watch?v=..."
            bind:value={reactionVideoIdValue}
            helperText="Paste a full YouTube URL or just the video ID."
            error={reactionVideoIdError}
            required
            disabled={!isEditModeOn && !isReactionMissing}
          />
        </div>
        <div class="flex-none">
          <CinematicButton
            type="submit"
            size="sm"
            variant="primary"
            loading={isSettingReactionVideoId}
            disabled={!isReactionVideoIdDirty}
          >
            <span>Update video</span>
          </CinematicButton>
        </div>
      </form>
    </section>
  {/if}

  {#if isEditModeOn && !isFineTuneModeOn}
    <section
      class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
    >
      <header
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-text-primary">
            Playback tuning
          </h2>
          <p class="text-sm text-text-muted">
            Dial in intro buffer and original audio balance for smoother
            reactions.
          </p>
        </div>
      </header>

      <div class="mt-6 flex flex-col gap-6">
        <div class="grid gap-6 lg:grid-cols-2">
          <form
            class="flex flex-col gap-4"
            on:submit|preventDefault={handleOffsetStartSubmit}
          >
            <div>
              <h3 class="text-sm font-medium text-text-secondary">
                Reaction start time
              </h3>
              <p class="mt-1 text-sm text-text-muted">
                When you start playback, the reaction video will begin from this
                timestamp.
              </p>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <AccessibleInput
                id="reaction-offset-minutes"
                label="Minutes"
                type="number"
                min="0"
                step="1"
                bind:value={offsetStartMinutesValue}
                required
              />
              <AccessibleInput
                id="reaction-offset-seconds"
                label="Seconds"
                type="number"
                min="0"
                max="59.9"
                step="0.1"
                bind:value={offsetStartSecondsValue}
                required
              />
            </div>

            <div class="flex justify-end">
              <CinematicButton
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!isOffsetStartDirty}
              >
                <span>Save start time</span>
              </CinematicButton>
            </div>
          </form>

          {#if isPlaylist}
            <form
              class="flex flex-col gap-4"
              on:submit|preventDefault={handleReactionFinishTimeSubmit}
            >
              <div>
                <h3 class="text-sm font-medium text-text-secondary">
                  Reaction finish time
                </h3>
                <p class="mt-1 text-sm text-text-muted">
                  Stop the reaction video once it reaches this timestamp
                  (playlist reactions only).
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <AccessibleInput
                  id="reaction-finish-minutes"
                  label="Minutes"
                  type="number"
                  min="0"
                  step="1"
                  bind:value={reactionFinishMinutesValue}
                  required
                />
                <AccessibleInput
                  id="reaction-finish-seconds"
                  label="Seconds"
                  type="number"
                  min="0"
                  max="59.9"
                  step="0.1"
                  bind:value={reactionFinishSecondsValue}
                  required
                />
              </div>

              <div class="flex justify-end">
                <CinematicButton
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={!isReactionFinishTimeDirty}
                >
                  <span>Save finish time</span>
                </CinematicButton>
              </div>
            </form>
          {/if}
        </div>

        <form
          class="flex flex-col gap-4 md:flex-row md:items-center"
          on:submit|preventDefault={handleIntroBufferSubmit}
        >
          <div class="flex-1">
            <AccessibleInput
              id="intro-buffer-time"
              label="Intro buffer (seconds)"
              type="number"
              min="0"
              step="0.1"
              bind:value={introBufferTimeValue}
              helperText="How long to play the original clip before your reaction starts."
              required
            />
          </div>
          <div class="flex-none">
            <CinematicButton
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!isIntroBufferTimeDirty}
            >
              <span>Save intro buffer</span>
            </CinematicButton>
          </div>
        </form>
        <form
          class="flex flex-col gap-4"
          on:submit|preventDefault={handleSoundLevelSubmit}
        >
          <div class="flex w-full flex-col gap-2">
            <div class="flex items-center justify-between">
              <label
                class="text-sm font-medium text-text-secondary"
                for="original-sound-level">Original audio level</label
              >
              <span class="text-sm text-text-muted">{soundLevelValue}%</span>
            </div>
            <input
              id="original-sound-level"
              class="h-2 w-full rounded-full bg-border-subtle accent-accent-primary"
              type="range"
              min={SOUND_LEVEL_MIN}
              max={SOUND_LEVEL_MAX}
              step={SOUND_LEVEL_STEP}
              value={soundLevelValue}
              on:input={handleRangeInput}
            />
          </div>
          <div class="flex justify-end">
            <CinematicButton
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!isSoundLevelDirty}
            >
              <span>Apply sound level</span>
            </CinematicButton>
          </div>
        </form>

        <div
          class="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-background/60 p-4"
        >
          <div>
            <h3 class="text-base font-semibold text-text-primary">
              Reaction mute mode
            </h3>
            <p class="text-sm text-text-muted">
              Mute your reaction audio whenever the original video plays.
            </p>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm text-text-secondary"
              >{isReactionMuteModeEnabled ? "Enabled" : "Disabled"}</span
            >
            <button
              type="button"
              class={`relative inline-flex h-7 w-12 items-center rounded-full border border-border-subtle transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isReactionMuteModeEnabled ? "bg-accent-primary/80 border-accent-primary" : "bg-surface/60 border-border-subtle"}`}
              role="switch"
              aria-checked={isReactionMuteModeEnabled}
              aria-label={isReactionMuteModeEnabled
                ? "Disable reaction mute mode"
                : "Enable reaction mute mode"}
              on:click={handleToggleReactionMuteMode}
            >
              <span
                class={`inline-block h-6 w-6 transform rounded-full bg-surface shadow-surface transition duration-subtle ease-cinematic ${isReactionMuteModeEnabled ? "translate-x-5" : "translate-x-1"}`}
              ></span>
            </button>
          </div>
        </div>
      </div>
    </section>
  {/if}

  {#if isEditModeOn && !isFineTuneModeOn}
    <FullscreenLayoutPanel
      {fullscreenPrimaryVideo}
      {fullscreenOverlayWidthPercent}
      {fullscreenOverlayCorner}
      {onSetFullscreenPrimaryVideo}
      {onSetFullscreenOverlayWidthPercent}
      {onSetFullscreenOverlayCorner}
    />
  {/if}

  {#if isEditModeOn && isFineTuneModeOn}
    <section
      class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
    >
      <header
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-text-primary">
            Fine-tune mode
          </h2>
          <p class="text-sm text-text-muted">
            Adjust precise playback, volume, and state timelines when you need
            full control.
          </p>
        </div>
      </header>

      {#if isFineTuneModeOn}
        <div class="mt-6 flex flex-col gap-6">
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
              {reactionCurrentTime}
              {reactionDuration}
              seekMin={offsetStartTime}
              seekMax={reactionFinishTime > 0
                ? reactionFinishTime
                : Number.POSITIVE_INFINITY}
              {playerEventTimeline}
              on:createPlayerConfig={handleCreatePlayerConfig}
              on:createVolumeConfig={handleCreateVolumeConfig}
              on:createReactionVolumeConfig={handleCreateReactionVolumeConfig}
              on:createPlaybackRateConfig={handleCreatePlaybackRateConfig}
              on:updatePlayerConfig={handleUpdatePlayerConfig}
              on:deletePlayerConfig={handleDeletePlayerConfig}
              on:updateVolumeConfig={handleUpdateVolumeConfig}
              on:deleteVolumeConfig={handleDeleteVolumeConfig}
              on:updateReactionVolumeConfig={handleUpdateReactionVolumeConfig}
              on:deleteReactionVolumeConfig={handleDeleteReactionVolumeConfig}
              on:updatePlaybackRateConfig={handleUpdatePlaybackRateConfig}
              on:deletePlaybackRateConfig={handleDeletePlaybackRateConfig}
              on:seek={handleSeek}
            />
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>

<script>
  import { Input, Label, Button } from 'flowbite-svelte';
  import ConfigEditor from '$lib/components/Video/ConfigEditor.svelte';

  export let isReactionMissing = false;
  export let isEditModeOn = false;
  export let isFineTuneModeOn = false;
  export let reactionVideoId = '';
  export let introBufferTime = 0;
  export let soundLevel = 100;
  export let playerConfigs = {};
  export let volumeConfigs = {};
  export let stateTimeline = [];
  export let volumeTimeline = [];
  export let playbackRateConfigs = {};
  export let playbackRateTimeline = [];

  export let onSetReactionVideoId = () => {};
  export let onSetIntroBufferTime = () => {};
  export let onSetSoundLevel = () => {};
  export let onToggleFineTuneMode = () => {};

  let reactionVideoIdValue = reactionVideoId;
  let introBufferTimeValue = introBufferTime;
  let soundLevelValue = soundLevel;

  $: if (reactionVideoId !== reactionVideoIdValue) {
    reactionVideoIdValue = reactionVideoId;
  }
  $: if (introBufferTime !== introBufferTimeValue) {
    introBufferTimeValue = introBufferTime;
  }
  $: if (soundLevel !== soundLevelValue) {
    soundLevelValue = soundLevel;
  }
</script>

<div class="flex flex-col gap-4">
  {#if isReactionMissing || isEditModeOn}
    <div class="flex gap-4">
      <Label for="reaction-video-id-input" class="flex-none mb-2 self-center">Reaction video id:</Label>
      <Input class="shrink" bind:value={reactionVideoIdValue} id="reaction-video-id-input" />
      <Button class="flex-none" on:click={() => onSetReactionVideoId(reactionVideoIdValue)}>Set Reaction Video Id</Button>
    </div>
  {/if}
  {#if isEditModeOn}
    <div class="flex gap-4">
      <Label for="buffer-time-input" class="flex-none mb-2 self-center">Set buffer time for intro:</Label>
      <Input class="shrink" bind:value={introBufferTimeValue} id="buffer-time-input" />
      <Button class="flex-none" on:click={() => onSetIntroBufferTime(Number(introBufferTimeValue))}>Modify reaction times</Button>
    </div>
  {/if}
  {#if isEditModeOn}
    <div class="flex gap-4">
      <Label for="sound-level-input" class="flex-none mb-2 self-center">Adjust sound level for original video:</Label>
      <input type="range" min="0" max="200" bind:value={soundLevelValue} id="sound-level-input" class="shrink" />
      <Button class="flex-none" on:click={() => onSetSoundLevel(Number(soundLevelValue))}>Set sound level</Button>
    </div>
  {/if}

  {#if isEditModeOn}
    <Button on:click={onToggleFineTuneMode}>
      {#if isFineTuneModeOn}
        Disable Fine Tune Mode
      {:else}
        Enable Fine Tune Mode
      {/if}
    </Button>
    {#if isFineTuneModeOn}
      <ConfigEditor
        {playerConfigs}
        {volumeConfigs}
        {stateTimeline}
        {volumeTimeline}
        {playbackRateConfigs}
        {playbackRateTimeline}
      />
    {/if}
  {/if}
</div>

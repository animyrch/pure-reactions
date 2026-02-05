<script>
  import { createEventDispatcher } from 'svelte';
  import AccessibleInput from '$lib/components/design-system/AccessibleInput.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';

  export let loading = false;
  export let error = '';
  export let value;

  const dispatch = createEventDispatcher();
  let reactionVideoId = value ?? '';
  let previousValue = value;
  let localError = '';

  $: if (value !== previousValue) {
    previousValue = value;
    reactionVideoId = value ?? '';
  }

  $: if (localError && reactionVideoId.trim()) {
    localError = '';
  }

  const handleSubmit = () => {
    const trimmed = reactionVideoId.trim();
    if (!trimmed) {
      localError = 'Enter a YouTube URL or ID before continuing.';
      return;
    }
    dispatch('submit', { value: trimmed });
  };
</script>

<div class="flex w-full aspect-[16/9] flex-col items-center justify-center rounded-none md:rounded-xl border border-dashed border-text-muted/40 bg-surface/40 p-6 text-center text-sm text-text-muted shadow-surface">
  <div class="w-full max-w-sm space-y-4 text-left">
    <p class="text-center text-sm text-text-muted">
      Add a reaction video ID to preview the edited cut here.
    </p>
    <form class="space-y-3" on:submit|preventDefault={handleSubmit}>
      <AccessibleInput
        label="Reaction video ID"
        placeholder="Paste a YouTube URL or ID"
        bind:value={reactionVideoId}
        helperText="Paste a full YouTube link or the 11-character ID."
        error={error || localError}
        disabled={loading}
      />
      <CinematicButton type="submit" size="sm" block loading={loading}>
        Load Preview
      </CinematicButton>
    </form>
  </div>
</div>

<script>
  import { Button, Modal } from 'flowbite-svelte';

  export let open = false;
  export let channelDisplayName = '';
  export let channelHandle = '';
  export let showHandleRow = false;
  export let youtubeUrl = '';
  export let hasYoutubeUrl = false;
  export let verificationToken = '';
  export let verificationVideoUrl = '';
  export let hasConfirmedControl = false;
  export let claimError = '';
  export let isSubmittingClaim = false;
  export let isSubmitDisabled = true;
  export let onCopyToken = () => {};
  export let onSubmit = () => {};
  export let onCancel = () => {};

  const handleCancel = () => {
    open = false;
    onCancel();
  };
</script>

<Modal
  bind:open={open}
  size="lg"
  autoclose={false}
  class="!bg-[#0b0f17] border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
  bodyClass="bg-transparent"
>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-text-primary">Claim this reaction channel</h3>
      <p class="mt-1 text-sm text-text-muted">
        Syncing reactions is always allowed. Claiming is only used to verify channel ownership on Pure Reactions.
      </p>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-3">
      <p class="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">Channel information</p>
      <dl class="mt-2 space-y-1 text-sm text-text-primary">
        <div class="flex flex-wrap items-center gap-2">
          <dt class="text-text-muted">Name:</dt>
          <dd>{channelDisplayName}</dd>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <dt class="text-text-muted">URL:</dt>
          <dd>
            {#if hasYoutubeUrl}
              <a
                class="text-accent-primary transition hover:text-accent-primary/80"
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {youtubeUrl}
              </a>
            {:else}
              <span class="text-text-muted">Not available</span>
            {/if}
          </dd>
        </div>
        {#if showHandleRow}
          <div class="flex flex-wrap items-center gap-2">
            <dt class="text-text-muted">Channel handle:</dt>
            <dd>{channelHandle}</dd>
          </div>
        {/if}
      </dl>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">Verification token</p>
          <p class="mt-1 font-mono text-sm text-text-primary">{verificationToken}</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          on:click={onCopyToken}
        >
          Copy token
        </button>
      </div>
      <ul class="mt-3 list-disc space-y-1 pl-4 text-xs text-text-muted">
        <li>Upload a public or unlisted video on this YouTube channel.</li>
        <li>Paste this token exactly into the video description.</li>
        <li>Submit the video link below.</li>
      </ul>
    </div>

    <div class="space-y-3">
      <label class="block text-sm font-medium text-text-primary" for="verification-video-url">
        Verification video URL
      </label>
      <input
        id="verification-video-url"
        type="url"
        class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        placeholder="https://www.youtube.com/watch?v=..."
        bind:value={verificationVideoUrl}
        required
      />

      <label class="flex items-start gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-accent-primary focus:ring-focus"
          bind:checked={hasConfirmedControl}
        />
        <span>I confirm that I control this YouTube channel</span>
      </label>
    </div>

    {#if claimError}
      <p class="text-sm text-red-400">{claimError}</p>
    {/if}

    <div class="flex flex-wrap justify-end gap-3">
      <Button color="alternative" on:click={handleCancel} disabled={isSubmittingClaim}>
        Cancel
      </Button>
      <Button
        on:click={onSubmit}
        disabled={isSubmitDisabled}
        class="bg-accent-primary text-text-primary hover:bg-accent-primary/90"
      >
        {#if isSubmittingClaim}
          Submitting...
        {:else}
          Submit for verification
        {/if}
      </Button>
    </div>
  </div>
</Modal>

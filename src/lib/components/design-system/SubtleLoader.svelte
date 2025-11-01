<script>
  export let label = 'Loading';
  export let progress;

  const hasProgress = typeof progress === 'number' && !Number.isNaN(progress);
  $: clampedProgress = hasProgress ? Math.min(100, Math.max(0, progress)) : undefined;
  const statusId = `loader-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="flex flex-col gap-xs text-text-secondary" role="status" aria-live="polite">
  <span id={statusId} class="text-sm font-medium text-text-secondary">
    {label}
  </span>

  <div
    class="relative h-[3px] overflow-hidden rounded-full bg-border-subtle"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={hasProgress ? clampedProgress : undefined}
    aria-describedby={statusId}
  >
    {#if hasProgress}
      <span
        class="absolute inset-y-0 left-0 rounded-full bg-accent-primary transition-all duration-deliberate ease-cinematic"
        style={`width: ${clampedProgress}%;`}
      />
    {:else}
      <span class="absolute inset-y-0 left-0 w-1/3 animate-cross-dissolve rounded-full bg-accent-primary" />
      <span
        class="absolute inset-y-0 left-1/3 w-1/3 animate-fade-soft rounded-full bg-accent-secondary"
        style="animation-delay: 180ms;"
      />
    {/if}
  </div>

  {#if hasProgress}
    <span class="text-xs text-text-muted">{clampedProgress}%</span>
  {/if}
</div>

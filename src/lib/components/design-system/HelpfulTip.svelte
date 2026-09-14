<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let title = 'Tip';
  export let variant = 'callout';
  export let placement = 'top';
  export let label = 'More information';
  export let id;
  export let dismissible = false;
  export let dismissLabel = 'Got it';
  export let storageKey = '';

  const dispatch = createEventDispatcher();
  const DISMISSED_VALUE = '1';
  const generatedId = `helpful-tip-${Math.random().toString(36).slice(2, 9)}`;
  const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  let dismissed = false;
  let ready = !storageKey;

  $: tipId = id ?? generatedId;
  $: titleId = `${tipId}-title`;
  $: isTooltip = variant === 'tooltip';
  $: showCallout = !isTooltip && ready && !dismissed;

  const readDismissed = () => {
    if (!storageKey || !isBrowser()) {
      return false;
    }

    try {
      return localStorage.getItem(storageKey) === DISMISSED_VALUE;
    } catch {
      return false;
    }
  };

  const persistDismissed = () => {
    if (!storageKey || !isBrowser()) {
      return;
    }

    try {
      localStorage.setItem(storageKey, DISMISSED_VALUE);
    } catch {
      // Ignore quota / privacy-mode failures; the tip stays dismissed for this session.
    }
  };

  const handleDismiss = () => {
    dismissed = true;
    persistDismissed();
    dispatch('dismiss');
  };

  onMount(() => {
    dismissed = readDismissed();
    ready = true;
  });

  const placementClasses = {
    top: 'bottom-full right-0 mb-2',
    bottom: 'top-full right-0 mt-2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  };

  $: tooltipPosition = placementClasses[placement] ?? placementClasses.top;
</script>

{#if isTooltip}
  <span class="relative inline-flex">
    <button
      type="button"
      class="peer inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle text-[0.65rem] leading-none text-text-muted transition duration-subtle ease-cinematic hover:border-border-strong hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={label}
      aria-describedby={tipId}
    >
      ?
    </button>
    <span
      id={tipId}
      role="tooltip"
      class="pointer-events-none absolute z-10 hidden w-52 rounded-md border border-border-subtle bg-elevated px-sm py-xs text-xs text-text-primary shadow-md peer-hover:block peer-focus-visible:block {tooltipPosition}"
    >
      <slot />
    </span>
  </span>
{:else if showCallout}
  <aside
    id={tipId}
    class="flex gap-sm rounded-md border border-border-subtle bg-elevated/80 px-md py-sm text-sm text-text-secondary"
    role="note"
    aria-labelledby={title ? titleId : undefined}
  >
    <span
      class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent-tertiary/40 text-[0.65rem] font-medium text-accent-tertiary"
      aria-hidden="true"
    >
      ?
    </span>
    <div class="min-w-0 flex-1">
      {#if title}
        <p id={titleId} class="text-xs font-medium uppercase tracking-wide text-text-muted">
          {title}
        </p>
      {/if}
      <div class="text-sm leading-relaxed text-text-secondary">
        <slot />
      </div>
      {#if dismissible}
        <div class="mt-sm">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md px-sm py-xs text-sm font-medium text-accent-primary transition duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            on:click={handleDismiss}
          >
            {dismissLabel}
          </button>
        </div>
      {/if}
    </div>
  </aside>
{/if}

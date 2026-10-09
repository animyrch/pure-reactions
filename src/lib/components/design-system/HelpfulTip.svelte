<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { placeTooltip } from '$lib/helpers/tooltipPlacement.js';

  export let title = 'Tip';
  export let variant = 'callout';
  export let placement = 'top';
  export let label = 'More information';
  export let id;
  export let dismissible = false;
  export let collapsible = false;
  export let dismissLabel = 'Got it';
  export let expandLabel = 'Show tip';
  export let storageKey = '';

  const dispatch = createEventDispatcher();
  const STORED_VALUE = '1';
  const generatedId = `helpful-tip-${Math.random().toString(36).slice(2, 9)}`;
  const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  let dismissed = false;
  let collapsed = false;
  let ready = !storageKey;
  let triggerEl;
  let tipEl;
  let tooltipOpen = false;
  let tooltipPlaced = false;
  let tooltipTop = 0;
  let tooltipLeft = 0;

  $: tipId = id ?? generatedId;
  $: titleId = `${tipId}-title`;
  $: isTooltip = variant === 'tooltip';
  $: showCallout = !isTooltip && ready && !dismissed && !collapsed;
  $: showCollapsed = !isTooltip && ready && !dismissed && collapsible && collapsed;

  const readStored = () => {
    if (!storageKey || !isBrowser()) {
      return false;
    }

    try {
      return localStorage.getItem(storageKey) === STORED_VALUE;
    } catch {
      return false;
    }
  };

  const persistStored = (value) => {
    if (!storageKey || !isBrowser()) {
      return;
    }

    try {
      if (value) {
        localStorage.setItem(storageKey, STORED_VALUE);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore quota / privacy-mode failures; session state still applies.
    }
  };

  const handleDismiss = () => {
    dismissed = true;
    persistStored(true);
    dispatch('dismiss');
  };

  const handleCollapse = () => {
    collapsed = true;
    persistStored(true);
    dispatch('collapse');
  };

  const handleExpand = () => {
    collapsed = false;
    persistStored(false);
    dispatch('expand');
  };

  const portalToBody = (node) => {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      },
    };
  };

  const positionTooltip = () => {
    if (!triggerEl || !tipEl || typeof window === 'undefined') {
      return;
    }

    const tipRect = tipEl.getBoundingClientRect();
    if (tipRect.width === 0 || tipRect.height === 0) {
      return;
    }

    const placed = placeTooltip({
      trigger: triggerEl.getBoundingClientRect(),
      tip: tipRect,
      placement,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    tooltipTop = placed.top;
    tooltipLeft = placed.left;
    tooltipPlaced = true;
    // The node lives on document.body, so write the box directly after measuring.
    tipEl.style.top = `${placed.top}px`;
    tipEl.style.left = `${placed.left}px`;
    tipEl.style.visibility = 'visible';
  };

  const showTooltip = async () => {
    tooltipOpen = true;
    tooltipPlaced = false;
    await tick();
    if (!tooltipOpen) {
      return;
    }
    positionTooltip();
  };

  const hideTooltip = (force = false) => {
    if (!force && triggerEl && document.activeElement === triggerEl) {
      return;
    }

    tooltipOpen = false;
    tooltipPlaced = false;
  };

  const handleWindowKeydown = (event) => {
    if (event.key === 'Escape' && tooltipOpen) {
      hideTooltip(true);
    }
  };

  onMount(() => {
    const stored = readStored();
    if (collapsible) {
      collapsed = stored;
    } else {
      dismissed = stored;
    }
    ready = true;

    if (!isTooltip) {
      return;
    }

    const reposition = () => {
      if (tooltipOpen) {
        positionTooltip();
      }
    };

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  });
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if isTooltip}
  <span class="relative inline-flex">
    <button
      type="button"
      bind:this={triggerEl}
      class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle text-[0.65rem] leading-none text-text-muted transition duration-subtle ease-cinematic hover:border-border-strong hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={label}
      aria-describedby={tooltipOpen ? tipId : undefined}
      on:mouseenter={showTooltip}
      on:mouseleave={() => hideTooltip(false)}
      on:focus={showTooltip}
      on:blur={() => hideTooltip(true)}
    >
      ?
    </button>
  </span>
  {#if tooltipOpen}
    <span
      id={tipId}
      use:portalToBody
      bind:this={tipEl}
      role="tooltip"
      class="pointer-events-none fixed z-[110] w-[min(16rem,calc(100vw-1rem))] whitespace-normal break-words rounded-md border border-border-subtle bg-elevated px-sm py-xs text-xs text-text-primary shadow-md"
      style:top="{tooltipTop}px"
      style:left="{tooltipLeft}px"
      style:visibility={tooltipPlaced ? 'visible' : 'hidden'}
    >
      <slot />
    </span>
  {/if}
{:else if showCollapsed}
  <button
    type="button"
    class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent-tertiary/40 text-[0.65rem] font-medium text-accent-tertiary transition duration-subtle ease-cinematic hover:border-accent-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    aria-label={expandLabel}
    aria-expanded="false"
    aria-controls={tipId}
    on:click={handleExpand}
  >
    ?
  </button>
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
      {#if collapsible}
        <div class="mt-sm">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md px-sm py-xs text-sm font-medium text-accent-primary transition duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            on:click={handleCollapse}
          >
            {dismissLabel}
          </button>
        </div>
      {:else if dismissible}
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

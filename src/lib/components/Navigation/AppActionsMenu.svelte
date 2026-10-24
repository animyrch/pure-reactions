<script>
  import { onMount, tick } from "svelte";
  import { page } from "$app/stores";

  import { copyToClipboard } from "$lib/helpers/system";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { reactionDial } from "$lib/stores/reactionDial";
  import {
    buildBaseMenuOptions,
    buildReactionMenuOptions,
  } from "$lib/helpers/appMenuOptions";

  /** @type {'dropdown' | 'inline'} */
  export let variant = "dropdown";
  /** Called after an item is chosen. Used by the mobile drawer to close. */
  export let onChosen = () => {};

  let isOpen = false;
  let menuRef;
  let triggerRef;
  const menuId = `app-actions-menu-${variant}`;

  const copyCurrentUrl = () => {
    copyToClipboard($page.url.href);
    showToast("Current URL copied to your clipboard.", TOASTS.SUCCESS);
  };

  $: reactionOptions = $reactionDial.isActive
    ? buildReactionMenuOptions($reactionDial)
    : [];

  $: options = [
    ...reactionOptions,
    ...buildBaseMenuOptions({
      onShare: copyCurrentUrl,
    }),
  ];

  const closeMenu = async (refocus = false) => {
    if (variant !== "dropdown" || !isOpen) return;
    isOpen = false;
    if (refocus) {
      await tick();
      triggerRef?.focus();
    }
  };

  const openMenu = async () => {
    isOpen = true;
    await tick();
    const first = menuRef?.querySelector('[role="menuitem"]');
    first?.focus();
  };

  const toggleMenu = () => {
    if (isOpen) closeMenu(false);
    else openMenu();
  };

  const handleAction = (option) => {
    if (option.onSelect) option.onSelect();
    if (variant === "dropdown") closeMenu(Boolean(option.onSelect));
    onChosen();
  };

  const focusItemAt = (index) => {
    const items = menuRef?.querySelectorAll('[role="menuitem"]') ?? [];
    if (!items.length) return;
    const next = (index + items.length) % items.length;
    items[next].focus();
  };

  const handleMenuKeydown = (event) => {
    const items = [...(menuRef?.querySelectorAll('[role="menuitem"]') ?? [])];
    const current = items.indexOf(document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItemAt(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItemAt(current <= 0 ? items.length - 1 : current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItemAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItemAt(items.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu(false);
    }
  };

  const handleTriggerKeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      if (event.key === "ArrowDown" || !isOpen) {
        event.preventDefault();
        openMenu();
      }
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const handlePointerDown = (event) => {
    if (!isOpen) return;
    const root = triggerRef?.parentElement;
    if (root && !root.contains(event.target)) closeMenu(false);
  };

  onMount(() => {
    if (variant !== "dropdown") return undefined;
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  });
</script>

{#if variant === "dropdown"}
  <div class="relative">
    <button
      bind:this={triggerRef}
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface/50 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Menu"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={menuId}
      on:click={toggleMenu}
      on:keydown={handleTriggerKeydown}
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {#if isOpen}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        {:else}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        {/if}
      </svg>
    </button>

    {#if isOpen}
      <ul
        bind:this={menuRef}
        id={menuId}
        role="menu"
        aria-label="App menu"
        class="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border border-border-subtle bg-surface py-1.5 shadow-elevated"
        on:keydown={handleMenuKeydown}
      >
        {#each options as option, index}
          <li role="none">
            {#if index === reactionOptions.length && reactionOptions.length > 0}
              <div class="mx-3 my-1.5 border-t border-border-subtle" role="separator"></div>
            {/if}
            {#if option.href}
              <a
                href={option.href}
                role="menuitem"
                class="menu-item"
                on:click={() => handleAction(option)}
              >
                <svelte:component this={option.icon} class="h-4 w-4 shrink-0" aria-hidden="true" />
                {option.name}
              </a>
            {:else}
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                on:click={() => handleAction(option)}
              >
                <svelte:component this={option.icon} class="h-4 w-4 shrink-0" aria-hidden="true" />
                {option.name}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{:else}
  <div class="mt-2 border-t border-border-subtle pt-2" bind:this={menuRef}>
    {#each options as option}
      {#if option.href}
        <a href={option.href} class="drawer-item" on:click={() => handleAction(option)}>
          <svelte:component this={option.icon} class="h-4 w-4 shrink-0" aria-hidden="true" />
          {option.name}
        </a>
      {:else}
        <button type="button" class="drawer-item" on:click={() => handleAction(option)}>
          <svelte:component this={option.icon} class="h-4 w-4 shrink-0" aria-hidden="true" />
          {option.name}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu-item,
  .drawer-item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary, #c5cdd8);
  }

  .menu-item {
    padding: 0.55rem 0.85rem;
  }

  .drawer-item {
    border-radius: 0.5rem;
    padding: 0.625rem 1rem;
  }

  .menu-item:hover,
  .menu-item:focus-visible,
  .drawer-item:hover,
  .drawer-item:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary, #f5f7fa);
    outline: none;
  }

  .menu-item:focus-visible {
    box-shadow: inset 0 0 0 2px rgba(92, 178, 255, 0.45);
  }
</style>

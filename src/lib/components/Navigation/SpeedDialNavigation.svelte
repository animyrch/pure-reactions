<script>
  import { onMount } from "svelte";
  import {
    ShareNodesSolid,
    BookmarkSolid,
    HomeSolid,
    UserCircleSolid,
    SearchOutline,
    BellActiveAltSolid,
    PenSolid,
    CheckCircleSolid,
    ArrowUpFromBracketSolid,
    EyeSlashSolid,
    BarsSolid,
    ListMusicSolid,
  } from "flowbite-svelte-icons";
  import { page } from "$app/stores";
  import { copyToClipboard } from "$lib/helpers/system";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { reactionDial } from "$lib/stores/reactionDial";

  let isOpen = false;
  let dialRef;
  let triggerRef;
  const menuId = "speed-dial-menu";

  const copyCurrentUrl = () => {
    copyToClipboard($page.url.href);
    showToast("Current URL copied to your clipboard.", TOASTS.SUCCESS);
  };

  const baseOptions = [
    {
      name: "Share Current Page",
      icon: ShareNodesSolid,
      onSelect: () => copyCurrentUrl(),
    },
    { name: "Search", icon: SearchOutline, onSelect: () => jumpToHeaderSearch() },
    { name: "My Account", icon: UserCircleSolid, href: "/account" },
    {
      name: "Reactors I Follow",
      icon: BellActiveAltSolid,
      href: "/?sortBy=following",
    },
    { name: "My Bookmarks", icon: BookmarkSolid, href: "/bookmark" },
    { name: "Home", icon: HomeSolid, href: "/" },
  ];

  let reactionOptions = [];
  let options = baseOptions;

  const closeDial = (refocus = false) => {
    if (!isOpen) return;
    isOpen = false;
    if (refocus) {
      triggerRef?.focus();
    }
  };

  const toggleDial = () => {
    isOpen = !isOpen;
  };

  const handleWindowKeydown = (event) => {
    if (event.key === "Escape") {
      closeDial(true);
    }
  };

  const handlePointerDown = (event) => {
    if (isOpen && !dialRef?.contains(event.target)) {
      closeDial(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleWindowKeydown);
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    return () => {
      window.removeEventListener("keydown", handleWindowKeydown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  });

  $: reactionOptions = $reactionDial.isActive
    ? buildReactionOptions($reactionDial)
    : [];

  $: options = [...reactionOptions, ...baseOptions];

  const handleAction = (option) => {
    if (option.onSelect) {
      option.onSelect();
      closeDial(true);
      return;
    }

    if (option.href) {
      closeDial(false);
    }
  };

  function jumpToHeaderSearch() {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const headerSearch = document.querySelector('header .search-trigger');
      if (headerSearch) {
        if (typeof headerSearch.click === 'function') headerSearch.click();
        if (typeof headerSearch.focus === 'function') headerSearch.focus();
      }
    }, 350);
  }

  function buildReactionOptions(state) {
    const itemList = [];
    const {
      isUsersOwnVideo,
      canShowEditModeButton,
      canShowCloseEditModeButton,
      isPublished,
      isReactionMissing,
      canShowEditPlaylistButton,
      handlers,
    } = state;

    if (isUsersOwnVideo && canShowEditModeButton && handlers.enterEditMode) {
      itemList.push({
        name: "Edit Reaction",
        icon: PenSolid,
        onSelect: handlers.enterEditMode,
      });
    }

    if (
      isUsersOwnVideo &&
      canShowCloseEditModeButton &&
      handlers.closeEditMode
    ) {
      itemList.push({
        name: "Finish Editing",
        icon: CheckCircleSolid,
        onSelect: handlers.closeEditMode,
      });
    }

    if (
      isUsersOwnVideo &&
      !isPublished &&
      !isReactionMissing &&
      handlers.setIsPublished
    ) {
      itemList.push({
        name: "Publish Reaction",
        icon: ArrowUpFromBracketSolid,
        onSelect: handlers.setIsPublished,
      });
    }

    if (isUsersOwnVideo && isPublished && handlers.setIsUnpublished) {
      itemList.push({
        name: "Unpublish Reaction",
        icon: EyeSlashSolid,
        onSelect: handlers.setIsUnpublished,
      });
    }

    if (canShowEditPlaylistButton && handlers.editPlaylist) {
      itemList.push({
        name: "Edit Playlist",
        icon: ListMusicSolid,
        onSelect: handlers.editPlaylist,
      });
    }

    return itemList;
  }
</script>

<div
  bind:this={dialRef}
  class="speed-dial fixed z-[95] flex flex-col items-start gap-2"
  style="bottom: calc(var(--fab-offset-bottom) + var(--safe-area-inset-bottom)); left: calc(var(--fab-offset-left) + var(--safe-area-inset-left));"
  data-open={isOpen}
>
  <ul
    id={menuId}
    class={`dial-menu mb-2 flex flex-col items-start gap-2 transition duration-slow ease-cinematic ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    aria-hidden={!isOpen}
  >
    {#each options as option, index}
      {#if option.type === "action"}
        <li class="dial-item" style={`--item-delay: ${index * 50}ms`}>
          <button
            type="button"
            class="dial-button"
            tabindex={isOpen ? 0 : -1}
            on:click={() => handleAction(option)}
            aria-label={option.name}
          >
            <svelte:component this={option.icon} class="h-5 w-5" />
            <span class="dial-label" aria-hidden="true">{option.name}</span>
            <span class="sr-only">{option.name}</span>
          </button>
        </li>
      {:else}
        <li class="dial-item" style={`--item-delay: ${index * 50}ms`}>
          <a
            href={option.href}
            class="dial-button"
            tabindex={isOpen ? 0 : -1}
            on:click={() => handleAction(option)}
            aria-label={option.name}
          >
            <svelte:component this={option.icon} class="h-5 w-5" />
            <span class="dial-label" aria-hidden="true">{option.name}</span>
            <span class="sr-only">{option.name}</span>
          </a>
        </li>
      {/if}
    {/each}
  </ul>

  <button
    bind:this={triggerRef}
    type="button"
    class={`fab-button ${isOpen ? "rotate-45 bg-accent-primary text-background" : "bg-surface text-text-primary"}`}
    aria-haspopup="true"
    aria-expanded={isOpen}
    aria-controls={menuId}
    on:click={toggleDial}
  >
    <span class="sr-only">Toggle quick navigation</span>
    <BarsSolid class="h-5 w-5" />
  </button>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .fab-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 28px rgba(5, 8, 12, 0.32);
    transition:
      transform 320ms cubic-bezier(0.33, 1, 0.68, 1),
      background-color 320ms cubic-bezier(0.33, 1, 0.68, 1),
      color 320ms cubic-bezier(0.33, 1, 0.68, 1),
      box-shadow 320ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  .fab-button:hover {
    box-shadow: 0 18px 36px rgba(5, 8, 12, 0.38);
  }

  .fab-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px rgba(12, 18, 27, 0.9),
      0 0 0 4px rgba(92, 178, 255, 0.45);
  }

  .dial-menu {
    min-width: 3rem;
  }

  .dial-item {
    position: relative;
    opacity: 0;
    transform: translateY(8px) scale(0.96);
    transition:
      opacity 320ms cubic-bezier(0.33, 1, 0.68, 1),
      transform 320ms cubic-bezier(0.33, 1, 0.68, 1);
    transition-delay: var(--item-delay);
  }

  .speed-dial[data-open="true"] .dial-item {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .dial-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    background: rgba(17, 21, 28, 0.88);
    color: #f5f7fa;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 26px rgba(5, 8, 12, 0.3);
    transition:
      background-color 240ms cubic-bezier(0.33, 1, 0.68, 1),
      transform 240ms cubic-bezier(0.33, 1, 0.68, 1),
      color 240ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  .dial-button:hover {
    background: rgba(35, 41, 52, 0.98);
  }

  .dial-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px rgba(12, 18, 27, 0.9),
      0 0 0 4px rgba(92, 178, 255, 0.45);
  }

  .dial-label {
    position: absolute;
    top: 50%;
    left: calc(100% + 0.75rem);
    transform: translateY(-50%) scale(0.96);
    padding: 0.4rem 0.6rem;
    border-radius: 999px;
    background: rgba(12, 18, 27, 0.95);
    color: #f5f7fa;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 28px rgba(5, 8, 12, 0.28);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    opacity: 0;
    white-space: nowrap;
    pointer-events: none;
    transition:
      opacity 220ms cubic-bezier(0.33, 1, 0.68, 1),
      transform 220ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  .dial-button:hover .dial-label,
  .dial-button:focus-visible .dial-label,
  .dial-button:focus .dial-label {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .dial-label {
      transition: opacity 120ms linear;
      transform: translateY(-50%);
    }

    .dial-button:hover .dial-label,
    .dial-button:focus-visible .dial-label,
    .dial-button:focus .dial-label {
      transform: translateY(-50%);
    }
  }

  @media (max-width: 640px) {
    .speed-dial {
      /* Safe area insets are already applied via inline styles */
    }

    .fab-button {
      width: 2.75rem;
      height: 2.75rem;
    }

    .dial-button {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
</style>

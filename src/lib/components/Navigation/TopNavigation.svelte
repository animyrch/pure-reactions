<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { goToRoute } from "$lib/helpers/routing";
  import PurePureactionsLogo from "../PurePureactionsLogo.svelte";
  import AppActionsMenu from "./AppActionsMenu.svelte";
  import { SearchOutline as SearchIcon } from "flowbite-svelte-icons";

  let lastScrollY = 0;
  let isHidden = false;
  let showMenu = false;

  const handleScroll = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;

    if (Math.abs(delta) > 6) {
      isHidden = delta > 0 && currentY > 72;
      lastScrollY = currentY;
    }
  };

  onMount(() => {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });

  const goReact = () => {
    goToRoute("/react");
  };

  const toggleMenu = () => {
    showMenu = !showMenu;
  };

  const handleSearchClick = () => {
    goto("/search");
  };
</script>

<header
  class={`nav-shell fixed inset-x-0 top-0 z-[90] transition-transform duration-500 ease-cinematic ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
>
  <nav class="relative mx-auto flex w-full items-center px-5 py-3 md:px-8">
    <a
      href="/"
      class="relative z-10 flex shrink-0 items-center text-text-primary transition-opacity duration-subtle ease-cinematic hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Pure Reactions home"
    >
      <div class="logo-wrapper">
        <PurePureactionsLogo />
      </div>
    </a>

    <!-- Desktop links sit in the true center of the bar -->
    <div class="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
      <div class="pointer-events-auto flex items-center gap-10">
        <a href="/moments" class="desktop-nav-link">Moments</a>
        <a href="/how-it-works" class="desktop-nav-link">How It Works</a>
        <a href="/insights" class="desktop-nav-link">Insights</a>
      </div>
    </div>

    <div class="relative z-10 ml-auto hidden items-center gap-5 md:flex">
      <button
        type="button"
        class="inline-flex items-center gap-2 text-sm font-medium text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={handleSearchClick}
        aria-label="Search"
      >
        <SearchIcon class="h-5 w-5" aria-hidden="true" />
        <span>Search</span>
      </button>
      <button
        type="button"
        class="react-cta rounded-full bg-[#e10600] px-5 py-2 text-sm font-semibold text-white transition duration-subtle ease-cinematic hover:bg-[#c10500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={goReact}
      >
        React
      </button>
      <AppActionsMenu variant="dropdown" />
    </div>

    <!-- Mobile Menu Button and Search -->
    <div class="relative z-10 ml-auto flex items-center gap-3 md:hidden">
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface/50"
        on:click={handleSearchClick}
        aria-label="Search"
      >
        <SearchIcon class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="text-text-secondary hover:text-text-primary transition-colors p-2"
        on:click={toggleMenu}
        aria-label="Toggle menu"
        aria-expanded={showMenu}
        aria-controls="mobile-app-menu"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {#if showMenu}
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
      <button
        type="button"
        class="react-cta rounded-full border border-border-strong px-md py-xs text-sm font-medium text-text-primary transition duration-subtle ease-cinematic hover:bg-border-strong/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={goReact}
      >
        React
      </button>
    </div>
  </nav>

  <!-- Mobile Menu -->
  {#if showMenu}
    <div
      id="mobile-app-menu"
      class="mobile-menu border-t border-border-subtle bg-surface px-4 py-4 md:hidden"
    >
      <div class="flex flex-col gap-3">
        <a
          href="/moments"
          class="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          on:click={() => (showMenu = false)}
        >
          Moments
        </a>
        <a
          href="/how-it-works"
          class="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          on:click={() => (showMenu = false)}
        >
          How It Works
        </a>
        <a
          href="/insights"
          class="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          on:click={() => (showMenu = false)}
        >
          Insights
        </a>
        <AppActionsMenu variant="inline" onChosen={() => (showMenu = false)} />
      </div>
    </div>
  {/if}
</header>

<style>
  .nav-shell {
    background: #000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: var(--safe-area-inset-top);
  }

  .desktop-nav-link {
    font-size: 0.95rem;
    font-weight: 500;
    color: #fff;
    transition: opacity 180ms ease;
  }

  .desktop-nav-link:hover {
    opacity: 0.75;
  }

  .logo-wrapper :global(svg) {
    height: 40px;
    width: auto;
    transition: transform 320ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  @media (max-width: 640px) {
    .logo-wrapper :global(svg) {
      height: 28px;
    }

    .react-cta {
      font-size: 0.8125rem;
      padding-inline: 0.9rem;
      padding-block: 0.45rem;
    }
  }
</style>

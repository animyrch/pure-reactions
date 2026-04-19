<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { goToRoute } from "$lib/helpers/routing";
  import PurePureactionsLogo from "../PurePureactionsLogo.svelte";
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
  class={`nav-shell fixed inset-x-0 top-0 z-40 transition-transform duration-500 ease-cinematic ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
>
  <nav class="mx-auto flex w-full items-center justify-between px-4 py-3">
    <a
      href="/"
      class="flex items-center gap-3 text-text-primary transition-opacity duration-subtle ease-cinematic hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Pure Reactions home"
    >
      <div class="logo-wrapper">
        <PurePureactionsLogo />
      </div>
    </a>

    <!-- Desktop Navigation Links -->
    <div class="hidden items-center gap-6 md:flex">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-border-strong/60 bg-surface/70 px-4 py-2 text-sm font-medium text-text-primary shadow-surface transition-all duration-300 ease-cinematic hover:bg-surface/90 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={handleSearchClick}
        aria-label="Search"
      >
        <SearchIcon class="h-5 w-5" aria-hidden="true" />
        <span>Search</span>
      </button>
      <a
        href="/how-it-works"
        class="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        How It Works
      </a>
      <a
        href="/insights"
        class="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        Insights
      </a>
      <button
        type="button"
        class="react-cta rounded-full border border-border-strong px-md py-xs text-sm font-medium text-text-primary transition duration-subtle ease-cinematic hover:bg-border-strong/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={goReact}
      >
        React
      </button>
    </div>

    <!-- Mobile Menu Button and Search -->
    <div class="flex items-center gap-3 md:hidden">
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
      class="mobile-menu border-t border-border-subtle bg-surface px-4 py-4 md:hidden"
    >
      <div class="flex flex-col gap-3">
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
      </div>
    </div>
  {/if}
</header>

<style>
  .nav-shell {
    background: rgba(10, 12, 16, 0.65);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: var(--safe-area-inset-top);
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

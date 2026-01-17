<script>
  import { onMount } from 'svelte';
  import { goToRoute } from '$lib/helpers/routing';
  import PurePureactionsLogo from '../PurePureactionsLogo.svelte';

  let lastScrollY = 0;
  let isHidden = false;

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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  });

  const goReact = () => {
    goToRoute('/react');
  };
</script>

<header class={`nav-shell fixed inset-x-0 top-0 z-40 transition-transform duration-500 ease-cinematic ${isHidden ? '-translate-y-full' : 'translate-y-0'}`}>
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
    <button
      type="button"
      class="react-cta rounded-full border border-border-strong px-md py-xs text-sm font-medium text-text-primary transition duration-subtle ease-cinematic hover:bg-border-strong/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      on:click={goReact}
    >
      React
    </button>
  </nav>
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

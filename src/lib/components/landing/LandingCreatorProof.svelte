<script>
  import ReactionsList from "$lib/components/ReactionsList.svelte";
  import { goToRoute } from "$lib/helpers/routing";
  import { onMount } from "svelte";

  export let reactions = [];
  export let loading = false;
  export let hasLoaded = false;

  let sectionEl;
  let revealed = false;

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealed = true;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionEl) observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section
  id="creator-proof"
  bind:this={sectionEl}
  class="relative px-4 py-24 md:py-32"
  aria-label="Creator content"
>
  <div class="mx-auto max-w-6xl" class:section-revealed={revealed}>
    <!-- Divider line -->
    <div class="reveal-proof mb-12 flex items-center gap-4">
      <div class="h-px flex-1 bg-gradient-to-r from-transparent to-border-subtle" aria-hidden="true" />
      <p class="shrink-0 text-sm font-medium uppercase tracking-widest text-accent-primary">
        Live on the platform
      </p>
      <div class="h-px flex-1 bg-gradient-to-l from-transparent to-border-subtle" aria-hidden="true" />
    </div>

    <!-- Section header -->
    <div class="reveal-proof-delay-1 mb-12 text-center md:mb-16">
      <h2
        class="text-3xl font-bold leading-tight text-text-primary sm:text-4xl md:text-5xl"
        style="font-family: var(--font-display, 'Manrope', 'Inter', sans-serif);"
      >
        See what creators are making
      </h2>
      <p class="mx-auto mt-4 max-w-lg text-base text-text-secondary md:text-lg">
        Real reactions, real creators, right now.
      </p>
    </div>

    <!-- Content feed -->
    <div class="reveal-proof-delay-2">
      {#if reactions.length > 0}
        <ReactionsList {reactions} />
      {:else if loading || !hasLoaded}
        <div class="flex items-center justify-center py-16">
          <p class="text-text-muted">Loading reactions…</p>
        </div>
      {:else}
        <div class="flex items-center justify-center py-16">
          <p class="text-text-muted">No published reactions yet.</p>
        </div>
      {/if}
    </div>

    <!-- Bottom CTA -->
    <div class="reveal-proof-delay-3 mt-12 text-center">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-8 py-3.5 text-base font-semibold text-background shadow-elevated transition duration-subtle ease-cinematic hover:bg-primary-600 hover:shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        on:click={() => goToRoute("/react")}
      >
        Start creating
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  </div>
</section>

<style>
  .section-revealed .reveal-proof         { animation: proof-up 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-proof-delay-1  { animation: proof-up 0.7s 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-proof-delay-2  { animation: proof-up 0.7s 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-proof-delay-3  { animation: proof-up 0.6s 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes proof-up {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  :global(.motion-reduce) .section-revealed .reveal-proof,
  :global(.motion-reduce) .section-revealed .reveal-proof-delay-1,
  :global(.motion-reduce) .section-revealed .reveal-proof-delay-2,
  :global(.motion-reduce) .section-revealed .reveal-proof-delay-3 {
    animation: none; opacity: 1; transform: none;
  }
</style>

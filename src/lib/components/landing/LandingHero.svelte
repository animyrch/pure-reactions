<script>
  import { goToRoute } from "$lib/helpers/routing";
  import { onMount, onDestroy } from "svelte";

  let visible = false;

  const creatorTypes = [
    "reaction creators",
    "commentary creators",
    "translators",
    "voice-over artists",
    "mixers & remixers",
    "accessibility creators",
  ];

  let typeIndex = 0;
  let fading = false;
  let interval;

  onMount(() => {
    visible = true;
    interval = setInterval(() => {
      fading = true;
      setTimeout(() => {
        typeIndex = (typeIndex + 1) % creatorTypes.length;
        fading = false;
      }, 300);
    }, 2400);
  });

  onDestroy(() => clearInterval(interval));
</script>

<section
  class="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center md:min-h-screen"
  aria-label="Hero"
>
  <!-- Ambient glow -->
  <div
    class="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
    aria-hidden="true"
  >
    <div
      class="h-[500px] w-[700px] rounded-full bg-accent-primary/[0.06] blur-[120px] md:h-[600px] md:w-[900px]"
    />
  </div>

  <div
    class="relative z-10 mx-auto max-w-4xl"
    class:hero-visible={visible}
  >
    <!-- Eyebrow -->
    <p
      class="hero-stagger-1 mb-6 inline-flex items-center gap-2 rounded-full bg-surface/80 px-4 py-2 text-sm font-medium text-accent-primary ring-1 ring-border-subtle backdrop-blur-sm"
    >
      <span class="inline-block h-2 w-2 shrink-0 rounded-full bg-accent-primary" aria-hidden="true" />
      <span class="shrink-0">Built for</span>
      <span
        class="creator-type inline-block w-[21ch] text-left"
        class:creator-type-fade={fading}
        aria-live="polite"
      >{creatorTypes[typeIndex]}</span>
    </p>

    <!-- Headline -->
    <h1
      class="hero-stagger-2 mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl"
      style="font-family: var(--font-display, 'Manrope', 'Inter', sans-serif);"
    >
      Sync your transformative videos.<br class="hidden sm:block" />
      <span class="text-accent-primary">Copyright-safe. Always.</span>
    </h1>

    <!-- Subheading -->
    <p
      class="hero-stagger-3 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl"
    >
      A creator tool that separates your recording from the original video—perfectly
      synchronized, copyright-safe, and ready to share.
    </p>

    <!-- CTA -->
    <div class="hero-stagger-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-8 py-3.5 text-base font-semibold text-background shadow-elevated transition duration-subtle ease-cinematic hover:bg-primary-600 hover:shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        on:click={() => goToRoute("/react")}
      >
        Start Recording
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface/60 px-8 py-3.5 text-base font-medium text-text-primary shadow-surface backdrop-blur-sm transition duration-subtle ease-cinematic hover:bg-elevated hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={() => goToRoute("/how-it-works")}
      >
        See how it works
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-accent-primary bg-accent-primary/10 px-8 py-3.5 text-base font-medium text-accent-primary shadow-surface backdrop-blur-sm transition duration-subtle ease-cinematic hover:bg-accent-primary/15 hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={() => document.getElementById('creator-proof')?.scrollIntoView({ behavior: 'smooth' })}
        aria-label="Browse reactions"
      >
        Browse Reactions
      </button>
    </div>

    <!-- Visual hint: dual-stream preview -->
    <div class="hero-stagger-5 mt-16 flex items-center justify-center gap-3 flex-col md:flex-row md:gap-5">
      <div class="relative aspect-video w-40 overflow-hidden rounded-lg bg-surface ring-1 ring-border-subtle sm:w-52 md:w-64">
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <svg class="mx-auto mb-1 h-8 w-8 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            <span class="text-xs font-medium text-text-muted">Original Video</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-accent-primary/30">
          <div class="hero-progress h-full w-3/5 bg-accent-primary" />
        </div>
      </div>

      <!-- Sync indicator -->
      <div class="flex flex-col items-center gap-1" aria-hidden="true">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10 ring-1 ring-accent-primary/30">
          <svg class="h-5 w-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <span class="text-[10px] font-medium uppercase tracking-widest text-accent-primary">Sync</span>
      </div>

      <div class="relative aspect-video w-40 overflow-hidden rounded-lg bg-surface ring-1 ring-border-subtle sm:w-52 md:w-64">
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <svg class="mx-auto mb-1 h-8 w-8 text-accent-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            <span class="text-xs font-medium text-text-muted">Your Reaction</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-accent-secondary/30">
          <div class="hero-progress h-full w-3/5 bg-accent-secondary" />
        </div>
      </div>
    </div>
  </div>

  <!-- Scroll cue -->
  <div class="absolute bottom-8 left-1/2 -translate-x-1/2" aria-hidden="true">
    <div class="scroll-cue flex flex-col items-center gap-2 text-text-muted">
      <span class="text-xs uppercase tracking-widest">Scroll</span>
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7" />
      </svg>
    </div>
  </div>
</section>

<style>
  .hero-visible .hero-stagger-1 { animation: hero-rise 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .hero-visible .hero-stagger-2 { animation: hero-rise 0.7s 0.2s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .hero-visible .hero-stagger-3 { animation: hero-rise 0.7s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .hero-visible .hero-stagger-4 { animation: hero-rise 0.7s 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .hero-visible .hero-stagger-5 { animation: hero-rise 0.8s 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes hero-rise {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hero-progress {
    animation: hero-progress-fill 3s 1.2s cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes hero-progress-fill {
    from { width: 0; }
    to   { width: 60%; }
  }

  .scroll-cue {
    animation: scroll-bounce 2s 2s ease-in-out infinite;
  }

  @keyframes scroll-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.5; }
    50% { transform: translateY(6px); opacity: 1; }
  }

  /* Honour reduced-motion globally */
  :global(.motion-reduce) .hero-visible .hero-stagger-1,
  :global(.motion-reduce) .hero-visible .hero-stagger-2,
  :global(.motion-reduce) .hero-visible .hero-stagger-3,
  :global(.motion-reduce) .hero-visible .hero-stagger-4,
  :global(.motion-reduce) .hero-visible .hero-stagger-5 {
    animation: none;
    opacity: 1;
    transform: none;
  }
  :global(.motion-reduce) .hero-progress { animation: none; width: 60%; }
  :global(.motion-reduce) .scroll-cue { animation: none; opacity: 0.5; }

  .creator-type {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .creator-type-fade {
    opacity: 0;
    transform: translateY(-4px);
  }

  :global(.motion-reduce) .creator-type { transition: none; }
</style>

<script>
  import { goToRoute } from "$lib/helpers/routing";
  import { onMount, onDestroy } from "svelte";

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
  class="relative flex flex-col items-center overflow-hidden px-4 pb-6 pt-16 text-center md:pt-24"
  aria-label="Hero"
>
  <!-- Ambient glow -->
  <div
    class="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
    aria-hidden="true"
  >
    <div
      class="h-[500px] w-[700px] rounded-full bg-accent-primary/6 blur-[120px] md:h-[600px] md:w-[900px]"
    />
  </div>

  <div class="relative z-10 mx-auto max-w-4xl">
    <!-- Eyebrow -->
    <p
      class="mb-6 inline-flex items-center gap-2 rounded-full bg-surface/80 px-4 py-2 text-sm font-medium text-accent-primary ring-1 ring-border-subtle backdrop-blur-xs"
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
      class="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl"
      style="font-family: var(--font-display, 'Inter', 'Helvetica Neue', Arial, sans-serif);"
    >
      Sync your transformative videos.<br class="hidden sm:block" />
      <span class="text-accent-primary">Nothing reuploaded.</span>
    </h1>

    <!-- Subheading -->
    <p
      class="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl"
    >
      A creator tool that plays your recording beside the original, synchronized and
      ready to share. Sync does not remove original audio or video. Leave it out of
      the file you upload.
    </p>

    <!-- CTA -->
    <div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-8 py-3.5 text-base font-semibold text-background shadow-elevated transition duration-subtle ease-cinematic hover:bg-primary-600 hover:shadow-overlay focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        on:click={() => goToRoute("/react")}
      >
        Start Recording
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface/60 px-8 py-3.5 text-base font-medium text-text-primary shadow-surface backdrop-blur-xs transition duration-subtle ease-cinematic hover:bg-elevated hover:border-border-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={() => goToRoute("/how-it-works")}
      >
        See how it works
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-accent-primary bg-accent-primary/10 px-8 py-3.5 text-base font-medium text-accent-primary shadow-surface backdrop-blur-xs transition duration-subtle ease-cinematic hover:bg-accent-primary/15 hover:border-accent-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        on:click={() => document.getElementById('creator-proof')?.scrollIntoView({ behavior: 'smooth' })}
        aria-label="Browse reactions"
      >
        Browse Reactions
      </button>
    </div>
  </div>

  <!-- Scroll cue -->
  <div class="relative z-10 mt-10" aria-hidden="true">
    <div class="scroll-cue flex flex-col items-center gap-2 text-text-muted">
      <span class="text-xs uppercase tracking-widest">Scroll</span>
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7" />
      </svg>
    </div>
  </div>
</section>

<style>
  .scroll-cue {
    animation: scroll-bounce 2s 2s ease-in-out infinite;
  }

  @keyframes scroll-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.5; }
    50% { transform: translateY(6px); opacity: 1; }
  }

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

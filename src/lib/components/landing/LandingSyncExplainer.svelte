<script>
  import { onMount } from "svelte";

  let sectionEl;
  let revealed = false;
  let playing = false;

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealed = true;
          // Start the mock playback animation after reveal
          setTimeout(() => { playing = true; }, 600);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    if (sectionEl) observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section
  bind:this={sectionEl}
  class="relative px-4 py-24 md:py-32"
  aria-label="How sync works"
>
  <div
    class="mx-auto max-w-5xl"
    class:section-revealed={revealed}
  >
    <!-- Section header -->
    <div class="reveal-item mb-16 text-center">
      <p class="mb-3 text-sm font-medium uppercase tracking-widest text-accent-primary">
        The core idea
      </p>
      <h2
        class="text-3xl font-bold leading-tight text-text-primary sm:text-4xl md:text-5xl"
        style="font-family: var(--font-display, 'Manrope', 'Inter', sans-serif);"
      >
        Two streams. One timeline.
      </h2>
      <p class="mx-auto mt-4 max-w-xl text-base text-text-secondary md:text-lg">
        Your recording and the original video stay separate but play together in perfect sync.
      </p>
    </div>

    <!-- Dual-player mockup -->
    <div class="reveal-item-delay-1 mx-auto max-w-4xl">
      <div class="overflow-hidden rounded-xl bg-surface ring-1 ring-border-subtle shadow-elevated">
        <!-- Player chrome bar -->
        <div class="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <div class="flex gap-1.5" aria-hidden="true">
            <span class="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span class="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span class="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span class="ml-2 text-xs font-medium text-text-muted">Pure Reactions Player</span>
        </div>

        <!-- Twin players -->
        <div class="grid grid-cols-1 gap-0 sm:grid-cols-2">
          <!-- Original panel -->
          <div class="relative border-b border-border-subtle sm:border-b-0 sm:border-r">
            <div class="aspect-video bg-elevated">
              <div class="flex h-full flex-col items-center justify-center gap-2">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/10 md:h-20 md:w-20">
                  <svg class="h-8 w-8 text-accent-primary md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                  </svg>
                </div>
                <span class="text-sm font-medium text-text-secondary">Original Video</span>
              </div>
            </div>
            <!-- Label badge -->
            <div class="absolute left-3 top-3 rounded-md bg-accent-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-primary backdrop-blur-sm">
              Original
            </div>
          </div>

          <!-- Creator panel -->
          <div class="relative">
            <div class="aspect-video bg-elevated">
              <div class="flex h-full flex-col items-center justify-center gap-2">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-accent-secondary/10 md:h-20 md:w-20">
                  <svg class="h-8 w-8 text-accent-secondary md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                </div>
                <span class="text-sm font-medium text-text-secondary">Your commentary</span>
              </div>
            </div>
            <!-- Label badge -->
            <div class="absolute left-3 top-3 rounded-md bg-accent-secondary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-secondary backdrop-blur-sm">
              Reaction
            </div>
          </div>
        </div>

        <!-- Timeline / transport bar -->
        <div class="border-t border-border-subtle px-4 py-3">
          <div class="flex items-center gap-3">
            <!-- Play button -->
            <button
              class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary transition hover:bg-accent-primary/20"
              aria-label="Play demo"
              tabindex="-1"
            >
              <svg class="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
              </svg>
            </button>

            <!-- Timeline track -->
            <div class="relative flex-1">
              <div class="h-1.5 rounded-full bg-border-subtle">
                <div
                  class="sync-progress h-full rounded-full bg-accent-primary"
                  class:sync-progress-animate={playing}
                />
              </div>
              <!-- Sync tick marks (illustrative) -->
              <div class="mt-1.5 flex justify-between text-[10px] text-text-muted" aria-hidden="true">
                <span>0:00</span>
                <span class="text-accent-primary font-medium">▸ synced</span>
                <span>3:24</span>
              </div>
            </div>

            <!-- Volume icon -->
            <svg class="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-3.14a.75.75 0 011.28.53v12.72a.75.75 0 01-1.28.53l-4.72-3.14H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Annotation callouts -->
      <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="reveal-item-delay-2 flex items-start gap-3 rounded-lg bg-surface/50 p-4">
          <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-secondary/10">
            <svg class="h-4 w-4 text-accent-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-2.89a.75.75 0 011.28.53v7.72a.75.75 0 01-1.28.53l-4.72-2.89M4.5 8.25h10.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-text-primary">Your recording</p>
            <p class="text-xs text-text-muted">Uploaded to your own channel</p>
          </div>
        </div>

        <div class="reveal-item-delay-3 flex items-start gap-3 rounded-lg bg-surface/50 p-4">
          <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary/10">
            <svg class="h-4 w-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-text-primary">Perfectly synced</p>
            <p class="text-xs text-text-muted">Timeline recorded during session</p>
          </div>
        </div>

        <div class="reveal-item-delay-4 flex items-start gap-3 rounded-lg bg-surface/50 p-4">
          <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary/10">
            <svg class="h-4 w-4 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-text-primary">Original stays</p>
            <p class="text-xs text-text-muted">Streamed directly from source</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .section-revealed .reveal-item        { animation: reveal-up 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-item-delay-1 { animation: reveal-up 0.7s 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-item-delay-2 { animation: reveal-up 0.6s 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-item-delay-3 { animation: reveal-up 0.6s 0.65s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-item-delay-4 { animation: reveal-up 0.6s 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes reveal-up {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .sync-progress {
    width: 0;
    transition: width 0.3s;
  }

  .sync-progress-animate {
    animation: sync-fill 4s 0.3s cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes sync-fill {
    from { width: 0; }
    to   { width: 65%; }
  }

  :global(.motion-reduce) .section-revealed .reveal-item,
  :global(.motion-reduce) .section-revealed .reveal-item-delay-1,
  :global(.motion-reduce) .section-revealed .reveal-item-delay-2,
  :global(.motion-reduce) .section-revealed .reveal-item-delay-3,
  :global(.motion-reduce) .section-revealed .reveal-item-delay-4 {
    animation: none; opacity: 1; transform: none;
  }
  :global(.motion-reduce) .sync-progress { animation: none; width: 65%; }
  :global(.motion-reduce) .sync-progress-animate { animation: none; width: 65%; }
</style>

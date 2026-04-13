<script>
  import { onMount } from "svelte";

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
      { threshold: 0.2 }
    );
    if (sectionEl) observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section
  bind:this={sectionEl}
  class="relative px-4 py-24 md:py-32"
  aria-label="Why it's safe and clean"
>
  <div class="mx-auto max-w-5xl" class:section-revealed={revealed}>
    <!-- Header -->
    <div class="reveal-trust mb-16 text-center">
      <p class="mb-3 text-sm font-medium uppercase tracking-widest text-accent-primary">
        No copyright headaches
      </p>
      <h2
        class="text-3xl font-bold leading-tight text-text-primary sm:text-4xl md:text-5xl"
        style="font-family: var(--font-display, 'Manrope', 'Inter', sans-serif);"
      >
        Clean separation. Zero risk.
      </h2>
      <p class="mx-auto mt-4 max-w-xl text-base text-text-secondary md:text-lg">
        The original video is never re-uploaded or embedded in your file. It streams from its source—always.
      </p>
    </div>

    <!-- Comparison cards -->
    <div class="reveal-trust-delay-1 mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <!-- Old way -->
      <div class="relative overflow-hidden rounded-xl bg-surface p-6 ring-1 ring-danger/20 md:p-8">
        <div class="mb-5 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <svg class="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-danger">The old way</h3>
        </div>

        <ul class="space-y-3">
          <li class="flex items-start gap-2 text-sm text-text-muted">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-danger/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Original video baked into your upload
          </li>
          <li class="flex items-start gap-2 text-sm text-text-muted">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-danger/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Copyright strikes and takedowns
          </li>
          <li class="flex items-start gap-2 text-sm text-text-muted">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-danger/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Revenue claimed by third parties
          </li>
          <li class="flex items-start gap-2 text-sm text-text-muted">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-danger/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Messy editing and re-encoding
          </li>
        </ul>

        <!-- Decorative strikethrough -->
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div class="h-px w-4/5 rotate-[-8deg] bg-gradient-to-r from-transparent via-danger/20 to-transparent" />
        </div>
      </div>

      <!-- Pure Reactions way -->
      <div class="relative overflow-hidden rounded-xl bg-surface p-6 ring-1 ring-success/20 md:p-8">
        <div class="mb-5 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
            <svg class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-success">Pure Reactions</h3>
        </div>

        <ul class="space-y-3">
          <li class="flex items-start gap-2 text-sm text-text-secondary">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-success/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Original streams from its own source
          </li>
          <li class="flex items-start gap-2 text-sm text-text-secondary">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-success/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No copyrighted content in your file
          </li>
          <li class="flex items-start gap-2 text-sm text-text-secondary">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-success/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            You keep 100% of your revenue
          </li>
          <li class="flex items-start gap-2 text-sm text-text-secondary">
            <svg class="mt-0.5 h-4 w-4 shrink-0 text-success/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Clean, professional workflow
          </li>
        </ul>
      </div>
    </div>

    <!-- Reassurance footnote -->
    <p class="reveal-trust-delay-2 mx-auto mt-10 max-w-lg text-center text-sm text-text-muted">
      Since each stream lives at its source, there's nothing to claim. Your content stays yours.
    </p>
  </div>
</section>

<style>
  .section-revealed .reveal-trust         { animation: trust-up 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-trust-delay-1  { animation: trust-up 0.7s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-trust-delay-2  { animation: trust-up 0.6s 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes trust-up {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  :global(.motion-reduce) .section-revealed .reveal-trust,
  :global(.motion-reduce) .section-revealed .reveal-trust-delay-1,
  :global(.motion-reduce) .section-revealed .reveal-trust-delay-2 {
    animation: none; opacity: 1; transform: none;
  }
</style>

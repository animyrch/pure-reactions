<script>
  import { onMount } from "svelte";

  let sectionEl;
  let revealed = false;

  const steps = [
    {
      number: "01",
      title: "Record yourself",
      description: "Hit play on any YouTube or TikTok video. We capture your controls—play, pause, volume—as a sync timeline.",
      icon: "record",
      accent: "accent-secondary",
    },
    {
      number: "02",
      title: "Upload your reaction",
      description: "Upload your recording to your own YouTube channel. You keep full ownership of your content.",
      icon: "upload",
      accent: "accent-tertiary",
    },
    {
      number: "03",
      title: "Publish on Pure Reactions",
      description: "Paste your reaction URL, connect the original—done. Viewers see both streams perfectly synced.",
      icon: "publish",
      accent: "accent-primary",
    },
  ];

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

  const howToJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to create synchronized reaction and commentary videos with Pure Reactions",
    "description": "Record reaction, commentary, translation or voiceover videos synchronized with the original source. Your recording stays copyright-safe on your own channel.",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Record yourself",
        "text": "Hit play on any YouTube or TikTok video. Pure Reactions captures your playback controls as a sync timeline."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Upload your reaction",
        "text": "Upload your recording to your own YouTube channel. You keep full ownership and monetization of your content."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Publish on Pure Reactions",
        "text": "Paste your reaction URL and connect the original video URL. Viewers see both streams perfectly synced side by side."
      }
    ]
  });
  const howToScriptTag = `<script type="application/ld+json">${howToJsonLd}</` + `script>`;
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html howToScriptTag}
</svelte:head>

<section
  bind:this={sectionEl}
  class="relative px-4 py-24 md:py-32"
  aria-label="How the workflow works"
>
  <!-- Subtle background gradient -->
  <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-surface/40 to-transparent" aria-hidden="true" />

  <div class="relative mx-auto max-w-5xl" class:section-revealed={revealed}>
    <!-- Header -->
    <div class="reveal-step mb-16 text-center md:mb-20">
      <p class="mb-3 text-sm font-medium uppercase tracking-widest text-accent-primary">
        Three steps
      </p>
      <h2
        class="text-3xl font-bold leading-tight text-text-primary sm:text-4xl md:text-5xl"
        style="font-family: var(--font-display, 'Manrope', 'Inter', sans-serif);"
      >
        Simple by design
      </h2>
    </div>

    <!-- Steps -->
    <div class="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
      {#each steps as step, i}
        <div
          class="step-card reveal-step-{i + 1} group relative flex flex-col items-center text-center"
        >
          <!-- Step number + icon -->
          <div class="relative mb-6">
            <div
              class="flex h-20 w-20 items-center justify-center rounded-2xl bg-{step.accent}/10 ring-1 ring-{step.accent}/20 transition duration-slow group-hover:ring-{step.accent}/40 md:h-24 md:w-24"
            >
              {#if step.icon === "record"}
                <svg class="h-9 w-9 text-{step.accent} md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                </svg>
              {:else if step.icon === "upload"}
                <svg class="h-9 w-9 text-{step.accent} md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              {:else}
                <svg class="h-9 w-9 text-{step.accent} md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              {/if}
            </div>
            <!-- Number badge -->
            <span
              class="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-elevated text-xs font-bold text-{step.accent} ring-1 ring-border-subtle"
            >
              {step.number}
            </span>
          </div>

          <!-- Connector line (between cards on desktop) -->
          {#if i < steps.length - 1}
            <div class="absolute right-0 top-12 hidden h-px w-[calc(50%-2.5rem)] bg-gradient-to-r from-border-subtle to-transparent md:block" aria-hidden="true" style="left: calc(50% + 3rem);" />
          {/if}

          <h3 class="mb-2 text-lg font-semibold text-text-primary md:text-xl">
            {step.title}
          </h3>
          <p class="max-w-xs text-sm leading-relaxed text-text-muted">
            {step.description}
          </p>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .section-revealed .reveal-step   { animation: step-rise 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-step-1 { animation: step-rise 0.7s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-step-2 { animation: step-rise 0.7s 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .section-revealed .reveal-step-3 { animation: step-rise 0.7s 0.65s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes step-rise {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  :global(.motion-reduce) .section-revealed .reveal-step,
  :global(.motion-reduce) .section-revealed .reveal-step-1,
  :global(.motion-reduce) .section-revealed .reveal-step-2,
  :global(.motion-reduce) .section-revealed .reveal-step-3 {
    animation: none; opacity: 1; transform: none;
  }
</style>

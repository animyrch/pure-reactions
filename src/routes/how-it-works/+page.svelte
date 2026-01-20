<script>
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '$lib/helpers/routing';
</script>

<SEO 
  title="How It Works - Fair-Use-Free Reaction Architecture"
  description="Discover how PureReactions eliminates copyright anxiety by structurally separating original media from your reaction layer. Nothing can be claimed because nothing is copied."
  canonical="/how-it-works"
  keywords="how reaction videos work, copyright free reactions, fair use architecture, reaction video platform, youtube reactions legal"
/>

<div class="container mx-auto max-w-4xl px-4 py-12 md:py-20">
  <!-- Hero Section -->
  <div class="mb-16 text-center">
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      How It Works: <span class="text-accent-primary">Fair-Use-Free</span> by Design
    </h1>
    <p class="mx-auto max-w-2xl text-lg text-text-secondary md:text-xl">
      PureReactions eliminates copyright anxiety through architectural design. 
      Your reactions can't be claimed because they never contain the original content.
    </p>
  </div>

  <!-- Core Principle -->
  <section class="mb-16 rounded-lg bg-surface p-8 md:p-12">
    <h2 class="mb-6 text-3xl font-semibold text-text-primary">
      The Core Principle: Structural Separation
    </h2>
    <div class="space-y-6 text-text-secondary">
      <p class="text-lg">
        Traditional reaction videos combine original content with reactions in a single file. 
        This creates legal risk because you're redistributing copyrighted material.
      </p>
      <p class="text-lg">
        <strong class="text-accent-primary">PureReactions changes everything.</strong> We record only YOUR reaction—your audio, your face, your expressions. 
        The original video stays on YouTube, where the creator controls it.
      </p>
      <p class="text-lg">
        When viewers watch your reaction, we synchronize your recording with the original video in real-time. 
        Two separate streams, perfectly timed. <strong class="text-text-primary">Nothing copied. Nothing claimed.</strong>
      </p>
    </div>
  </section>

  <!-- How It Works Steps -->
  <section class="mb-16">
    <h2 class="mb-10 text-center text-3xl font-semibold text-text-primary">
      Three Steps to Freedom
    </h2>
    <div class="grid gap-8 md:grid-cols-3">
      <!-- Step 1 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          1
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">Record Your Reaction</h3>
        <p class="text-text-secondary">
          Watch any YouTube video and record your genuine response. We capture only your audio and video—never the original content.
        </p>
      </div>

      <!-- Step 2 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          2
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">We Store the Timeline</h3>
        <p class="text-text-secondary">
          Your reaction is saved with precise timing data. We remember when you paused, when you spoke, and how you felt at each moment.
        </p>
      </div>

      <!-- Step 3 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          3
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">Viewers Watch Together</h3>
        <p class="text-text-secondary">
          Your audience sees both videos side-by-side: the original from YouTube and your reaction from us. Perfect sync, zero copyright risk.
        </p>
      </div>
    </div>
  </section>

  <!-- Why This Matters -->
  <section class="mb-16 rounded-lg bg-surface p-8 md:p-12">
    <h2 class="mb-6 text-3xl font-semibold text-text-primary">
      Why This Architecture Matters
    </h2>
    <div class="space-y-6">
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">No Content ID Claims</h3>
          <p class="text-text-secondary">
            Your reaction file contains zero seconds of the original video. Content ID has nothing to detect or claim.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Creator-Friendly by Default</h3>
          <p class="text-text-secondary">
            Original creators maintain full control. Views happen on their YouTube video, supporting their channel directly.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Safe Monetization</h3>
          <p class="text-text-secondary">
            Since you only own your reaction, you can monetize it without legal complexity. Your content, your revenue.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-3 text-xl font-medium text-text-primary">React to Anything</h3>
          <p class="text-text-secondary">
            No more worrying about whether content is "safe" to react to. If it's on YouTube, you can react to it.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Technical Deep Dive Link -->
  <section class="mb-16 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-8">
    <h3 class="mb-4 text-2xl font-semibold text-text-primary">Want the Technical Details?</h3>
    <p class="mb-6 text-text-secondary">
      Learn exactly why PureReactions reactions are structurally unclaimable, including the legal framework 
      and technical architecture that makes this possible.
    </p>
    <a 
      href="/insights/why-pure-reactions-cant-be-claimed" 
      class="inline-flex items-center gap-2 text-accent-primary hover:text-accent-primary/80 transition-colors"
    >
      Read: Why Pure Reactions Can't Be Claimed
      <span aria-hidden="true">→</span>
    </a>
  </section>

  <!-- CTA -->
  <div class="text-center">
    <h3 class="mb-6 text-2xl font-semibold text-text-primary">
      Ready to React Without Limits?
    </h3>
    <CinematicButton 
      variant="primary" 
      size="large"
      on:click={() => goToRoute('/react')}
    >
      Start Creating Reactions
    </CinematicButton>
  </div>
</div>

<style>
  .container {
    padding-top: calc(72px + 2rem); /* Account for fixed nav */
  }
</style>

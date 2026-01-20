<script>
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '$lib/helpers/routing';
</script>

<SEO 
  title="How It Works - Synchronized Twin-Player Architecture"
  description="Discover how PureReactions synchronizes any content with original videos. Record separately, track your viewing, sync perfectly. Reactions, translations, voiceovers—all without copyright claims."
  canonical="/how-it-works"
  keywords="synchronized video player, twin player architecture, how sync works, copyright free video sync, reaction platform"
/>

<div class="container mx-auto max-w-4xl px-4 py-12 md:py-20">
  <!-- Hero Section -->
  <div class="mb-16 text-center">
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      The Synchronized <span class="text-accent-primary">Twin-Player</span> Experience
    </h1>
    <p class="mx-auto max-w-2xl text-lg text-text-secondary md:text-xl">
      Watch two videos perfectly synchronized. Original content on one side, reactions, translations, voiceovers, or commentary on the other. No copyright claims. Ever.
    </p>
  </div>

  <!-- Core Principle -->
  <section class="mb-16 rounded-lg bg-surface p-8 md:p-12">
    <h2 class="mb-6 text-3xl font-semibold text-text-primary">
      The Core Principle: Structural Separation
    </h2>
    <div class="space-y-6 text-text-secondary">
      <p class="text-lg">
        Traditional merged videos combine original content with reactions or commentary in a single file. 
        This creates legal risk because you're redistributing copyrighted material.
      </p>
      <p class="text-lg">
        <strong class="text-accent-primary">PureReactions changes everything.</strong> Your content stays separate. The original video stays on YouTube. 
        We track your viewing experience—every pause, play, scrub, and focus change—and sync it perfectly with your separately-uploaded content.
      </p>
      <p class="text-lg">
        When viewers watch, they see both videos side-by-side in perfect sync. 
        Two separate streams, perfectly timed. <strong class="text-text-primary">Nothing combined. Nothing claimed.</strong>
      </p>
    </div>
  </section>

  <!-- How It Works Steps -->
  <section class="mb-16">
    <h2 class="mb-10 text-center text-3xl font-semibold text-text-primary">
      Four Steps to Sync
    </h2>
    <div class="grid gap-8 md:grid-cols-2">
      <!-- Step 1 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          1
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">Watch & Create</h3>
        <p class="text-text-secondary">
          Watch the original video on PureReactions while creating your content (reaction, translation, voiceover, commentary). Record using any tool you prefer—phone, camera, screen recorder.
        </p>
      </div>

      <!-- Step 2 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          2
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">We Track Your Experience</h3>
        <p class="text-text-secondary">
          As you watch, we memorize every control: when you paused, played, scrubbed forward/backward, or focused on your content. This creates your viewing timeline.
        </p>
      </div>

      <!-- Step 3 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          3
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">Upload & Link</h3>
        <p class="text-text-secondary">
          Upload your content to YouTube (or keep it private). Enter your video ID into PureReactions, and we'll sync it with your recorded viewing timeline—perfect synchronization automatically.
        </p>
      </div>

      <!-- Step 4 -->
      <div class="rounded-lg border border-border-strong bg-elevated p-6">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-2xl font-bold text-accent-primary">
          4
        </div>
        <h3 class="mb-3 text-xl font-semibold text-text-primary">Viewers Experience Magic</h3>
        <p class="text-text-secondary">
          Your audience sees the original video and your content side-by-side, perfectly synchronized. They control both players together—pause one, both pause. Scrub one, both scrub.
        </p>
      </div>
    </div>
  </section>

  <!-- Use Cases -->
  <section class="mb-16">
    <h2 class="mb-10 text-center text-3xl font-semibold text-text-primary">
      Endless Creative Possibilities
    </h2>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">🎭 Reactions</h3>
        <p class="text-text-secondary">
          First-time reactions, emotional responses, live commentary—watch viewers experience content through your eyes.
        </p>
      </div>
      
      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">🌍 Translations</h3>
        <p class="text-text-secondary">
          Provide translations in any language, perfectly synchronized with the original. Make global content locally accessible.
        </p>
      </div>

      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">🎙️ Voiceovers</h3>
        <p class="text-text-secondary">
          Add narrative voiceovers, director's commentary, educational explanations—your voice synced with the visuals.
        </p>
      </div>

      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">🎵 Mixes & Remixes</h3>
        <p class="text-text-secondary">
          Create music mixes, mashups, or remixes that play alongside the original for comparison and appreciation.
        </p>
      </div>

      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">♿ Audio Descriptions</h3>
        <p class="text-text-secondary">
          Make visual content accessible by adding detailed audio descriptions synchronized with the original.
        </p>
      </div>

      <div class="rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-xl font-medium text-text-primary">📚 Educational Commentary</h3>
        <p class="text-text-secondary">
          Provide expert analysis, historical context, or technical breakdowns—education synced with entertainment.
        </p>
      </div>
    </div>
  </section>

  <!-- Why This Architecture Matters -->
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
            Your content file contains zero seconds of the original video. Content ID has nothing to detect or claim. Your monetization stays yours.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Creator-Friendly by Default</h3>
          <p class="text-text-secondary">
            Original creators maintain full control. Views happen on their YouTube video, supporting their channel directly. Everyone wins.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Record However You Want</h3>
          <p class="text-text-secondary">
            Use any camera, any software, any workflow. We don't record for you—we just sync what you create. Total creative freedom.
          </p>
        </div>
      </div>
      
      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Fine-Tune Everything</h3>
          <p class="text-text-secondary">
            Not happy with the automatic sync? Edit your viewing timeline with precision controls. Adjust every pause, play, and timing to perfection.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="text-2xl text-success">✓</div>
        <div>
          <h3 class="mb-3 text-xl font-medium text-text-primary">Immersive Viewing</h3>
          <p class="text-text-secondary">
            Viewers get the best of both worlds: the original content in full quality and your creative contribution, synchronized perfectly. It's not a compromise—it's an enhancement.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Technical Deep Dive Link -->
  <section class="mb-16 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-8">
    <h3 class="mb-4 text-2xl font-semibold text-text-primary">Want the Technical Details?</h3>
    <p class="mb-6 text-text-secondary">
      Learn exactly why synchronized twin-player content is structurally unclaimable, including the legal framework 
      and technical architecture that makes this possible.
    </p>
    <a 
      href="/insights/why-synced-content-cant-be-claimed" 
      class="inline-flex items-center gap-2 text-accent-primary hover:text-accent-primary/80 transition-colors"
    >
      Read: Why Synced Content Can't Be Claimed
      <span aria-hidden="true">→</span>
    </a>
  </section>

  <!-- CTA -->
  <div class="text-center">
    <h3 class="mb-6 text-2xl font-semibold text-text-primary">
      Ready to Create Synchronized Content?
    </h3>
    <CinematicButton 
      variant="primary" 
      size="large"
      on:click={() => goToRoute('/react')}
    >
      Get Started
    </CinematicButton>
  </div>
</div>

<style>
  .container {
    padding-top: calc(72px + 2rem); /* Account for fixed nav */
  }
</style>

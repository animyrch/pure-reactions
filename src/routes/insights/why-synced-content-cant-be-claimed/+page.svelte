<script>
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '$lib/helpers/routing';
</script>

<SEO 
  title="What Content ID Sees - Twin-Player Architecture"
  description="Content ID scans the file you upload. Leaving the original out of that file gives the scan no original picture or audio from that source to match."
  canonical="/insights/why-synced-content-cant-be-claimed"
  keywords="content id claims, copyright claims, youtube content id, separate upload, twin player architecture"
  type="article"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <!-- Breadcrumb -->
  <nav class="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li><a href="/insights" class="hover:text-accent-primary transition-colors">Insights</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-text-primary">What Content ID sees</li>
    </ol>
  </nav>

  <!-- Article Header -->
  <header class="mb-12">
    <div class="mb-4 inline-flex rounded-md bg-accent-primary/20 px-3 py-1 text-xs font-medium text-accent-primary">
      Architecture
    </div>
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      What Content ID sees
    </h1>
    <p class="text-xl text-text-secondary">
      Content ID scans the file you upload. Leaving the original out of that file gives the scan no original picture or audio from that source to match. This page does not decide a copyright dispute about the synced viewing page.
    </p>
  </header>

  <!-- Article Content -->
  <div class="prose-custom space-y-8 text-text-secondary">
    
    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">The Problem with Combined Videos</h2>
      <p class="mb-4">
        When you upload a traditional merged video—combining original content with your reaction, translation, or commentary—you're distributing a file that contains copyrighted material. Even if your use might qualify for fair use legally, Content ID doesn't care about nuances.
      </p>
      <p class="mb-4">
        Content ID scans every uploaded file for copyrighted audio and video. When it finds a match (which it will, because the original content is in your file), it automatically claims the video on behalf of the copyright holder. Your video gets monetized by someone else, or taken down entirely.
      </p>
      <div class="my-6 rounded-lg border border-danger/30 bg-danger/5 p-6">
        <p class="text-text-primary">
          <strong>The fundamental issue:</strong> You're redistributing copyrighted material, which triggers automated systems regardless of whether your use is legally defensible.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">How PureReactions Changes the Game</h2>
      <p class="mb-4">
        Pure Reactions keeps the original out of the file you upload:
      </p>
      <ol class="mb-4 ml-6 list-decimal space-y-2">
        <li><strong class="text-text-primary">You record your content separately</strong> — Use any camera, software, or workflow. Your file contains only YOUR content—zero seconds of the original.</li>
        <li><strong class="text-text-primary">We track your viewing experience</strong> — As you watch the original on our platform, we record your controls: play, pause, scrub, focus changes. This is just data, not copyrighted content.</li>
        <li><strong class="text-text-primary">You upload to YouTube separately</strong> — Your recording goes to YouTube as its own video.</li>
        <li><strong class="text-text-primary">We sync during playback</strong> — When viewers watch, their browser loads the original from YouTube and your content from YouTube, then our platform synchronizes them in real-time.</li>
      </ol>
      <div class="my-6 rounded-lg border border-success/30 bg-success/5 p-6">
        <p class="text-text-primary">
          <strong>What the scan can see:</strong> Content ID matches what is inside the uploaded file. A file that leaves the original out gives that scan no original footage to match. Other audio or video in the file can still match.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">What Content ID Actually Sees</h2>
      <p class="mb-4">
        When you upload your synchronized content to YouTube:
      </p>
      <ul class="mb-4 ml-6 list-disc space-y-2">
        <li><strong class="text-text-primary">Audio:</strong> Only your voice, music, or sounds you created</li>
        <li><strong class="text-text-primary">Video:</strong> Only your footage, your face, your graphics</li>
        <li><strong class="text-text-primary">Duration:</strong> The length of your content (which may differ from the original)</li>
        <li><strong class="text-text-primary">No original fingerprints:</strong> Zero copyrighted audio waveforms or video fingerprints from the source material</li>
      </ul>
      <p class="mb-4">
        Content ID has no copy of the original inside that file to match. It can still match something else you included.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">The Legal Framework</h2>
      <p class="mb-4">
        The file and the synced page are different things:
      </p>
      <div class="space-y-4">
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">No Distribution of Copyrighted Material</h3>
          <p>
            The original plays from YouTube or TikTok through the official player. Pure Reactions stores the link and the sync timings. It does not upload that video.
          </p>
        </div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">No Reproduction</h3>
          <p>
            The file you upload is your recording. The synced page plays the original from the host next to it. The publisher of that host video controls whether it stays public and whether embedding stays on.
          </p>
        </div>
        <div>
          <h3 class="mb-2 text-xl font-medium text-text-primary">Fair use is a separate question</h3>
          <p>
            Fair use is a defense when a file includes someone else's work. The file you upload is meant to leave that work out. This page does not decide the legal status of watching the two players together.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Real-World Use Cases</h2>
      <div class="space-y-4">
        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">✓ React to Music Videos</h3>
          <p>
            Music labels are notoriously aggressive with Content ID. With PureReactions, their audio never enters your file, so their claims never trigger.
          </p>
        </div>
        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">✓ Translate Global Content</h3>
          <p>
            Provide translations for foreign language content. Your translated audio stays separate, avoiding any claims on the original language track.
          </p>
        </div>
        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">✓ Add Educational Commentary</h3>
          <p>
            Provide expert analysis or educational voiceovers. Your expertise is separate, your monetization is secure.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Comparison: Traditional vs. Synchronized</h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-border-strong">
              <th class="p-4 text-left text-text-primary">Aspect</th>
              <th class="p-4 text-left text-text-primary">Traditional Merged</th>
              <th class="p-4 text-left text-text-primary">PureReactions Sync</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Original Content</td>
              <td class="p-4 text-danger">Combined in your file</td>
              <td class="p-4 text-success">Stays separate, links only</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Content ID Risk</td>
              <td class="p-4 text-danger">Automatic claims</td>
              <td class="p-4 text-success">Original is not in your file</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Monetization</td>
              <td class="p-4 text-danger">Shared or blocked</td>
              <td class="p-4 text-success">Follows your own upload</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Legal Defense</td>
              <td class="p-4 text-warning">Fair use required</td>
              <td class="p-4 text-success">Not decided here</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Viewing Experience</td>
              <td class="p-4 text-warning">Lower quality (compression)</td>
              <td class="p-4 text-success">Full quality both streams</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">The Bottom Line</h2>
      <p class="mb-4 text-lg">
        The file you upload does not include the original. The synced page plays that original from YouTube or TikTok. Content ID can match only what is inside a file. None of that is a ruling that the synced page is free of a claim or a dispute.
      </p>
      <p class="text-lg">
        Whoever published the original controls that video. They can make it private, turn embedding off, or leave it public. Your recording stays on your channel.
      </p>
    </section>

  </div>

  <!-- Related Articles -->
  <aside class="mt-16 border-t border-border-strong pt-12">
    <h3 class="mb-6 text-xl font-semibold text-text-primary">Continue Reading</h3>
    <div class="grid gap-6 md:grid-cols-2">
      <a 
        href="/insights/monetization-safety-guide"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          Monetization Safety Guide →
        </h4>
        <p class="text-sm text-text-secondary">
          How to safely monetize your synchronized content without revenue sharing.
        </p>
      </a>
      <a 
        href="/how-it-works"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          How It Works →
        </h4>
        <p class="text-sm text-text-secondary">
          See the synchronized twin-player architecture in action.
        </p>
      </a>
    </div>
  </aside>

  <!-- CTA -->
  <div class="mt-12 rounded-lg bg-surface p-8 text-center">
    <h3 class="mb-4 text-xl font-semibold text-text-primary">
      Experience It Yourself
    </h3>
    <p class="mb-6 text-text-secondary">
      Create your first synchronized content
      <!-- and see why thousands trust PureReactions. -->
    </p>
    <CinematicButton 
      variant="primary" 
      size="large"
      on:click={() => goToRoute('/react')}
    >
      Get Started
    </CinematicButton>
  </div>

</article>

<style>
  .container {
    padding-top: calc(72px + 2rem); /* Account for fixed nav */
  }
  
  .prose-custom p {
    line-height: 1.75;
  }
  
  .prose-custom strong {
    font-weight: 600;
  }
  
  .prose-custom ul {
    line-height: 1.75;
  }
</style>

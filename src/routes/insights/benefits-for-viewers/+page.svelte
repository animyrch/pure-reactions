<script>
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '$lib/helpers/routing';
</script>

<SEO
  title="Benefits of Pure Reactions for Viewers"
  description="Discover why watching reactions on PureReactions is a better experience: original quality video, independent volume controls, source links, creator support, and more."
  canonical="/insights/benefits-for-viewers"
  keywords="pure reactions viewer benefits, reaction video quality, original source link, support original creator, synchronized reaction viewer"
  type="article"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <!-- Breadcrumb -->
  <nav class="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li><a href="/insights" class="hover:text-accent-primary transition-colors">Insights</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-text-primary">Benefits for Viewers</li>
    </ol>
  </nav>

  <!-- Article Header -->
  <header class="mb-12">
    <div class="mb-4 inline-flex rounded-md bg-accent-secondary/20 px-3 py-1 text-xs font-medium text-accent-secondary">
      Viewer Experience
    </div>
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      Why Watching Reactions on PureReactions Is Better
    </h1>
    <p class="text-xl text-text-secondary">
      A breakdown of every advantage PureReactions offers to the people who matter most — the viewers.
    </p>
  </header>

  <!-- Article Content -->
  <div class="prose-custom space-y-8 text-text-secondary">

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Original Quality, Every Time</h2>
      <p class="mb-4">
        Traditional reaction videos compress and re-encode the original content into the reactor's file. Every generation of compression degrades the picture and audio. By the time it reaches you, the original has been squeezed at least twice.
      </p>
      <p class="mb-4">
        On PureReactions, the original video is streamed directly from its source at maximum quality. The platform never touches the original file — it simply plays it alongside the reaction in perfect sync.
      </p>
      <div class="my-6 rounded-lg border border-success/30 bg-success/5 p-6">
        <p class="text-text-primary">
          <strong>The result:</strong> You watch the original content exactly as its creator intended — at full resolution and fidelity — no matter how many times it has been reacted to.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Independent Volume Control</h2>
      <p class="mb-4">
        In a merged reaction video, the reactor decides the final audio mix. If they set the original too quiet, you're stuck. If their microphone is blasting and the music is barely audible, there's nothing you can do.
      </p>
      <p class="mb-4">
        PureReactions keeps the reaction and the original as two separate, individually controllable streams. You can raise or lower either one without affecting the other — finding the perfect balance for your own listening environment.
      </p>
      <div class="space-y-4">
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">🎚️ Reaction too loud?</h3>
          <p>Turn it down without losing a single note of the original.</p>
        </div>
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">🔊 Original too quiet?</h3>
          <p>Boost it without the reactor's commentary overwhelming everything.</p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Your Layout, Your Choice</h2>
      <p class="mb-4">
        The creator can configure the default page layout — where the reaction appears, how large each player is, and so on. But that is just the starting point for you.
      </p>
      <p class="mb-4">
        At any time you can expand either the original or the reaction to full screen on its own, letting you focus on whichever element matters most to you in that moment.
      </p>
      <div class="my-6 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-6">
        <p class="text-text-primary">
          <strong>In development:</strong> Even more viewer-side layout controls are on the roadmap — repositioning the reaction overlay, resizing players, and configuring the experience independently of what the reactor chose in their final cut.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Original Source Always One Click Away</h2>
      <p class="mb-4">
        How many times have you watched a reaction and wanted to explore more from the original creator, only to dig through the description, scroll past sponsor segments, and eventually give up?
      </p>
      <p class="mb-4">
        PureReactions always surfaces a direct link to the original content. No hunting through comments, no hoping the reactor remembered to paste a URL. The source is a permanent, visible part of every reaction page.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Watch Without Guilt</h2>
      <p class="mb-4">
        On traditional platforms, watching a reaction video often means the original creator earns nothing — all views and ad revenue go to the reactor's merged upload. That can feel uncomfortable, especially when the reaction is primarily driven by the quality of the original content.
      </p>
      <p class="mb-4">
        Because PureReactions streams the original directly from its source, every view registers on the original creator's channel. You support both creators simply by watching.
      </p>
      <div class="my-6 rounded-lg border border-success/30 bg-success/5 p-6">
        <p class="text-text-primary">
          <strong>No compromise:</strong> Enjoy the reaction while the original creator gets the view count, watch time, and ad impressions they deserve.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Discover Every Reaction in One Place</h2>
      <p class="mb-4">
        Want to see how other reactors responded to the same song, film, or moment? On YouTube, the algorithm decides what to surface — and it frequently pushes unrelated content instead of the reactions you're actually looking for.
      </p>
      <p class="mb-4">
        PureReactions maintains a reliable, structured listing of every reaction linked to the same original content. With a single click you can browse all reactors who covered a piece and compare their responses — no algorithm guesswork, no dead ends.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">More Control on the Horizon</h2>
      <p class="mb-4">
        The platform is actively developing additional viewer-facing features, including:
      </p>
      <ul class="mb-4 ml-6 list-disc space-y-2">
        <li>Repositioning the original or reaction overlay anywhere on screen</li>
        <li>Adjusting playback speed independently per stream</li>
        <li>Saving your personal layout preferences across sessions</li>
      </ul>
      <p>
        These capabilities are impossible on traditional merged reaction videos because everything is baked into a single file. The structural separation that PureReactions is built on is what makes ongoing viewer-side innovation possible — visit <a href="/how-it-works" class="text-accent-primary hover:text-accent-primary/80 transition-colors">How It Works</a> for an overview of that architecture.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Summary</h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-border-strong">
              <th class="p-4 text-left text-text-primary">Feature</th>
              <th class="p-4 text-left text-text-primary">Traditional Reaction</th>
              <th class="p-4 text-left text-text-primary">PureReactions</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Original video quality</td>
              <td class="p-4 text-danger">Re-compressed</td>
              <td class="p-4 text-success">Max quality from source</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Volume control</td>
              <td class="p-4 text-danger">Fixed by creator</td>
              <td class="p-4 text-success">Independent per stream</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Layout flexibility</td>
              <td class="p-4 text-danger">Fixed in final cut</td>
              <td class="p-4 text-success">Viewer-adjustable</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Source link</td>
              <td class="p-4 text-warning">Sometimes in description</td>
              <td class="p-4 text-success">Always visible</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Original creator support</td>
              <td class="p-4 text-danger">View goes to reactor only</td>
              <td class="p-4 text-success">View counts for both</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Find other reactions</td>
              <td class="p-4 text-warning">Algorithm-dependent</td>
              <td class="p-4 text-success">Structured listing, 1 click</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>

  <!-- Related Articles -->
  <aside class="mt-16 border-t border-border-strong pt-12">
    <h3 class="mb-6 text-xl font-semibold text-text-primary">Continue Reading</h3>
    <div class="grid gap-6 md:grid-cols-2">
      <a
        href="/insights/why-synced-content-cant-be-claimed"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          Why Synced Content Can't Be Claimed →
        </h4>
        <p class="text-sm text-text-secondary">
          The architectural reason original content stays free from copyright claims.
        </p>
      </a>
      <a
        href="/insights/monetization-safety-guide"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          Monetization Safety Guide →
        </h4>
        <p class="text-sm text-text-secondary">
          How creators safely keep 100% of their revenue on PureReactions.
        </p>
      </a>
    </div>
  </aside>

  <!-- CTA -->
  <div class="mt-12 rounded-lg bg-surface p-8 text-center">
    <h3 class="mb-4 text-xl font-semibold text-text-primary">
      Ready to Experience It?
    </h3>
    <p class="mb-6 text-text-secondary">
      Browse reactions and see the difference for yourself.
    </p>
    <CinematicButton
      variant="primary"
      size="large"
      on:click={() => goToRoute('/')}
    >
      Explore Reactions
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

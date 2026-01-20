<script>
  import SEO from "$lib/components/SEO.svelte";
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";
  import { goToRoute } from "$lib/helpers/routing";
</script>

<SEO
  title="Fair Use & Copyright Considerations"
  description="Understanding the legal considerations of synchronized video content and how structural separation is designed to address copyright concerns."
  canonical="/insights/synchronized-content-legality"
  keywords="video synchronization legal, copyright law, fair use, synchronized content considerations"
  type="article"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <!-- Breadcrumb -->
  <nav class="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li>
        <a href="/insights" class="hover:text-accent-primary transition-colors"
          >Insights</a
        >
      </li>
      <li aria-hidden="true">/</li>
      <li class="text-text-primary">Synchronized Content Legality</li>
    </ol>
  </nav>

  <!-- Article Header -->
  <header class="mb-12">
    <div
      class="mb-4 inline-flex rounded-md bg-warning/20 px-3 py-1 text-xs font-medium text-warning"
    >
      Legal Considerations
    </div>
    <h1
      class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl"
    >
      Fair Use & Copyright Considerations
    </h1>
    <p class="text-xl text-text-secondary">
      Understanding the legal framework of synchronized video content and how
      separation is designed to reduce copyright liability risks.
    </p>
  </header>

  <!-- Article Content -->
  <div class="prose-custom space-y-8 text-text-secondary">
    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        The Traditional Legal Framework
      </h2>
      <p class="mb-4">
        Traditional merged videos—combining original content with reactions,
        translations, or commentary—incorporate copyrighted material with
        transformative additions. Under U.S. copyright law, this often invokes
        the doctrine of "fair use."
      </p>

      <div class="my-6 rounded-lg bg-surface p-6">
        <h3 class="mb-3 text-lg font-medium text-text-primary">
          The Four Fair Use Factors
        </h3>
        <ol class="ml-6 list-decimal space-y-3">
          <li>
            <strong class="text-text-primary">Purpose and Character:</strong> Is
            the use transformative? Does it add new meaning or value?
          </li>
          <li>
            <strong class="text-text-primary">Nature of the Work:</strong> Is the
            original creative or factual? Published or unpublished?
          </li>
          <li>
            <strong class="text-text-primary">Amount Used:</strong> How much of the
            original is used? Is it reasonable for the purpose?
          </li>
          <li>
            <strong class="text-text-primary">Market Effect:</strong> Does the use
            harm the potential market for the original work?
          </li>
        </ol>
      </div>

      <p class="mb-4">
        Courts weigh these factors case-by-case. <strong
          class="text-text-primary">Fair use is context-specific</strong
        >, meaning no platform can determine conclusively whether a specific
        video qualifies. Every situation is unique.
      </p>

      <div class="my-6 rounded-lg border border-warning/30 bg-warning/5 p-6">
        <p class="text-text-primary">
          <strong>The challenge:</strong> Even if content might legally qualify as
          fair use, creators may still face claims or disputes. Resolving these disputes
          can be time-consuming and may require legal assistance.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        Legal Uncertainty for Creators
      </h2>
      <p class="mb-4">
        Since fair use is a legal defense rather than an automatic right,
        creators often face uncertainty:
      </p>
      <ul class="mb-4 ml-6 list-disc space-y-2">
        <li>It is typically asserted only after a claim or lawsuit is filed</li>
        <li>The burden of proof generally lies with the creator</li>
        <li>Legal defense can be significant in terms of cost and time</li>
        <li>
          Outcomes can vary, as different courts may interpret fair use factors
          differently
        </li>
      </ul>
      <p class="mb-4">Due to these risks, some creators may choose to:</p>
      <ul class="mb-4 ml-6 list-disc space-y-2">
        <li>
          <strong class="text-text-primary">Accept claims</strong> and allow copyright
          holders to monetize their videos
        </li>
        <li>
          <strong class="text-text-primary">Self-censor</strong> by avoiding content
          they perceive as high-risk
        </li>
        <li>
          <strong class="text-text-primary">Operate with uncertainty</strong> regarding
          potential future claims
        </li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        The PureReactions Approach
      </h2>
      <p class="mb-4 text-lg text-text-primary">
        PureReactions is designed to change the technical relationship between
        the original work and the reaction.
      </p>

      <div class="space-y-6">
        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">
            Architecture of Separation
          </h3>
          <p class="mb-3">
            In the PureReactions model, content is not technically merged into a
            single file. Instead:
          </p>
          <ul class="ml-6 list-disc space-y-2 text-sm">
            <li>
              <strong class="text-text-primary">No reuploading:</strong> The platform
              does not host a copy of the original video
            </li>
            <li>
              <strong class="text-text-primary"
                >No distribution of original work:</strong
              > The user does not transmit the original file
            </li>
            <li>
              <strong class="text-text-primary">Independent playback:</strong> The
              reaction is a separate file that plays in synchronization with the
              original
            </li>
          </ul>
        </div>

        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">
            Linking vs. Hosting
          </h3>
          <p class="mb-3">
            In many jurisdictions, linking to or embedding publicly available
            content is generally treated differently from making unauthorized
            copies. PureReactions:
          </p>
          <ul class="ml-6 list-disc space-y-2 text-sm">
            <li>
              Embeds the original video from its official source (e.g., YouTube)
            </li>
            <li>
              Uses metadata to synchronize playback locally in the user's
              browser
            </li>
            <li>Hosts only the creator’s original reaction video</li>
          </ul>
        </div>

        <div class="rounded-lg bg-surface p-6">
          <h3 class="mb-3 text-lg font-medium text-text-primary">
            Mutual Benefit Model
          </h3>
          <p class="mb-3">
            This approach is intended to preserve the interests of all parties:
          </p>
          <ul class="ml-6 list-disc space-y-2 text-sm">
            <li>
              <strong class="text-text-primary">Original creators:</strong> Retain
              views, analytics, and potential ad revenue on their original upload
            </li>
            <li>
              <strong class="text-text-primary">Reactors:</strong> Can monetize their
              own separate reaction content
            </li>
            <li>
              <strong class="text-text-primary">Viewers:</strong> Access both the
              original and reaction in full fidelity
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        International Considerations
      </h2>
      <p class="mb-4">
        Copyright laws vary significantly by jurisdiction. The concept of "fair
        use" is specific to the United States, while other countries may have
        "fair dealing" or other exceptions.
      </p>
      <p class="mb-4">
        <strong class="text-text-primary"
          >Users are responsible for ensuring their content complies with the
          laws of their jurisdiction.</strong
        >
      </p>

      <div class="space-y-4">
        <div>
          <h3 class="mb-2 text-lg font-medium text-text-primary">
            European Union
          </h3>
          <p>
            The EU Copyright Directive places specific responsibilities on
            platforms. PureReactions' model of not hosting the third-party
            content is designed to operate within these frameworks by linking to
            authorized sources.
          </p>
        </div>

        <div>
          <h3 class="mb-2 text-lg font-medium text-text-primary">
            Global Context
          </h3>
          <p>
            While specific laws differ, the general principle of distinguishing
            between hosting content and linking to content is common in many
            legal systems. However, application of these laws can vary.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        Comparing Legal Positions
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-border-strong">
              <th class="p-4 text-left text-text-primary">Legal Question</th>
              <th class="p-4 text-left text-text-primary">Traditional Merged</th
              >
              <th class="p-4 text-left text-text-primary">PureReactions Sync</th
              >
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary"
                >Technically copies original?</td
              >
              <td class="p-4 text-danger">Yes</td>
              <td class="p-4 text-success">No</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Safety mechanism</td
              >
              <td class="p-4 text-warning">Legal Defense (Fair Use)</td>
              <td class="p-4 text-success">Structural Separation</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Risk profile?</td>
              <td class="p-4 text-danger">Higher (Subjective)</td>
              <td class="p-4 text-success">Lower (Objective)</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary"
                >International viability?</td
              >
              <td class="p-4 text-warning">Varies</td>
              <td class="p-4 text-success">Generally Stronger</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Defense burden?</td>
              <td class="p-4 text-danger">High (Prove Fair Use)</td>
              <td class="p-4 text-success">Low (Prove No Copying)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="rounded-lg border border-warning/30 bg-warning/5 p-6 mb-8">
        <h3 class="font-semibold text-warning mb-2">
          Disclaimer: Not Legal Advice
        </h3>
        <p class="mb-3 text-sm text-text-primary">
          <strong>Important:</strong> This article provides educational information
          about copyright law architectures. It is not legal advice, and no attorney-client
          relationship is created by reading it. Nothing on this page guarantees
          a particular legal outcome.
        </p>
        <p class="text-sm text-text-secondary">
          If you have specific legal questions about your content, consult a
          qualified intellectual property attorney in your jurisdiction. Every
          situation is unique, and laws vary by location.
        </p>
      </div>

      <h2 class="mb-4 text-2xl font-semibold text-text-primary">
        The Bottom Line
      </h2>
      <p class="mb-4 text-lg">
        Traditional merged video creators must navigate complex and subjective
        legal doctrines. PureReactions creators use a technical architecture
        designed to reduce these risks by avoiding the copying of original
        works.
      </p>
      <p class="mb-4 text-lg">
        Instead of relying on a legal defense that requires a dispute to
        activate, it uses a structural approach designed to avoid the dispute
        foundation itself.
      </p>
      <p class="text-lg">
        <strong class="text-text-primary"
          >Designed to respect copyright while enabling creative freedom.</strong
        >
      </p>
    </section>
  </div>

  <!-- Related Articles -->
  <aside class="mt-16 border-t border-border-strong pt-12">
    <h3 class="mb-6 text-xl font-semibold text-text-primary">
      Continue Reading
    </h3>
    <div class="grid gap-6 md:grid-cols-2">
      <a
        href="/insights/why-synced-content-cant-be-claimed"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4
          class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors"
        >
          Why Synced Content Can't Be Claimed →
        </h4>
        <p class="text-sm text-text-secondary">
          The technical explanation of why Content ID can't claim synchronized
          content.
        </p>
      </a>
      <a
        href="/how-it-works"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4
          class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors"
        >
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
      Create Without Legal Anxiety
    </h3>
    <p class="mb-6 text-text-secondary">
      Experience the freedom of creating synchronized content that's legally
      yours from day one.
    </p>
    <CinematicButton
      variant="primary"
      size="large"
      on:click={() => goToRoute("/react")}
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

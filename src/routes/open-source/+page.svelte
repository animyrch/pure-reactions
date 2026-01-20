<script>
  import SEO from '$lib/components/SEO.svelte';
</script>

<SEO 
  title="Open Source - Pure Reactions"
  description="Pure Reactions is built as open-source software under the Apache License 2.0, reflecting our commitment to transparency and technical clarity."
  canonical="/open-source"
  keywords="open source, apache license, transparent platform"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <header class="mb-12">
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      Open Source
    </h1>
  </header>

  <div class="prose-custom space-y-8 text-text-secondary">
    <section>
      <p class="text-lg">
        Pure Reactions is built as open-source software.
      </p>
      <p>
        The source code for the platform is publicly available and released under the Apache License, Version 2.0. This allows anyone to inspect, use, modify, and distribute the software in accordance with the terms of the license.
      </p>
      <p>
        Open sourcing Pure Reactions reflects a commitment to transparency, technical clarity, and long-term trust—especially in areas involving content presentation, synchronization, and platform behavior.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">What Is Open Source</h2>
      
      <div class="mb-6">
        <h3 class="mb-3 text-lg font-medium text-text-primary">The open-source repository includes:</h3>
        <ul class="ml-6 list-disc space-y-2">
          <li>The core application code</li>
          <li>Synchronization logic and player coordination</li>
          <li>Platform infrastructure relevant to content playback and interaction</li>
        </ul>
      </div>

      <div>
        <h3 class="mb-3 text-lg font-medium text-text-primary">It does not include:</h3>
        <ul class="ml-6 list-disc space-y-2">
          <li>User data</li>
          <li>Private configuration or credentials</li>
          <li>Platform moderation or operational processes</li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">License</h2>
      <p class="mb-4">
        Pure Reactions is released under the Apache License 2.0.
      </p>
      <p class="mb-4">This license:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Permits commercial and non-commercial use</li>
        <li>Allows modification and redistribution</li>
        <li>Includes an explicit patent grant</li>
        <li>Requires preservation of copyright and license notices</li>
      </ul>
      <p>Full license text is available in the repository.</p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Source Code</h2>
      <p class="mb-4">The source code is available here:</p>
      <p>
        <a href="https://github.com/animyrch/pure-reactions" target="_blank" rel="noopener noreferrer" class="text-accent-primary hover:text-accent-primary/80 transition-colors">
          GitHub: animyrch/pure-reactions
        </a>
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Contributions</h2>
      <p>
        At this time, the repository is published primarily for transparency and reference.
        Contributions, issues, or suggestions may be reviewed, but the project roadmap and deployment decisions remain under the control of the Pure Reactions maintainers.
      </p>
    </section>
  </div>
</article>

<style>
  .container {
    padding-top: calc(72px + 2rem);
  }
  
  .prose-custom p {
    line-height: 1.75;
  }
  
  .prose-custom ul {
    line-height: 1.75;
  }
</style>

<script>
  import SEO from '$lib/components/SEO.svelte';
</script>

<SEO 
  title="Privacy Policy - Pure Reactions"
  description="How Pure Reactions handles accounts, sync data, and optional analytics."
  canonical="/privacy"
  keywords="privacy policy, data protection, user privacy"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <header class="mb-12">
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      Privacy Policy
    </h1>
    <p class="text-sm text-text-muted">Effective Date: October 28, 2026</p>
  </header>

  <div class="prose-custom space-y-8 text-text-secondary">
    <p class="text-lg">
      Pure Reactions is the controller for the personal data described here. Contact <a href="mailto:purereactions.app+privacy@gmail.com" class="text-accent-primary hover:text-accent-primary/80 transition-colors">purereactions.app+privacy@gmail.com</a>.
    </p>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Information we collect</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>Account data: email address, sign-in identifiers, display name, and the time you confirm you are 15 or older. We do not collect a birth date.</li>
        <li>Content you create in the product: titles, playlists, queues, bookmarks, follows, channel claims, and sync timings. Video files stay on YouTube or TikTok. We store the link, not the file.</li>
        <li>Optional analytics: page views, only after you accept Google Analytics.</li>
        <li>Security and hosting logs kept by our processors.</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Why we use it</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>Contract: to create your account and run the sync service you ask for.</li>
        <li>Consent: for Google Analytics page views. Reject leaves that script unloaded. You can change your mind by clearing this site's saved analytics choice in your browser.</li>
        <li>Legitimate interest: to keep the service secure and to fix failures. Sign-in storage is essential and is not part of the analytics choice.</li>
      </ul>
      <p class="mt-4">Account email is limited to verifying the address and to security messages required to operate the account.</p>
      <p class="mt-4"><strong class="text-text-primary">We do not sell your personal information.</strong></p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Processors</h2>
      <p class="mb-4">These services process data for Pure Reactions:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Google Firebase, for authentication, Firestore, and the Realtime Database.</li>
        <li>YouTube and TikTok, when their official players load. This app uses YouTube API Services. Google's privacy policy is at <a href="https://policies.google.com/privacy" class="text-accent-primary hover:text-accent-primary/80 transition-colors">https://policies.google.com/privacy</a>.</li>
        <li>Google Analytics, only after you accept.</li>
        <li>Algolia, for search of published reactions.</li>
        <li>Netlify, for hosting the application.</li>
        <li>Cloudflare, for the public site edge.</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Cookies and similar storage</h2>
      <p>Firebase Authentication keeps you signed in with its own storage. That storage is required for the account. Google Analytics uses cookies only after you press Accept. YouTube and TikTok players can set their own cookies when a video loads.</p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">California notice</h2>
      <p class="mb-4">If you are a California resident, this notice covers the categories we collect: identifiers such as email and account id, user content such as titles and sync data, and internet activity in the form of page views when you accept analytics.</p>
      <p>We use those categories to run the service, secure it, and, with consent, measure page views. We do not sell personal information. You can download a copy and delete your account from Account settings, or email the privacy address above.</p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Your rights</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>Download a machine-readable export from Account settings. One export is available every 24 hours. It includes your profile, reactions, playlists, queues, bookmarks, follows, channel claims, and search records for your published reactions.</li>
        <li>Delete your account from Account settings. Export and deletion stay available even if you have not confirmed your age.</li>
        <li>Ask for a correction, or object to processing, at the privacy email.</li>
        <li>Complain to the CNIL, the French data protection authority, at <a href="https://www.cnil.fr" class="text-accent-primary hover:text-accent-primary/80 transition-colors">cnil.fr</a>.</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Retention</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>Account data and the content tied to it stay for the life of the account.</li>
        <li>A deletion request removes that data as part of the request. Search records are removed in the same request.</li>
        <li>Google Analytics retention should be set to the shortest period the property allows.</li>
        <li>Security logs are kept no longer than 12 months where the host allows that setting.</li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Contact</h2>
      <p>
        Pure Reactions<br>
        Email: <a href="mailto:purereactions.app+privacy@gmail.com" class="text-accent-primary hover:text-accent-primary/80 transition-colors">purereactions.app+privacy@gmail.com</a>
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

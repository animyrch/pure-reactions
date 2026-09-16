<script>
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '$lib/helpers/routing';
</script>

<SEO
  title="Create Your First Reaction — Step-by-Step Guide"
  description="A complete walkthrough for first-time reactors: paste a YouTube URL, record with your own camera, link the upload, and publish your first reaction on Pure Reactions."
  canonical="/insights/create-your-first-reaction"
  keywords="how to create a reaction, first reaction, react to video, record reaction, pure reactions guide, publish reaction"
  type="article"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <!-- Breadcrumb -->
  <nav class="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li><a href="/insights" class="hover:text-accent-primary transition-colors">Insights</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-text-primary">Create Your First Reaction</li>
    </ol>
  </nav>

  <!-- Article Header -->
  <header class="mb-12">
    <div class="mb-4 inline-flex rounded-md bg-accent-primary/20 px-3 py-1 text-xs font-medium text-accent-primary">
      Getting Started
    </div>
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      Create Your First Reaction
    </h1>
    <p class="text-xl text-text-secondary">
      A concise walkthrough for your first test reaction — from pasting the original URL to publishing the synced result.
    </p>
  </header>

  <!-- Overview -->
  <div class="prose-custom space-y-10 text-text-secondary">

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">What you will need</h2>
      <ul class="mb-4 ml-6 list-disc space-y-2">
        <li>A verified Pure Reactions account</li>
        <li>A short YouTube video to react to (one URL is enough for a first test)</li>
        <li>Any camera — phone, webcam, DSLR — to record yourself reacting</li>
        <li>A YouTube channel where you can upload the recording (unlisted is fine)</li>
      </ul>
      <div class="my-4 rounded-lg border border-accent-primary/20 bg-accent-primary/5 p-4">
        <p class="text-text-primary text-sm">
          <strong>Desktop only:</strong> the recording session (<code>/backend</code>) requires a desktop browser. Mobile browsers cannot access all the sync controls.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-6 text-2xl font-semibold text-text-primary">Step-by-step walkthrough</h2>

      <ol class="space-y-8">

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">1</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Sign up and verify your email</h3>
            <p>Create an account and confirm your email address. Pure Reactions requires a verified account before you can start recording.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">2</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Click <strong>React</strong> in the navigation</h3>
            <p>This takes you to <code>/react</code>, the starting point for every new reaction.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">3</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Paste a YouTube URL and click Continue</h3>
            <p>Paste the URL of the video you want to react to. One video is enough for a first reaction — you can skip the sequence tools entirely.</p>
            <p class="mt-2 text-text-muted text-sm">Sequence tools are for reacting to several originals in one sitting. You can explore them after your first publish.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">4</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Click <strong>Start Reaction</strong></h3>
            <p>This creates your synced session in Firestore. The original video does <em>not</em> start yet — you still have time to set up your camera.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">5</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Point your camera and start recording</h3>
            <p>Pure Reactions does <strong>not</strong> capture your camera feed. Use any external camera, phone, or screen-capture software to record yourself. Start your recording device before you press Start Video.</p>
            <div class="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
              <p class="text-text-primary"><strong>Important:</strong> your final recording file must <em>not</em> contain the original video audio or video. Pure Reactions syncs two separate files — your recording and the original stay independent.</p>
            </div>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">6</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Click <strong>Start Video</strong> and watch</h3>
            <p>The original video begins. React naturally as you watch. Use <strong>Focus React</strong> to duck the original audio when you are talking (hold Ctrl or tap the button). This is optional.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">7</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Click <strong>Finish Reaction</strong></h3>
            <p>This locks the timeline and saves the sync data. Stop your recording device now too. You will be taken to the playback page.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">8</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Upload your recording to YouTube</h3>
            <p>Go to YouTube Studio and upload the file you just recorded. <strong>Unlisted is fine</strong> — only Pure Reactions needs to access it. Copy the video URL or ID once the upload is complete.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">9</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Open the editor and paste the YouTube URL</h3>
            <p>From the playback page, open the speed dial (bottom-right corner) and choose <strong>Edit Reaction</strong>. Paste the YouTube URL or video ID of your recording into the reaction video field.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">10</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Preview the twin-player sync</h3>
            <p>Play the reaction to verify that your face and the original stay in sync. If they drift, use the <strong>Offset</strong> field to shift your video forward or backward. <strong>Intro Buffer</strong> adds a delay before the original starts — useful if you open with a few seconds of intro.</p>
          </div>
        </li>

        <li class="flex gap-4">
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-background text-sm font-bold">11</span>
          <div>
            <h3 class="mb-1 text-lg font-semibold text-text-primary">Publish</h3>
            <p>Open the speed dial and choose <strong>Publish Reaction</strong>. Your reaction becomes publicly visible. You can unpublish it at any time from the same speed dial.</p>
          </div>
        </li>

      </ol>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Frequently asked questions</h2>

      <div class="space-y-6">

        <div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Why must my recording not contain the original video?</h3>
          <p>Pure Reactions plays your recording and the original side by side in the viewer's browser — in sync, but as two separate files. If the original audio is baked into your recording, viewers will hear it twice. More importantly, keeping them separate means your upload contains only your content, avoiding Content ID claims.</p>
        </div>

        <div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Can I keep the YouTube upload unlisted?</h3>
          <p>Yes. Pure Reactions uses the YouTube IFrame embed, which works for unlisted videos as long as the viewer is on the Pure Reactions page. Only the Pure Reactions player needs the video to be accessible, not the general public.</p>
        </div>

        <div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Where do my drafts live?</h3>
          <p>Go to <a href="/my-reactions" class="text-accent-primary hover:underline">/my-reactions</a> to see all your reactions — both drafts (unpublished) and live ones.</p>
        </div>

        <div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">What does Edit / Publish / Unpublish mean?</h3>
          <ul class="ml-6 list-disc space-y-1 mt-2">
            <li><strong class="text-text-primary">Edit</strong> — adjust the reaction video ID, offset, buffer, finish time, and overlay layout.</li>
            <li><strong class="text-text-primary">Publish</strong> — make the reaction publicly visible. Only appears in the speed dial once a reaction video ID exists.</li>
            <li><strong class="text-text-primary">Unpublish</strong> — revert to a private draft at any time.</li>
          </ul>
        </div>

        <div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">What about legality and monetization?</h3>
          <p>See <a href="/insights/synchronized-content-legality" class="text-accent-primary hover:underline">Synchronized Content Legality</a> and <a href="/insights/monetization-safety-guide" class="text-accent-primary hover:underline">Monetization Safety Guide</a> for detailed coverage of why the twin-player model is structurally different from re-uploading the original.</p>
        </div>

      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">What comes next?</h2>
      <p class="mb-4">After your first publish, explore these advanced features:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong class="text-text-primary">Sequence / Playlist</strong> — react to multiple originals in a single session and publish them as a playlist.</li>
        <li><strong class="text-text-primary">Share Session</strong> — invite co-watchers to your live recording session.</li>
        <li><strong class="text-text-primary">Overlay layout</strong> — choose which player is primary in fullscreen and adjust the picture-in-picture size.</li>
        <li><strong class="text-text-primary">TikTok originals</strong> — paste a TikTok URL instead of YouTube (volume control is limited to mute/full).</li>
      </ul>
    </section>

  </div>

  <!-- CTA -->
  <div class="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
    <CinematicButton on:click={() => goToRoute('/react')}>
      Start your first reaction
    </CinematicButton>
    <a href="/my-reactions" class="text-sm text-text-muted hover:text-text-primary transition-colors">
      View my reactions →
    </a>
  </div>

</article>

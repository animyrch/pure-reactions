<script>
  import SEO from '#lib/components/SEO.svelte';
  import CinematicButton from '#lib/components/design-system/CinematicButton.svelte';
  import { goToRoute } from '#lib/helpers/routing.js';
</script>

<SEO
  title="Remix a video without taking the upload"
  description="A remix lets you start later, skip, stop early, and change volume or speed while the video still plays from the original upload. Views, ads, and watch time stay with that creator."
  canonical="/insights/remix-without-taking-the-upload"
  keywords="remix video, original creator views, do not reupload, youtube embed views, reaction alternative, full episode"
  type="article"
/>

<article class="container mx-auto max-w-3xl px-4 py-12 md:py-20">
  <nav class="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li><a href="/insights" class="hover:text-accent-primary transition-colors">Insights</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-text-primary">Remix without taking the upload</li>
    </ol>
  </nav>

  <header class="mb-12">
    <div class="mb-4 inline-flex rounded-md bg-accent-primary/20 px-3 py-1 text-xs font-medium text-accent-primary">
      Remix
    </div>
    <h1 class="mb-6 text-4xl font-bold leading-tight text-text-primary md:text-5xl">
      Edit the episode. Leave the upload where it is.
    </h1>
    <p class="text-xl text-text-secondary">
      A fresh full episode does not belong on someone else's channel. A remix changes how people watch it, and the video still plays from the original.
    </p>
  </header>

  <div class="prose-custom space-y-8 text-text-secondary">

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">A copy takes the audience with it</h2>
      <p class="mb-4">
        Posting a two-hour episode that just came out, as your own file, is a second copy of someone else's work. People watch your copy instead of the original. Ads on that copy, if it is allowed to have any, do not pay the person who made the episode. The place you posted it can also treat the copy as a copyright problem.
      </p>
      <p class="mb-4">
        A short clip, a segment, or your own commentary is a different thing. A brand-new full episode is not. The creator just published it. They are the ones who should get the views.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">A remix is an edit, not a new file</h2>
      <p class="mb-4">
        Remix mode is for the original video by itself. You do not upload a reaction, and you do not upload the episode. In the editor, turn Remix mode on. The original stays full screen. Nothing sits on top of it, and there is no second soundtrack of yours to mix.
      </p>
      <p class="mb-4">
        What people watch is the same player the episode already lives in, on YouTube or TikTok. Pure Reactions keeps the link and the edits. It does not keep a copy of the video. When the remix is published, the card is marked Remix, and the time on that card is how much of the original people actually watch.
      </p>
      <div class="my-6 rounded-lg border border-success/30 bg-success/5 p-6">
        <p class="text-text-primary">
          <strong>The standing is simple:</strong> you shaped the watch. You did not take the file.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">What you can change</h2>
      <p class="mb-4">
        The edits follow the original video's own clock. You are deciding how this watch unfolds, not baking a new movie.
      </p>
      <div class="space-y-4">
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">Start later</h3>
          <p>Set a start time. When playback begins, the original video starts from that moment, not from the opening.</p>
        </div>
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">Skip a stretch</h3>
          <p>When you resume the original, you can point it at a later moment. The part in between is skipped for this watch only.</p>
        </div>
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">End early</h3>
          <p>Stopping the original closes the remix. The episode on its own channel is unchanged, and anyone who opens it there still gets the full length.</p>
        </div>
        <div class="rounded-lg bg-surface p-5">
          <h3 class="mb-2 text-lg font-medium text-text-primary">Volume and speed</h3>
          <p>You can make the original quieter or louder, or shift how fast it plays, at the moments you choose.</p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Views, ads, and attention stay with the original</h2>
      <p class="mb-4">
        Because the episode never leaves its upload, a play still registers on that channel. The watch time is watch time on that video. Ads that run are the ads in that player, for the channel that published it, not ads on a copy you made.
      </p>
      <p class="mb-4">
        That watch time is also what the host already uses when it decides what to show more people. A reupload spends that attention on the copy. A remix spends it on the original, which is the point of sharing the episode in the first place.
      </p>
      <div class="my-6 rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-6">
        <p class="text-text-primary">
          <strong>They still control it.</strong> The person who published the episode can leave it public, make it private, or turn embedding off. If they take it down or stop it from playing elsewhere, the remix stops too. There is no leftover file to keep circulating.
        </p>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Remix, or a reaction beside it</h2>
      <p class="mb-4">
        Use a remix when the episode is the thing you want people to watch, just not from the first second to the last, and not at one locked volume.
      </p>
      <p class="mb-4">
        Use a reaction when you have something of your own to add: your face, your voice, a translation, a comment. That recording is a separate video, yours, played next to the original. The original still comes from its own upload, in sync. Sync does not pull the episode into your file. Leave it out of the file you upload.
      </p>
      <p>
        Either way, you are not posting a second copy of this week's full episode. A reaction is the right tool when you are in the frame. A remix is the right tool when you are only shaping the original.
      </p>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">How to publish one</h2>
      <ol class="mb-4 ml-6 list-decimal space-y-3">
        <li>Start from the original video's link, the same way you would any other piece of content.</li>
        <li>Open the editor and turn on <strong class="text-text-primary">Remix mode</strong>. The note under the switch says the original plays on its own. You do not link a reaction video.</li>
        <li>Set the start time if this watch should begin later than the opening.</li>
        <li>Open fine-tune. Cues follow the original video, and it stays full screen. Click a track to add or fix pauses, volume, or speed. To look closer at one section, press and drag across a track, then release.</li>
        <li>Publish. Viewers get the Remix. There is no second video to upload.</li>
      </ol>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">Side by side</h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-border-strong">
              <th class="p-4 text-left text-text-primary"> </th>
              <th class="p-4 text-left text-text-primary">Reuploaded episode</th>
              <th class="p-4 text-left text-text-primary">Remix</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">The file</td>
              <td class="p-4 text-danger">A new copy of the episode</td>
              <td class="p-4 text-success">The original upload</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Who gets the view</td>
              <td class="p-4 text-danger">The copy</td>
              <td class="p-4 text-success">The original channel</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">Ads</td>
              <td class="p-4 text-danger">On the copy, if it has any</td>
              <td class="p-4 text-success">In the original player</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">What you change</td>
              <td class="p-4 text-warning">Whatever you bake into the new file</td>
              <td class="p-4 text-success">Start, skips, ending, volume, speed</td>
            </tr>
            <tr class="border-b border-border-subtle">
              <td class="p-4 font-medium text-text-primary">If the creator takes it down</td>
              <td class="p-4 text-danger">The copy can remain</td>
              <td class="p-4 text-success">The remix stops. Nothing else was saved.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-2xl font-semibold text-text-primary">The short version</h2>
      <p>
        Don't put this week's full episode on another channel. Remix it. People still watch the original upload, and the views, the ads, and the attention those watches create stay with the person who made it.
      </p>
    </section>

  </div>

  <aside class="mt-16 border-t border-border-strong pt-12">
    <h3 class="mb-6 text-xl font-semibold text-text-primary">Continue Reading</h3>
    <div class="grid gap-6 md:grid-cols-2">
      <a
        href="/insights/benefits-for-viewers"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          Benefits for Viewers →
        </h4>
        <p class="text-sm text-text-secondary">
          Why watching from the original upload is better for the viewer and for the creator.
        </p>
      </a>
      <a
        href="/insights/why-synced-content-cant-be-claimed"
        class="group rounded-lg border border-border-strong bg-elevated p-6 transition-all duration-subtle hover:border-accent-primary/50"
      >
        <h4 class="mb-2 font-medium text-text-primary group-hover:text-accent-primary transition-colors">
          What Content ID sees →
        </h4>
        <p class="text-sm text-text-secondary">
          If you also record yourself, leave the original out of the file you upload.
        </p>
      </a>
    </div>
  </aside>

  <div class="mt-12 rounded-lg bg-surface p-8 text-center">
    <h3 class="mb-4 text-xl font-semibold text-text-primary">
      Shape an episode without taking it
    </h3>
    <p class="mb-6 text-text-secondary">
      Start from the original link, turn on Remix mode, and publish the watch. Not a copy.
    </p>
    <CinematicButton
      variant="primary"
      size="large"
      on:click={() => goToRoute('/react')}
    >
      Create content
    </CinematicButton>
  </div>

</article>

<style>
  .container {
    padding-top: calc(72px + 2rem);
  }

  .prose-custom p {
    line-height: 1.75;
  }

  .prose-custom strong {
    font-weight: 600;
  }

  .prose-custom ol {
    line-height: 1.75;
  }
</style>

<script>
  import YouTubeDiscussionSection from './YouTubeDiscussionSection.svelte';
  import { resolveDiscussionSections } from '$lib/helpers/youtubeComments';

  /** @type {string|undefined} */
  export let reactionVideoId = undefined;
  /** @type {string|undefined} */
  export let originalVideoId = undefined;
  /** @type {string} 'youtube' | 'tiktok' | etc. */
  export let originalVideoPlatform = 'youtube';

  $: resolved = resolveDiscussionSections({
    reactionVideoId,
    originalVideoId,
    originalVideoPlatform,
  });
  $: sections = resolved.sections;
</script>

{#if sections.length > 0}
  <div
    class="space-y-4"
    data-testid="youtube-discussion"
    aria-label="YouTube discussions"
  >
    {#each sections as section (section.videoId + '-' + section.sourceType)}
      <YouTubeDiscussionSection
        videoId={section.videoId}
        sourceType={section.sourceType}
        sourceLabel={section.sourceLabel}
      />
    {/each}
  </div>
{/if}

<script>
  import { browser } from '$app/env';
  import { getReaction } from '#lib/helpers/firebase.js';
  import { fullReactionPath, shouldShowFullReactionLink } from '#lib/helpers/momentFromReaction.js';

  export let sourceReactionId = '';

  let href = '';
  let requestSerial = 0;

  const load = async (id) => {
    const serial = ++requestSerial;
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (!browser || !trimmed) {
      href = '';
      return;
    }
    const reaction = await getReaction(trimmed);
    if (serial !== requestSerial) return;
    href = shouldShowFullReactionLink(reaction) ? fullReactionPath(reaction.id) : '';
  };

  $: if (browser) load(sourceReactionId);
</script>

{#if href}
  <a
    href={href}
    class="inline-flex items-center text-sm font-medium text-accent-primary underline-offset-4 hover:underline"
  >
    Watch the full reaction
  </a>
{/if}

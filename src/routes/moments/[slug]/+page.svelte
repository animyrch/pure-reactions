<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import SEO from '$lib/components/SEO.svelte';
  import QueueBinomeCard from '$lib/components/QueueBinomeCard.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import { handlePrivateRoute } from '$lib/helpers/routing';
  import { currentUser } from '$lib/stores/user';
  import {
    buildMomentReactionPath,
    getMoment,
    getPublishedMomentReactions,
    startMomentReactionDraft
  } from '$lib/helpers/momentsFirestore';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';

  let moment = null;
  let momentId = '';
  let reactions = [];
  let loading = true;
  let statusMessage = '';
  let addReactionLoading = false;
  let lastLoadedSlug = '';

  $: slug = get(page).params.slug;
  $: firstReactionId = reactions[0]?.id || '';
  $: reactionCount = Number(moment?.reactionCount) || reactions.length;
  $: anchorTime = Number.isFinite(Number(moment?.momentTimeSeconds))
    ? formatTime(Number(moment.momentTimeSeconds))
    : '';

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async function loadMomentAndReactions(targetSlug) {
    loading = true;
    statusMessage = '';

    const loadedMoment = await getMoment(targetSlug);
    if (!loadedMoment) {
      moment = null;
      momentId = '';
      reactions = [];
      statusMessage = 'Moment not found.';
      loading = false;
      return;
    }

    moment = loadedMoment;
    momentId = loadedMoment.id || '';
    reactions = momentId ? await getPublishedMomentReactions(momentId) : [];
    if (!reactions.length) {
      statusMessage = 'No reactions yet. Be the first to sync one to this moment.';
    }
    loading = false;
  }

  const maybeLoadForSlug = () => {
    if (!browser || !slug || slug === lastLoadedSlug) return;
    lastLoadedSlug = slug;
    loadMomentAndReactions(slug);
  };

  onMount(() => {
    maybeLoadForSlug();
  });

  $: if (browser) {
    maybeLoadForSlug();
  }

  const handlePlayFromStart = async () => {
    if (!firstReactionId) return;
    await goto(buildMomentReactionPath(slug, firstReactionId));
  };

  const handleAddReaction = async () => {
    if (!momentId) return;
    let user;
    currentUser.subscribe((value) => {
      user = value;
    })();

    if (!user || !user.uid) {
      handlePrivateRoute();
      showToast('You must be logged in to add a reaction.', TOASTS.WARNING);
      return;
    }

    addReactionLoading = true;
    try {
      const reactionDocumentId = await startMomentReactionDraft({
        momentId,
        momentOriginalTimeSeconds: Number(moment.momentTimeSeconds),
        originalVideoId: moment.originalVideoId,
        originalVideoPlatform: moment.originalVideoPlatform,
        originalVideoTitle: moment.originalVideoTitle,
        originalVideoAuthor: moment.originalVideoAuthor,
        originalVideoUrl: moment.originalVideoUrl,
        originalVideoThumbnailUrl: moment.originalVideoThumbnailUrl,
        originalVideoThumbnailWidth: moment.originalVideoThumbnailWidth,
        originalVideoThumbnailHeight: moment.originalVideoThumbnailHeight
      });
      await goto(`/edit-reaction/${reactionDocumentId}?momentId=${momentId}`);
    } catch (error) {
      console.error('Failed to start moment reaction draft', error);
      showToast(error?.message || 'Unable to start a new reaction.', TOASTS.WARNING);
    } finally {
      addReactionLoading = false;
    }
  };
</script>

<SEO
  title={moment?.title || 'Moment'}
  description={moment?.originalVideoTitle
    ? `Choose a reaction for “${moment?.title}” in ${moment?.originalVideoTitle}.`
    : 'Choose a reaction for this moment.'}
  canonical={`/moments/${slug}`}
  robots="index, follow"
/>

<main class="moment-set-page bg-background text-text-primary">
  <div class="mx-auto max-w-6xl px-4 py-10 sm:py-14">
    <div class="mb-8 space-y-3">
      <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Moment</p>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div class="space-y-2">
          <h1 class="text-3xl font-semibold md:text-4xl">{moment?.title || 'Moment reactions'}</h1>
          {#if moment?.originalVideoTitle}
            <p class="max-w-3xl text-sm text-text-muted">
              Reactions synced to {moment.originalVideoTitle}
            </p>
          {/if}
        </div>
        <div class="flex items-center gap-3 text-sm text-text-muted">
          <span class="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1.5 backdrop-blur">
            {reactionCount} reaction{reactionCount === 1 ? '' : 's'}
          </span>
          {#if anchorTime}
            <span class="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 backdrop-blur">
              Anchor {anchorTime}
            </span>
          {/if}
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-sm text-text-muted">
          {#if loading}
            Preparing moment reactions
          {:else if statusMessage}
            {statusMessage}
          {:else}
            Pick any reaction to start watching
          {/if}
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center" aria-label="Moment playback controls">
          <button
            class="moment-btn-primary"
            type="button"
            on:click={handlePlayFromStart}
            disabled={loading || !firstReactionId}
            aria-label="Play this moment from the first reaction"
          >
            Play first reaction
          </button>
          <button
            class="moment-btn-secondary"
            type="button"
            on:click={handleAddReaction}
            disabled={addReactionLoading || !momentId}
            aria-label="Add reaction to this moment"
          >
            {addReactionLoading ? 'Starting…' : 'Add reaction'}
          </button>
        </div>
      </div>
    </div>

    {#if loading}
      <div class="py-16 text-center">
        <SubtleLoader label="Loading moment reactions" />
      </div>
    {:else if !moment}
      <div class="rounded-xl border border-sky-300/20 bg-sky-500/10 p-6 text-sm text-text-muted">
        {statusMessage || 'Moment not found.'}
      </div>
    {:else if !reactions.length}
      <div class="rounded-xl border border-sky-300/20 bg-sky-500/10 p-6 text-sm text-text-muted">
        No reactions yet. Add the first reaction for this moment.
      </div>
    {:else}
      <section class="mb-10 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-6 shadow-elevated">
        <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-sky-200/80">Watch</p>
            <h2 class="mt-1 text-lg font-semibold text-text-primary">Moment reactions</h2>
          </div>
          <p class="text-xs text-text-muted">Choose any reaction to begin.</p>
        </div>

        <ol class="queue" aria-label="Moment reaction queue">
          {#each reactions as reaction, index (reaction.id)}
            <li class="queue-li">
              <a
                class="queue-item moment-queue-item"
                href={buildMomentReactionPath(slug, reaction.id)}
                aria-label={`Watch ${reaction?.data?.reactionVideoTitle || reaction?.data?.originalVideoTitle || 'reaction'} (item ${index + 1} of ${reactions.length})`}
              >
                <QueueBinomeCard
                  linkless
                  item={{
                    type: 'reaction',
                    id: reaction.id,
                    reaction
                  }}
                  {index}
                />
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  </div>
</main>

<style>
  .moment-set-page {
    min-height: 100vh;
    background: radial-gradient(circle at 18% 22%, rgba(56, 189, 248, 0.14), transparent 36%),
      radial-gradient(circle at 82% 14%, rgba(14, 165, 233, 0.1), transparent 32%),
      radial-gradient(circle at 40% 72%, rgba(45, 212, 191, 0.08), transparent 34%),
      #08101a;
  }

  .moment-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.05rem;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(14, 165, 233, 0.85));
    color: white;
    font-weight: 600;
    box-shadow: 0 18px 40px rgba(4, 22, 36, 0.34);
    border: 1px solid rgba(125, 211, 252, 0.3);
    transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
  }

  .moment-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.05rem;
    border-radius: 999px;
    background: rgba(56, 189, 248, 0.14);
    color: rgba(224, 242, 254, 0.98);
    font-weight: 600;
    border: 1px solid rgba(125, 211, 252, 0.3);
    backdrop-filter: blur(10px);
    transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
  }

  .moment-btn-primary:hover,
  .moment-btn-secondary:hover {
    transform: translateY(-1px);
    box-shadow: 0 22px 48px rgba(4, 22, 36, 0.4);
  }

  .moment-btn-primary:focus-visible,
  .moment-btn-secondary:focus-visible {
    outline: 2px solid rgba(56, 189, 248, 0.75);
    outline-offset: 4px;
  }

  .moment-btn-primary:disabled,
  .moment-btn-secondary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .queue {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.85rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .queue-li {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  @media (min-width: 768px) {
    .queue {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .queue-item {
    display: block;
    width: 100%;
    text-decoration: none;
    color: inherit;
    border-radius: 0.95rem;
    transition: transform 200ms ease, filter 200ms ease;
  }

  .moment-queue-item:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  .moment-queue-item:focus-visible {
    outline: 2px solid rgba(56, 189, 248, 0.6);
    outline-offset: 3px;
  }

  .moment-queue-item :global(.queue-card) {
    border-color: rgba(56, 189, 248, 0.2);
    background: linear-gradient(135deg, rgba(8, 18, 28, 0.92), rgba(13, 31, 46, 0.8));
  }

  .moment-queue-item:hover :global(.queue-card),
  .moment-queue-item:focus-visible :global(.queue-card) {
    border-color: rgba(56, 189, 248, 0.4);
  }
</style>




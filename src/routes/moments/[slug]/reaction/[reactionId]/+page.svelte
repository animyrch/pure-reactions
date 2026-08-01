<script>
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SEO from '$lib/components/SEO.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import ReactionView from '$lib/components/reaction/ReactionView.svelte';
  import ReactionDetailsSection from '$lib/components/reaction/ReactionDetailsSection.svelte';
  import { useTwinPlayers } from '$lib/composables/useTwinPlayers';
  import { reactionDial } from '$lib/stores/reactionDial';
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
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  let moment = null;
  let momentId = '';
  let reactions = [];
  let reactionIds = [];
  let loading = true;

  let currentIndex = 0;
  let playbackSessionStarted = false;
  let addReactionLoading = false;
  let touchStartY = 0;
  let overlayRef;
  let lastLoadedKey = '';

  $: params = get(page).params;
  $: slug = params.slug;
  $: selectedReactionId = params.reactionId;
  $: currentReaction = reactions[currentIndex] || null;

  const initialReactionSlug = get(page).params.reactionId || '';

  const { state, actions } = useTwinPlayers({
    data: {
      slug: initialReactionSlug
      // userId and displayName can be added here from your auth/user store if needed
    },
    enableAutoPlay: false,
    momentFeedLoopEnabled: true
  });

  const replaceCurrentRouteReaction = (reactionId) => {
    if (!browser || !slug || !reactionId) return;
    const nextPath = buildMomentReactionPath(slug, reactionId);
    if (window.location.pathname === nextPath) return;
    window.history.replaceState(window.history.state, '', nextPath);
  };

  async function loadMomentAndReactions(targetSlug, targetReactionId) {
    loading = true;

    const loadedMoment = await getMoment(targetSlug);
    if (!loadedMoment) {
      moment = null;
      momentId = '';
      reactions = [];
      reactionIds = [];
      currentIndex = 0;
      loading = false;
      return;
    }

    moment = loadedMoment;
    momentId = loadedMoment.id || '';
    reactions = momentId ? await getPublishedMomentReactions(momentId) : [];
    reactionIds = reactions.map((reaction) => reaction.id);

    if (!reactionIds.length) {
      currentIndex = 0;
      loading = false;
      return;
    }

    const requestedIndex = reactionIds.indexOf(targetReactionId);
    currentIndex = requestedIndex >= 0 ? requestedIndex : 0;

    if (requestedIndex < 0) {
      replaceCurrentRouteReaction(reactionIds[currentIndex]);
    }

    loading = false;
  }

  $: loadKey = `${slug || ''}:${selectedReactionId || ''}`;
  $: if (browser && slug && loadKey !== lastLoadedKey) {
    lastLoadedKey = loadKey;
    loadMomentAndReactions(slug, selectedReactionId);
  }

  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: if (currentReaction?.id) {
    actions.handleSlugChange(currentReaction.id);
  }

  const goToReactionIndex = async (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= reactionIds.length) return;
    if (nextIndex === currentIndex) return;

    currentIndex = nextIndex;
    const nextId = reactionIds[nextIndex];
    await actions.loadReactionInPlace(nextId, {
      autoPlay: playbackSessionStarted
    });
    replaceCurrentRouteReaction(nextId);
  };

  const handleTouchStart = (event) => {
    touchStartY = event.changedTouches?.[0]?.clientY ?? 0;
  };

  const handleTouchEnd = (event) => {
    const endY = event.changedTouches?.[0]?.clientY ?? touchStartY;
    const delta = endY - touchStartY;
    if (Math.abs(delta) < 56) return;
    if (delta < 0) {
      goToReactionIndex(currentIndex + 1);
    } else {
      goToReactionIndex(currentIndex - 1);
    }
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

  onDestroy(() => {
    reactionDial.reset();
  });
</script>

<SEO
  title={moment?.title || 'Moment'}
  description={moment?.originalVideoTitle
    ? `Reactions synced to “${moment?.title}” in ${moment?.originalVideoTitle}`
    : 'Binge synchronized reactions for this moment.'}
  canonical={buildMomentReactionPath(slug, currentReaction?.id || selectedReactionId)}
  robots="index, follow"
/>

<div class="min-h-screen bg-background text-text-primary">
  {#if loading}
    <div class="mx-auto max-w-lg px-4 py-24 text-center">
      <SubtleLoader label="Loading moment reaction" />
    </div>
  {:else if !moment}
    <div class="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 class="text-2xl font-semibold text-text-primary">Moment not found</h1>
      <p class="mt-3 text-text-secondary">This moment could not be loaded.</p>
      <a
        href="/moments"
        class="mt-6 inline-flex rounded-md bg-accent-primary px-4 py-2 text-background"
      >
        Browse moments
      </a>
    </div>
  {:else if !reactionIds.length}
    <div class="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 class="text-2xl font-semibold text-text-primary">{moment.title || 'Moment'}</h1>
      <p class="mt-3 text-text-secondary">No reactions yet. Be the first to sync one to this moment.</p>
      <button
        type="button"
        class="mt-6 rounded-md bg-accent-primary px-4 py-2 text-background"
        on:click={handleAddReaction}
        disabled={addReactionLoading}
      >
        {addReactionLoading ? 'Starting…' : 'Add reaction'}
      </button>
    </div>
  {:else}
    <ReactionView
      reaction={currentReaction}
      state={$state}
      actions={actions}
      overlayRef={overlayRef}
      extra={{}}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div class="mt-6 w-full flex justify-end">
        <button
          type="button"
          class="inline-flex rounded-sm text-sm text-text-muted transition hover:text-text-primary focus-visible:outline-none focus-visible:underline disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={() => goToReactionIndex(currentIndex + 1)}
          disabled={currentIndex >= reactionIds.length - 1}
          aria-disabled={currentIndex >= reactionIds.length - 1}
        >
          Next reaction
        </button>
      </div>
      <div class="mt-6 w-full">
        <ReactionDetailsSection
          reactionState={$state}
          isEditModeOn={$state.isEditModeOn}
          includeOtherReactions={false}
        />
      </div>
    </ReactionView>
  {/if}
</div>

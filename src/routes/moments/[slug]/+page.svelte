<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SEO from '$lib/components/SEO.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import ReactionView from '$lib/components/reaction/ReactionView.svelte';
  import CreatorDetails from '$lib/components/Video/CreatorDetails.svelte';
  import PlaylistQueue from '$lib/components/Video/PlaylistQueue.svelte';
  import OtherReactions from '$lib/components/Video/OtherReactions.svelte';
  import YouTubeDiscussion from '$lib/components/Video/YouTubeDiscussion.svelte';
  import AttributionBlock from '$lib/components/reaction/AttributionBlock.svelte';
  import { useTwinPlayers } from '$lib/composables/useTwinPlayers';
  import { reactionDial } from '$lib/stores/reactionDial';
  import { handlePrivateRoute } from '$lib/helpers/routing';
  import { startMomentReactionDraft } from '$lib/helpers/momentsFirestore';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';
  import {
    getYoutubeChannelClaim,
    getYoutubeChannelVerification
  } from '$lib/helpers/firebase';
  import {
    buildAttributionVerificationState
  } from '$lib/helpers/reactionAttribution';


  import { page } from '$app/stores';
  import { getMoment, getPublishedMomentReactions } from '$lib/helpers/momentsFirestore';
  import { get } from 'svelte/store';

  let moment = null;
  let momentId = '';
  let reactions = [];
  let reactionIds = [];
  let firstReactionId = '';
  let loading = true;

  $: slug = get(page).params.slug;

  async function loadMomentAndReactions() {
    loading = true;
    moment = await getMoment(slug);
    momentId = moment?.id || '';
    reactions = momentId ? await getPublishedMomentReactions(momentId) : [];
    reactionIds = reactions.map((r) => r.id);
    firstReactionId = reactionIds[0] || '';
    loading = false;
  }

  onMount(() => {
    loadMomentAndReactions();
  });

  // If the slug changes (client navigation), reload
  $: if (browser && slug) {
    loadMomentAndReactions();
  }

  const initialReactionSlug = firstReactionId;

  let currentIndex = 0;
  let playbackSessionStarted = false;
  let showPlayGate = true;
  let addReactionLoading = false;
  let touchStartY = 0;
  let isVerifiedCreator = false;
  let overlayRef;

  const { state, actions } = useTwinPlayers({
    data: {
      slug: initialReactionSlug
      // userId and displayName can be added here from your auth/user store if needed
    },
    enableAutoPlay: false,
    momentFeedLoopEnabled: true
  });

  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: showPlayGate = !playbackSessionStarted && !$state.bothVideosStarted && !$state.isLoading;
  $: reactionCount = Number(moment?.reactionCount) || reactionIds.length;

  const resolveVerification = async () => {
    const channelHandle = $state.reactionVideoAuthor;
    if (!channelHandle) {
      isVerifiedCreator = false;
      return;
    }
    try {
      const [claimRecord, verificationRecord] = await Promise.all([
        getYoutubeChannelClaim(channelHandle),
        getYoutubeChannelVerification(channelHandle)
      ]);
      isVerifiedCreator = buildAttributionVerificationState({
        verificationRecord,
        claimRecord,
        reactorId: $state.reactorId,
        channelHandle
      }).isChannelVerified;
    } catch (error) {
      console.error('Failed to resolve channel verification', error);
      isVerifiedCreator = false;
    }
  };

  $: if (browser && $state.reactionVideoAuthor) {
    resolveVerification();
  }

  const handlePlayGate = async () => {
    playbackSessionStarted = true;
    await actions.handlePlayStateChange(true);
    if ($state.playerReaction?.playVideo) {
      $state.playerReaction.playVideo();
    }
    if ($state.playerOriginal?.playVideo) {
      $state.playerOriginal.playVideo();
    }
  };

  const goToReactionIndex = async (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= reactionIds.length) return;
    if (nextIndex === currentIndex) return;

    currentIndex = nextIndex;
    const nextId = reactionIds[nextIndex];
    await actions.loadReactionInPlace(nextId, {
      autoPlay: playbackSessionStarted
    });
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

  const handleWheel = (event) => {
    if (Math.abs(event.deltaY) < 28) return;
    event.preventDefault();
    if (event.deltaY > 0) {
      goToReactionIndex(currentIndex + 1);
    } else {
      goToReactionIndex(currentIndex - 1);
    }
  };

  const handleAddReaction = async () => {
    if (!momentId) return;
    // You may want to add user auth logic here if needed
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


  onMount(async () => {
    if (!firstReactionId) return;
    await tick();
    actions.handleSlugChange(firstReactionId);
  });

  // Keep player state in sync with current reaction
  $: if (reactions.length && reactions[currentIndex]?.id) {
    actions.handleSlugChange(reactions[currentIndex].id);
  }

  onDestroy(() => {
    reactionDial.reset();
  });
</script>

<SEO
  title={moment?.title || 'Moment'}
  description={moment?.originalVideoTitle
    ? `Reactions synced to “${moment?.title}” in ${moment?.originalVideoTitle}`
    : 'Binge synchronized reactions for this moment.'}
  canonical={`/moments/${slug}`}
  robots="index, follow"
/>

<div class="min-h-screen bg-background text-text-primary">
  {#if loading}
    <div class="mx-auto max-w-lg px-4 py-24 text-center">
      <SubtleLoader label="Loading moment…" />
    </div>
  {:else if !firstReactionId}
    <div class="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 class="text-2xl font-semibold text-text-primary">{moment?.title || 'Moment'}</h1>
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
      reaction={reactions[currentIndex]}
      state={$state}
      actions={actions}
      overlayRef={overlayRef}
      extra={{}}
    >
      <div class="grid grid-cols-1 gap-8 items-start mt-6 w-full lg:grid-cols-3">
        <div class="flex flex-col gap-6 lg:col-span-2">
          <div data-testid="reaction-metadata">
            <CreatorDetails
              originalVideoAuthor={$state.originalVideoAuthor}
              originalVideoAuthorUrl={$state.originalVideoAuthorUrl}
              originalVideoTitle={$state.originalVideoTitle}
              originalVideoId={$state.originalVideoId}
              originalVideoUrl={$state.originalVideoUrl}
              originalVideoDescription={$state.originalVideoDescription}
              originalVideoPlatform={$state.originalVideoPlatform}
              reactionVideoAuthor={$state.reactionVideoAuthor}
              reactionVideoTitle={$state.reactionVideoTitle}
              reactionVideoId={$state.reactionVideoId}
              reactionVideoDescription={$state.reactionVideoDescription}
              pageSlug={$state.pageSlug}
              isUsersOwnVideo={$state.isUsersOwnVideo}
              reactorId={$state.reactorId}
              reactorDisplayName={$state.reactorDisplayName}
            />
            <div class="mt-3 sm:mt-4">
              <AttributionBlock
                reactionVideoAuthor={$state.reactionVideoAuthor}
                reactorDisplayName={$state.reactorDisplayName}
                reactorId={$state.reactorId}
                viewerId={undefined}
              />
            </div>
          </div>
          {#if $state.originalVideoId && $state.playlistDocumentId}
            <div class="w-full">
              <PlaylistQueue
                playlistItems={$state.playlistItems}
                playlistDocument={$state.playlistDocument}
                currentlyViewed={$state.originalVideoId}
                playlistId={$state.youtubePlaylistId}
                playlistDocumentId={$state.playlistDocumentId}
                currentIndex={$state.currentIndexInPlaylist}
                isCreation={false}
              />
            </div>
          {/if}
        </div>
        {#if $state.originalVideoId && $state.reactionVideoId}
          <div class="lg:col-span-1 lg:row-span-2 flex flex-col gap-6">
            <OtherReactions
              originalVideoId={$state.originalVideoId}
              reactionVideoId={$state.reactionVideoId}
              originalVideoTitle={$state.originalVideoTitle}
            />
          </div>
        {/if}
        <div class="lg:col-span-2">
          <YouTubeDiscussion
            reactionVideoId={$state.reactionVideoId}
            originalVideoId={$state.originalVideoId}
            originalVideoPlatform={$state.originalVideoPlatform}
          />
        </div>
      </div>
    </ReactionView>
  {/if}
</div>




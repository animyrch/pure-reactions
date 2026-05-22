<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SEO from '$lib/components/SEO.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import ReactionStage from '$lib/components/reaction/ReactionStage.svelte';
  import AttributionBlock from '$lib/components/reaction/AttributionBlock.svelte';
  import MomentChrome from '$lib/components/Moments/MomentChrome.svelte';
  import MomentPlayGate from '$lib/components/Moments/MomentPlayGate.svelte';
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

  export let data;

  $: moment = data?.moment;
  $: momentId = moment?.id;
  $: reactionIds = data?.reactionIds || [];
  $: firstReactionId = data?.firstReactionId;

  const initialReactionSlug = data?.firstReactionId || '';

  let currentIndex = 0;
  let playbackSessionStarted = false;
  let showPlayGate = true;
  let addReactionLoading = false;
  let touchStartY = 0;
  let isVerifiedCreator = false;
  let overlayRef;

  const { state, actions } = useTwinPlayers({
    data: {
      slug: initialReactionSlug,
      userId: data?.userId,
      displayName: data?.displayName
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
    if (!data?.userId) {
      handlePrivateRoute();
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

  onMount(async () => {
    if (!firstReactionId) return;
    await tick();
    actions.handleSlugChange(firstReactionId);
  });

  onDestroy(() => {
    reactionDial.reset();
  });
</script>

<SEO
  title={moment?.title || 'Moment'}
  description={moment?.originalVideoTitle
    ? `Reactions synced to “${moment.title}” in ${moment.originalVideoTitle}`
    : 'Binge synchronized reactions for this moment.'}
  canonical="/moments/{data.slug}"
  robots="index, follow"
/>

{#if !firstReactionId}
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
  <div
    class="moment-feed fixed inset-0 z-20 bg-black"
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:wheel|nonpassive={handleWheel}
  >
    {#if $state.isLoading}
      <div class="absolute inset-0 z-40 flex items-center justify-center bg-background">
        <SubtleLoader label="Preparing moment reaction" />
      </div>
    {/if}

    <MomentChrome
      {momentId}
      momentTitle={moment?.title || 'Moment'}
      {reactionCount}
      onAddReaction={handleAddReaction}
      {addReactionLoading}
    />

    <div class="relative h-full w-full" aria-hidden={$state.isLoading}>
      <ReactionStage
        isFullscreen={true}
        isControlSurfaceVisible={$state.isControlSurfaceVisible}
        isExitButtonExpanded={false}
        showCinematicBars={false}
        isReactionMissing={$state.isReactionMissing}
        isUsersOwnVideo={$state.isUsersOwnVideo}
        playerOriginal={$state.playerOriginal}
        playerReaction={$state.playerReaction}
        originalVideoPlatform={$state.originalVideoPlatform}
        stickyControlsClass="opacity-100"
        bothVideosStarted={$state.bothVideosStarted}
        isPlaylist={false}
        isPlaylistAutoPlay={false}
        reactionCurrentTime={$state.reactionCurrentTime}
        reactionDuration={$state.reactionDuration}
        offsetStartTime={$state.offsetStartTime}
        reactionFinishTime={$state.reactionFinishTime}
        bind:overlayRef
        on:playStateChanged={(event) => {
          if (event.detail?.isPlaying) playbackSessionStarted = true;
          actions.handlePlayStateChange(event.detail.isPlaying);
        }}
      />

      <MomentPlayGate visible={showPlayGate} onPlay={handlePlayGate} />

      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-16">
        <div class="pointer-events-auto max-w-3xl">
          <AttributionBlock
            {isVerifiedCreator}
            reactionVideoAuthor={$state.reactionVideoAuthor}
            reactorDisplayName={$state.reactorDisplayName}
            reactorId={$state.reactorId}
            viewerId={data?.userId}
          />
          <p class="mt-3 text-xs text-white/60">
            Swipe up or down for the next reaction · {currentIndex + 1} of {reactionIds.length}
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body:has(.moment-feed)) {
    overflow: hidden;
  }

  .moment-feed {
    touch-action: pan-y;
  }
</style>

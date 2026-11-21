<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { ArrowLeftOutline } from 'flowbite-svelte-icons';
  import SEO from '#lib/components/SEO.svelte';
  import CinematicButton from '#lib/components/design-system/CinematicButton.svelte';
  import { auth } from '#lib/constants/firebase.js';
  import { handlePrivateRoute } from '#lib/helpers/routing.js';
  import { pageStore } from '#lib/helpers/pageStore.js';
  import { getReaction } from '#lib/helpers/firebase.js';
  import { createMomentWithSlug, buildMomentReactionPath, listOwnedSourceReactions, getMomentsByOriginalVideoId } from '#lib/helpers/momentsFirestore.js';
  import { createPublishedMomentSlice } from '#lib/helpers/firebase.js';
  import {
    assessReactionSlice,
    assessSourceReaction,
    buildMomentSliceDocument,
    existingMomentOptionLabel,
    formatAnchorClock,
    originalVideoUrlFromReaction,
    readSliceBounds,
    resolveMomentTarget,
    sourceReactionOptionLabel
  } from '#lib/helpers/momentFromReaction.js';
  import { showToast } from '#lib/stores/toast.js';
  import { TOASTS } from '#lib/constants/toasts.js';

  const page = pageStore();

  let ownedReactions = [];
  let loadingReactions = true;
  let loadingMoments = false;
  let existingMoments = [];
  let selectedReactionId = '';
  let momentChoice = '';
  let title = '';
  let anchorInput = '';
  let tagsInput = '';
  let sliceStart = '';
  let sliceEnd = '';
  let isSubmitting = false;
  let errorMessage = '';
  let momentsMessage = '';
  let momentsRequest = 0;

  const fieldClass = 'w-full rounded-2xl border border-border-strong/50 bg-surface/80 px-4 py-3 text-text-primary';

  const clearError = () => {
    if (errorMessage) errorMessage = '';
  };

  const findOwnedReaction = (reactionId) =>
    ownedReactions.find((item) => item.id === reactionId) || null;

  const loadOwnedReactions = async (preferredId) => {
    const user = auth?.currentUser;
    if (!user?.uid) return;
    loadingReactions = true;
    try {
      ownedReactions = await listOwnedSourceReactions(user.uid);
      if (preferredId && !ownedReactions.some((reaction) => reaction.id === preferredId)) {
        const loaded = await getReaction(preferredId);
        const assessed = assessSourceReaction(loaded, user.uid);
        errorMessage = assessed.ok ? '' : assessed.error;
      }
    } catch (error) {
      console.error('Failed to load reactions for a moment', error);
      errorMessage = 'Could not load your reactions.';
    } finally {
      loadingReactions = false;
    }
  };

  const loadMomentsForReaction = async (reaction) => {
    existingMoments = [];
    momentsMessage = '';
    momentChoice = '';
    if (!reaction?.data?.originalVideoId) return;
    const request = ++momentsRequest;
    loadingMoments = true;
    try {
      const loaded = await getMomentsByOriginalVideoId(reaction.data.originalVideoId);
      if (request !== momentsRequest) return;
      existingMoments = loaded;
      momentChoice = existingMoments.length ? existingMoments[0].id : 'new';
      if (!existingMoments.length) {
        momentsMessage = 'No moment lists this original video yet. Set an anchor time to create one.';
        if (!title.trim()) title = reaction.data.originalVideoTitle || '';
      }
    } catch (error) {
      console.error('Failed to load moments for the original video', error);
      momentsMessage = 'Could not check existing moments. You can still set a new anchor time.';
      momentChoice = 'new';
    } finally {
      loadingMoments = false;
    }
  };

  const chooseReaction = async (reactionId) => {
    clearError();
    selectedReactionId = reactionId;
    title = '';
    anchorInput = '';
    const reaction = findOwnedReaction(reactionId);
    if (!reaction) {
      existingMoments = [];
      momentChoice = '';
      return;
    }
    await loadMomentsForReaction(reaction);
  };

  const useNewAnchor = () => {
    momentChoice = 'new';
    const reaction = findOwnedReaction(selectedReactionId);
    if (reaction && !title.trim()) title = reaction.data.originalVideoTitle || '';
  };

  $: reaction = ownedReactions.find((item) => item.id === selectedReactionId) || null;
  $: creatingNewMoment = momentChoice === 'new' || (!loadingMoments && reaction && existingMoments.length === 0);
  $: chosenMoment = existingMoments.find((moment) => moment.id === momentChoice) || null;
  $: anchorSeconds = creatingNewMoment ? anchorInput : chosenMoment?.momentTimeSeconds;
  $: bounds = readSliceBounds(sliceStart, sliceEnd);
  $: target = reaction
    ? resolveMomentTarget({
        moments: existingMoments,
        selectedMomentId: creatingNewMoment ? 'new' : momentChoice,
        title,
        anchorSeconds,
        originalVideoUrl: originalVideoUrlFromReaction(reaction)
      })
    : { ok: false, error: '' };
  $: sliceCheck = reaction && bounds.ok && target.ok
    ? assessReactionSlice(reaction, {
        momentTimeSeconds: target.momentTimeSeconds,
        offsetStartTime: bounds.offsetStartTime,
        reactionFinishTime: bounds.reactionFinishTime
      })
    : null;
  $: anchorClock = target.ok ? formatAnchorClock(target.momentTimeSeconds) : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();

    const user = auth?.currentUser;
    if (!user?.uid) {
      handlePrivateRoute();
      return;
    }
    if (!reaction) {
      errorMessage = 'Choose one of your reactions.';
      return;
    }
    if (!bounds.ok) {
      errorMessage = bounds.error;
      return;
    }
    if (!target.ok) {
      errorMessage = target.error;
      return;
    }
    if (!sliceCheck?.ok) {
      errorMessage = sliceCheck?.errors?.[0] || 'This slice cannot be published.';
      return;
    }

    isSubmitting = true;
    try {
      let momentId = target.momentId;
      if (target.mode === 'new') {
        const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
        const data = reaction.data || {};
        const created = await createMomentWithSlug({
          title: target.title,
          originalVideoId: data.originalVideoId,
          originalVideoPlatform: data.originalVideoPlatform,
          originalVideoUrl: target.originalVideoUrl,
          originalVideoTitle: data.originalVideoTitle,
          originalVideoAuthor: data.originalVideoAuthor,
          originalVideoAuthorHandle: data.originalVideoAuthorHandle,
          originalVideoAuthorUrl: data.originalVideoAuthorUrl,
          originalVideoDescription: data.originalVideoDescription,
          originalVideoThumbnailUrl: data.originalVideoThumbnailUrl,
          originalVideoThumbnailWidth: data.originalVideoThumbnailWidth,
          originalVideoThumbnailHeight: data.originalVideoThumbnailHeight,
          momentTimeSeconds: target.momentTimeSeconds,
          tags,
          creatorId: user.uid,
          creatorDisplayName: user.displayName || ''
        });
        momentId = created.momentId;
      }

      const sliceId = await createPublishedMomentSlice(buildMomentSliceDocument(reaction, {
        momentId,
        momentTimeSeconds: target.momentTimeSeconds,
        offsetStartTime: bounds.offsetStartTime,
        reactionFinishTime: bounds.reactionFinishTime,
        userId: user.uid,
        reactorDisplayName: user.displayName || ''
      }));
      if (!sliceId) return;

      showToast('Moment reaction published.', TOASTS.SUCCESS);
      await goto(buildMomentReactionPath(momentId, sliceId));
    } catch (error) {
      console.error('Failed to publish a moment from a reaction', error);
      errorMessage = error?.message || 'Something went wrong while publishing the moment reaction.';
    } finally {
      isSubmitting = false;
    }
  };

  onMount(async () => {
    if (!auth?.currentUser) {
      handlePrivateRoute();
      return;
    }
    const preferredId = get(page).url.searchParams.get('reaction') || '';
    await loadOwnedReactions(preferredId);
    if (preferredId && ownedReactions.some((item) => item.id === preferredId)) {
      await tick();
      selectedReactionId = preferredId;
      await loadMomentsForReaction(findOwnedReaction(preferredId));
    }
  });
</script>

<SEO
  title="Create a Moment from a Reaction"
  description="Publish a slice of one of your reactions as a moment reaction."
  canonical="/moments/from-reaction"
  robots="noindex, follow"
/>

<div class="mx-auto max-w-2xl px-4 py-10 sm:py-14">
  <a
    href="/moments"
    class="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary"
  >
    <ArrowLeftOutline class="h-4 w-4" aria-hidden="true" />
    Back to moments
  </a>

  <h1 class="mt-6 text-3xl font-semibold text-text-primary">Create a moment from a reaction</h1>
  <p class="mt-2 text-base text-text-secondary">
    Choose a reaction you created. If this original video already has a moment, its anchor time is listed. Use that moment, or set a different anchor time. Then set the start and end of the reaction to publish.
  </p>

  <form class="mt-8 space-y-6" on:submit={handleSubmit}>
    <div class="space-y-2">
      <label for="source-reaction" class="text-sm font-medium text-text-primary">Reaction</label>
      {#if loadingReactions}
        <p class="text-sm text-text-muted">Loading your reactions</p>
      {:else if !ownedReactions.length}
        <p class="text-sm text-text-secondary">You have no reactions to create a moment from yet.</p>
      {:else}
        <select
          id="source-reaction"
          class={fieldClass}
          bind:value={selectedReactionId}
          on:change={(event) => chooseReaction(event.currentTarget.value)}
          required
        >
          <option value="" disabled>Choose a reaction</option>
          {#each ownedReactions as item (item.id)}
            <option value={item.id}>{sourceReactionOptionLabel(item)}</option>
          {/each}
        </select>
        {#if reaction && reaction.data?.isPublished !== true}
          <p class="text-sm text-text-muted">This reaction is not published yet. The link back to it appears after you publish it.</p>
        {/if}
      {/if}
    </div>

    {#if reaction}
      <fieldset class="space-y-3">
        <legend class="text-sm font-medium text-text-primary">Moment for this original video</legend>
        {#if loadingMoments}
          <p class="text-sm text-text-muted">Checking moments for this original video</p>
        {:else if existingMoments.length}
          <p class="text-sm text-text-secondary">
            This original video already has {existingMoments.length === 1 ? 'a moment' : `${existingMoments.length} moments`}.
          </p>
          <div class="space-y-2">
            {#each existingMoments as moment (moment.id)}
              <label class="flex items-start gap-3 rounded-2xl border border-border-strong/40 bg-surface/60 px-4 py-3 text-sm text-text-primary">
                <input
                  type="radio"
                  name="moment-choice"
                  value={moment.id}
                  bind:group={momentChoice}
                  on:change={clearError}
                />
                <span>{existingMomentOptionLabel(moment)}</span>
              </label>
            {/each}
            <label class="flex items-start gap-3 rounded-2xl border border-border-strong/40 bg-surface/60 px-4 py-3 text-sm text-text-primary">
              <input
                type="radio"
                name="moment-choice"
                value="new"
                bind:group={momentChoice}
                on:change={useNewAnchor}
              />
              <span>Different anchor time</span>
            </label>
          </div>
        {:else if momentsMessage}
          <p class="text-sm text-text-secondary">{momentsMessage}</p>
        {/if}

        {#if chosenMoment && !creatingNewMoment}
          <p class="text-sm text-text-secondary">
            Anchor {anchorClock || formatAnchorClock(chosenMoment.momentTimeSeconds)} in the original video.
          </p>
        {/if}
      </fieldset>

      {#if creatingNewMoment && !loadingMoments}
        <div class="space-y-2">
          <label for="moment-title" class="text-sm font-medium text-text-primary">Moment title</label>
          <input
            id="moment-title"
            bind:value={title}
            on:input={clearError}
            type="text"
            maxlength="120"
            class={fieldClass}
            placeholder="e.g. Will Ramos snorting scream"
            required
          />
        </div>

        <div class="space-y-2">
          <label for="moment-time" class="text-sm font-medium text-text-primary">Anchor time in the original video (seconds)</label>
          <input
            id="moment-time"
            bind:value={anchorInput}
            on:input={clearError}
            type="number"
            min="0"
            step="0.1"
            class={fieldClass}
            required
          />
        </div>

        <div class="space-y-2">
          <label for="moment-tags" class="text-sm font-medium text-text-primary">Tags (optional)</label>
          <input
            id="moment-tags"
            bind:value={tagsInput}
            type="text"
            class={fieldClass}
            placeholder="breakdown, live, metal"
          />
        </div>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label for="slice-start" class="text-sm font-medium text-text-primary">Reaction start (seconds)</label>
          <input
            id="slice-start"
            bind:value={sliceStart}
            on:input={clearError}
            type="number"
            min="0"
            step="0.1"
            class={fieldClass}
            required
          />
        </div>
        <div class="space-y-2">
          <label for="slice-end" class="text-sm font-medium text-text-primary">Reaction end (seconds)</label>
          <input
            id="slice-end"
            bind:value={sliceEnd}
            on:input={clearError}
            type="number"
            min="0"
            step="0.1"
            class={fieldClass}
            required
          />
        </div>
      </div>
      <p class="text-sm text-text-muted">The published moment reaction plays this part of the reaction. It has to be 60 seconds or shorter and reach the anchor.</p>

      {#if sliceCheck?.ok}
        <p class="text-sm text-text-secondary">
          This slice is {sliceCheck.subsectionDurationSeconds.toFixed(1)}s and reaches the anchor{anchorClock ? ` at ${anchorClock}` : ''}.
        </p>
      {:else if sliceCheck?.errors?.length}
        <p class="text-sm text-warning" role="alert">{sliceCheck.errors[0]}</p>
      {:else if !bounds.ok && (sliceStart !== '' || sliceEnd !== '')}
        <p class="text-sm text-warning" role="alert">{bounds.error}</p>
      {/if}
    {/if}

    {#if errorMessage}
      <p class="text-sm text-warning" role="alert">{errorMessage}</p>
    {/if}

    <CinematicButton type="submit" variant="primary" disabled={isSubmitting || !reaction || !sliceCheck?.ok}>
      {isSubmitting ? 'Publishing…' : 'Publish moment reaction'}
    </CinematicButton>
  </form>
</div>

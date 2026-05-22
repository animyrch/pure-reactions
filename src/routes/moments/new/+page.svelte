<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeftOutline } from 'flowbite-svelte-icons';
  import SEO from '$lib/components/SEO.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import { auth } from '$lib/constants/firebase';
  import { handlePrivateRoute } from '$lib/helpers/routing';
  import { fetchOriginalVideoMetadata, originalVideoMetadataToFirestoreFields } from '$lib/helpers/originalVideo';
  import { parseReactionSourceInput } from '$lib/helpers/reactionSequence';
  import { createMomentWithSlug, buildMomentPagePath } from '$lib/helpers/momentsFirestore';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';

  let originalVideoInput = '';
  let title = '';
  let momentTimeSeconds = '0';
  let tagsInput = '';
  let isSubmitting = false;
  let errorMessage = '';
  let previewTitle = '';
  let previewAuthor = '';

  const clearError = () => {
    if (errorMessage) errorMessage = '';
  };

  const readSource = () => {
    const parsed = parseReactionSourceInput(originalVideoInput);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    if (parsed.sourceItem?.type === 'youtube-playlist') {
      return { ok: false, error: 'Use a single video link for a moment, not a playlist.' };
    }
    return { ok: true, source: parsed.sourceItem };
  };

  const previewOriginal = async () => {
    clearError();
    const parsed = readSource();
    if (!parsed.ok) {
      errorMessage = parsed.error;
      return;
    }

    try {
      const metadata = await fetchOriginalVideoMetadata({
        platform: parsed.source.originalVideoPlatform,
        videoId: parsed.source.originalVideoId,
        videoUrl: parsed.source.originalVideoUrl
      });
      previewTitle = metadata.title || '';
      previewAuthor = metadata.author || '';
    } catch (error) {
      console.error('Failed to preview original metadata', error);
      errorMessage = 'Could not load that video. Check the URL and try again.';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();

    const user = auth?.currentUser;
    if (!user?.uid) {
      handlePrivateRoute();
      return;
    }

    const parsed = readSource();
    if (!parsed.ok) {
      errorMessage = parsed.error;
      return;
    }
    const source = parsed.source;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errorMessage = 'Give this moment a short, memorable title.';
      return;
    }

    const anchorSeconds = Number(momentTimeSeconds);
    if (!Number.isFinite(anchorSeconds) || anchorSeconds < 0) {
      errorMessage = 'Enter the moment timing in seconds (0 or greater).';
      return;
    }

    isSubmitting = true;
    try {
      const metadata = await fetchOriginalVideoMetadata({
        platform: source.originalVideoPlatform,
        videoId: source.originalVideoId,
        videoUrl: source.originalVideoUrl
      });
      const firestoreFields = originalVideoMetadataToFirestoreFields(metadata);
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const { momentId } = await createMomentWithSlug({
        title: trimmedTitle,
        originalVideoId: source.originalVideoId,
        originalVideoPlatform: source.originalVideoPlatform,
        originalVideoUrl: source.originalVideoUrl,
        momentTimeSeconds: anchorSeconds,
        tags,
        creatorId: user.uid,
        creatorDisplayName: user.displayName || '',
        ...firestoreFields
      });

      showToast('Moment created.', TOASTS.SUCCESS);
      await goto(buildMomentPagePath(momentId));
    } catch (error) {
      console.error('Failed to create moment', error);
      errorMessage = error?.message || 'Something went wrong while creating the moment.';
    } finally {
      isSubmitting = false;
    }
  };

  onMount(() => {
    if (!auth?.currentUser) {
      handlePrivateRoute();
    }
  });
</script>

<SEO
  title="Create a Moment"
  description="Mark an emotional beat in original content and invite synchronized reactions."
  canonical="/moments/new"
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

  <h1 class="mt-6 text-3xl font-semibold text-text-primary">Create a moment</h1>
  <p class="mt-2 text-base text-text-secondary">
    A moment is a shared timestamp in original content—not a clip. Others can attach short synchronized reactions to it.
  </p>

  <form class="mt-8 space-y-6" on:submit={handleSubmit}>
    <div class="space-y-2">
      <label for="original-video" class="text-sm font-medium text-text-primary">Original video URL</label>
      <input
        id="original-video"
        bind:value={originalVideoInput}
        on:input={clearError}
        on:blur={previewOriginal}
        type="url"
        class="w-full rounded-2xl border border-border-strong/50 bg-surface/80 px-4 py-3 text-text-primary"
        placeholder="YouTube or TikTok link"
        required
      />
      {#if previewTitle}
        <p class="text-sm text-text-secondary">Loaded: {previewTitle}{previewAuthor ? ` · ${previewAuthor}` : ''}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="moment-title" class="text-sm font-medium text-text-primary">Moment title</label>
      <input
        id="moment-title"
        bind:value={title}
        on:input={clearError}
        type="text"
        maxlength="120"
        class="w-full rounded-2xl border border-border-strong/50 bg-surface/80 px-4 py-3 text-text-primary"
        placeholder="e.g. Will Ramos snorting scream"
        required
      />
    </div>

    <div class="space-y-2">
      <label for="moment-time" class="text-sm font-medium text-text-primary">Moment time in original (seconds)</label>
      <input
        id="moment-time"
        bind:value={momentTimeSeconds}
        on:input={clearError}
        type="number"
        min="0"
        step="0.1"
        class="w-full rounded-2xl border border-border-strong/50 bg-surface/80 px-4 py-3 text-text-primary"
        required
      />
      <p class="text-sm text-text-muted">The exact second in the original video this moment refers to.</p>
    </div>

    <div class="space-y-2">
      <label for="moment-tags" class="text-sm font-medium text-text-primary">Tags (optional)</label>
      <input
        id="moment-tags"
        bind:value={tagsInput}
        type="text"
        class="w-full rounded-2xl border border-border-strong/50 bg-surface/80 px-4 py-3 text-text-primary"
        placeholder="breakdown, live, metal"
      />
    </div>

    {#if errorMessage}
      <p class="text-sm text-warning" role="alert">{errorMessage}</p>
    {/if}

    <CinematicButton type="submit" variant="primary" disabled={isSubmitting}>
      {isSubmitting ? 'Creating…' : 'Create moment'}
    </CinematicButton>
  </form>
</div>

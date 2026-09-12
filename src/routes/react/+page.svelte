<script>
    import { GradientButton } from 'flowbite-svelte';
    import { ArrowLeftOutline } from 'flowbite-svelte-icons';
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { createPlaylistDocument, auth } from '$lib/helpers/firebase';
    import { fetchOriginalVideoMetadata } from '$lib/helpers/originalVideo';
    import { goToRoute, handlePrivateRoute } from '$lib/helpers/routing';
    import { fetchAllPlaylistVideos, fetchPlaylistPreviewMetadata } from '$lib/helpers/youtube';
    import {
        REACTION_SOURCE_TYPES,
        buildSequenceItemsFromSources,
        parseReactionSourceInput,
        shouldCreatePlaylistDocumentForSequence,
    } from '$lib/helpers/reactionSequence';
    import WalkalongClue from '$lib/components/design-system/WalkalongClue.svelte';
    import { userExtraDataStore } from '$lib/stores/userExtraData';

    const steps = [
        {
            id: 'original-video',
            title: 'Original video',
            prompt: 'What are you reacting to?',
            helper: 'Paste a YouTube or TikTok URL. We will load it instantly and record your controls.',
        }
    ];

    const createReactForm = {
        currentStep: 1,
        originalVideoId: '',
        errors: {
            originalVideoId: ''
        }
    };

    let activeStep = steps[0];
    let originalVideoInput;
    let isSubmitting = false;
    let isSequenceModeVisible = false;
    let sourceItems = [];
    let nextSourceItemClientId = 1;

    $: activeStep = steps[createReactForm.currentStep - 1] ?? steps[0];

    const clearOriginalVideoError = () => {
        if (createReactForm.errors.originalVideoId) {
            createReactForm.errors.originalVideoId = '';
        }
    };

    const getSourceItemTypeLabel = (sourceItem) => {
        if (sourceItem?.type === REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST) {
            return 'YouTube playlist';
        }
        if (sourceItem?.type === REACTION_SOURCE_TYPES.TIKTOK_VIDEO) {
            return 'TikTok video';
        }
        return 'YouTube video';
    };

    const getSourceItemSummary = (sourceItem) => {
        if (sourceItem?.type === REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST) {
            return sourceItem.playlistTitle || sourceItem.title || sourceItem.youtubePlaylistId;
        }
        return sourceItem.title || sourceItem.originalVideoId;
    };

    const updateSourceItem = (clientId, updates) => {
        sourceItems = sourceItems.map((sourceItem) =>
            sourceItem.clientId === clientId ? { ...sourceItem, ...updates } : sourceItem,
        );
    };

    const enrichSourceItemMetadata = async (sourceItem) => {
        if (!sourceItem?.clientId) {
            return;
        }

        try {
            if (sourceItem.type === REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST) {
                const preview = await fetchPlaylistPreviewMetadata(sourceItem.youtubePlaylistId);
                const firstEntry = preview.items?.[0];
                updateSourceItem(sourceItem.clientId, {
                    isResolvingMetadata: false,
                    playlistTitle: preview.playlistTitle,
                    title: firstEntry?.title ?? firstEntry?.snippet?.title ?? sourceItem.title,
                    channelTitle:
                        firstEntry?.channelTitle ??
                        firstEntry?.snippet?.channelTitle ??
                        sourceItem.channelTitle,
                    thumbnailUrl:
                        firstEntry?.thumbnailUrl ??
                        firstEntry?.snippet?.thumbnails?.maxres?.url ??
                        firstEntry?.snippet?.thumbnails?.standard?.url ??
                        firstEntry?.snippet?.thumbnails?.high?.url ??
                        firstEntry?.snippet?.thumbnails?.medium?.url ??
                        firstEntry?.snippet?.thumbnails?.default?.url ??
                        sourceItem.thumbnailUrl,
                });
                return;
            }

            if (!sourceItem.originalVideoId) {
                updateSourceItem(sourceItem.clientId, {
                    isResolvingMetadata: false,
                });
                return;
            }

            const metadata = await fetchOriginalVideoMetadata({
                platform: sourceItem.originalVideoPlatform,
                videoId: sourceItem.originalVideoId,
                videoUrl: sourceItem.originalVideoUrl || sourceItem.rawValue,
            });

            updateSourceItem(sourceItem.clientId, {
                isResolvingMetadata: false,
                title: metadata.title || sourceItem.title,
                channelTitle: metadata.author || sourceItem.channelTitle,
                thumbnailUrl: metadata.thumbnailUrl || sourceItem.thumbnailUrl,
            });
        } catch (error) {
            console.warn('Failed to enrich source item metadata', error);
            updateSourceItem(sourceItem.clientId, {
                isResolvingMetadata: false,
            });
        }
    };

    $: if (sourceItems.length > 0) {
        isSequenceModeVisible = true;
    }

    const handleBackNavigation = () => {
        if (createReactForm.currentStep > 1) {
            createReactForm.currentStep = Math.max(1, createReactForm.currentStep - 1);
            return;
        }

        goToRoute('/');
    };

    const buildBackendRoute = ({ playlistDocumentId, sequenceIndex, sequenceItem }) => {
        const params = new URLSearchParams();
        params.set('id', sequenceItem.originalVideoId);
        params.set('platform', sequenceItem.originalVideoPlatform);
        if (playlistDocumentId) {
            params.set('playlistDocumentId', playlistDocumentId);
            params.set('sequenceIndex', String(sequenceIndex));
        }
        if (sequenceItem.originalVideoUrl) {
            params.set('originalUrl', sequenceItem.originalVideoUrl);
        }
        return `/backend?${params.toString()}`;
    };

    const resetInput = () => {
        createReactForm.originalVideoId = '';
    };

    const addSourceItem = () => {
        const parsed = parseReactionSourceInput(createReactForm.originalVideoId);
        if (!parsed.ok) {
            createReactForm.errors.originalVideoId = parsed.error;
            return false;
        }

        const nextSourceItem = {
            ...parsed.sourceItem,
            clientId: nextSourceItemClientId,
            isResolvingMetadata: true,
        };
        nextSourceItemClientId += 1;

        isSequenceModeVisible = true;
        sourceItems = [...sourceItems, nextSourceItem];
        createReactForm.errors.originalVideoId = '';
        resetInput();
        originalVideoInput?.focus();
        void enrichSourceItemMetadata(nextSourceItem);
        return true;
    };

    const removeSourceItem = (indexToRemove) => {
        sourceItems = sourceItems.filter((_, index) => index !== indexToRemove);
    };

    const moveSourceItem = (indexToMove, direction) => {
        const targetIndex = indexToMove + direction;
        if (targetIndex < 0 || targetIndex >= sourceItems.length) {
            return;
        }

        const nextItems = [...sourceItems];
        const [movedItem] = nextItems.splice(indexToMove, 1);
        nextItems.splice(targetIndex, 0, movedItem);
        sourceItems = nextItems;
    };

    const onConfirmStep1 = async () => {
        if (isSubmitting) {
            return;
        }

        if (createReactForm.originalVideoId?.trim()) {
            const added = addSourceItem();
            if (!added) {
                return;
            }
        }

        if (!sourceItems.length) {
            createReactForm.errors.originalVideoId = 'Add at least one YouTube playlist, YouTube video, or TikTok video before continuing.';
            return;
        }

        isSubmitting = true;
        createReactForm.errors.originalVideoId = '';

        try {
            const sequenceItems = await buildSequenceItemsFromSources(sourceItems, {
                resolveYouTubePlaylist: fetchAllPlaylistVideos,
            });

            if (!sequenceItems.length) {
                throw new Error('No playable videos were found in the entered sources.');
            }

            const firstSequenceItem = sequenceItems[0];
            const shouldCreatePlaylistDocument = shouldCreatePlaylistDocumentForSequence({
                sourceItems,
                sequenceItems,
            });

            let playlistDocumentId = '';
            if (shouldCreatePlaylistDocument) {
                playlistDocumentId = await createPlaylistDocument({
                    userId: auth.currentUser?.uid,
                    sequenceItems,
                });
            }

            await goToRoute(
                buildBackendRoute({
                    playlistDocumentId,
                    sequenceIndex: 0,
                    sequenceItem: firstSequenceItem,
                })
            );
        } catch (error) {
            console.error('Failed to build reaction sequence:', error);
            isSubmitting = false;
            createReactForm.errors.originalVideoId = error?.message || 'Something went wrong while building the sequence. Please try again.';
        }
    };

    let seenClues = null;
    let reactUserId = '';

    const loadSeenClues = () => {
        const storeData = $userExtraDataStore.userExtraData;
        return storeData?.seenWalkalongClues ?? (() => {
            try { return JSON.parse(localStorage.getItem('seenWalkalongClues') || '[]'); } catch { return []; }
        })();
    };

    $: {
        const storeSeenClues = $userExtraDataStore.userExtraData?.seenWalkalongClues;
        if (Array.isArray(storeSeenClues)) {
            seenClues = storeSeenClues;
        }
    }

    const handleClueDismiss = ({ detail }) => {
        userExtraDataStore.markClueSeen($userExtraDataStore.userExtraData, detail.userId, detail.clueId);
        const nextSeenClues = Array.isArray(seenClues) ? seenClues : [];
        if (!nextSeenClues.includes(detail.clueId)) {
            seenClues = [...nextSeenClues, detail.clueId];
        }
    };

    onMount(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            handlePrivateRoute();
            return;
        }

        reactUserId = currentUser.uid;
        // Load seen clues from store (already populated by layout) or from localStorage
        seenClues = loadSeenClues();

        originalVideoInput?.focus();
    });
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-14 sm:py-20">
        <div class="flex items-center justify-between gap-6">
            <button
                type="button"
                class="group inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                on:click={handleBackNavigation}
            >
                <ArrowLeftOutline class="h-4 w-4 transition group-hover:text-white" />
                <span>Back</span>
            </button>

            <div class="flex items-center gap-2" role="status" aria-label="Setup progress">
                {#each steps as step, index (step.id)}
                    <span
                        class={`h-2.5 rounded-full transition-all duration-300 ${
                            index + 1 === createReactForm.currentStep
                                ? 'w-8 bg-blue-400'
                                : index + 1 < createReactForm.currentStep
                                ? 'w-5 bg-emerald-400'
                                : 'w-2 bg-slate-700'
                        }`}
                        aria-hidden="true"
                    />
                {/each}
                <span class="sr-only">
                    Step {createReactForm.currentStep} of {steps.length}
                </span>
            </div>
        </div>

        <div class="mt-12 flex flex-1 items-center">
            {#if activeStep}
                <div
                    class="w-full rounded-3xl border border-slate-900/60 bg-slate-900/50 p-8 shadow-[0_35px_80px_-60px_rgba(15,23,42,1)]"
                    transition:fade={{ duration: 200 }}
                >
                    <form class="space-y-8" on:submit|preventDefault={onConfirmStep1} aria-describedby={`${activeStep.id}-helper`} aria-busy={isSubmitting}>
                        <div class="space-y-3">
                            <p class="text-xs uppercase tracking-[0.35em] text-slate-500">{activeStep.title}</p>
                            <h1 class="text-3xl font-semibold text-white">{activeStep.prompt}</h1>
                            <p id={`${activeStep.id}-helper`} class="text-sm text-slate-400">
                                {activeStep.helper}
                            </p>
                        </div>

                        <div class="space-y-2">
                            <label class="text-sm font-medium text-slate-200" for="original-video-id">
                                Original video URL
                            </label>
                            <input
                                id="original-video-id"
                                name="original-video-id"
                                type="text"
                                bind:this={originalVideoInput}
                                bind:value={createReactForm.originalVideoId}
                                on:input={clearOriginalVideoError}
                                placeholder="https://youtube.com/watch?v=… or https://www.tiktok.com/@user/video/…"
                                class={`w-full rounded-2xl border bg-slate-950/60 px-5 py-4 text-base text-slate-100 shadow-[0_20px_60px_-45px_rgba(15,23,42,1)] focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                                    createReactForm.errors.originalVideoId ? 'border-rose-500/80' : 'border-slate-800/80'
                                }`}
                                autocomplete="off"
                                inputmode="url"
                            />
                            {#if createReactForm.errors.originalVideoId}
                                <p class="text-sm text-rose-400" role="alert">
                                    {createReactForm.errors.originalVideoId}
                                </p>
                            {/if}
                        </div>

                        <WalkalongClue
                            clueId="react.paste-original"
                            message="Paste the YouTube video you want to react to. One video is enough for a first reaction."
                            helpHref="/insights/create-your-first-reaction"
                            {seenClues}
                            userId={reactUserId}
                            on:dismiss={handleClueDismiss}
                        />

                        {#if isSequenceModeVisible}
                            <WalkalongClue
                                clueId="react.skip-sequence"
                                message="Sequence tools are for reacting to several originals in one sitting. Skip them for a test reaction."
                                helpHref="/insights/create-your-first-reaction"
                                {seenClues}
                                userId={reactUserId}
                                on:dismiss={handleClueDismiss}
                            />
                            <div class="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/30 p-4">
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between gap-4">
                                        <p class="text-sm font-medium text-slate-200">Sequence tools</p>
                                        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{sourceItems.length} saved item{sourceItems.length === 1 ? '' : 's'}</p>
                                    </div>
                                    <p class="text-sm text-slate-400">
                                        Use this only when the reaction should move through several originals.
                                    </p>
                                </div>

                                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        class="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                        on:click={addSourceItem}
                                    >
                                        Add current link to sequence
                                    </button>
                                    <p class="text-xs text-slate-500">
                                    </p>
                                </div>

                                {#if sourceItems.length}
                                    <div class="space-y-3">
                                        {#each sourceItems as sourceItem, index (sourceItem.clientId)}
                                            <div class="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div class="space-y-1">
                                                        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{getSourceItemTypeLabel(sourceItem)}</p>
                                                        <p class="text-sm text-slate-100">{getSourceItemSummary(sourceItem)}</p>
                                                        <p class="break-all text-xs text-slate-500">{sourceItem.rawValue}</p>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            class="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                            on:click={() => moveSourceItem(index, -1)}
                                                            disabled={index === 0}
                                                        >
                                                            Move up
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                            on:click={() => moveSourceItem(index, 1)}
                                                            disabled={index === sourceItems.length - 1}
                                                        >
                                                            Move down
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="rounded-xl border border-rose-500/50 px-3 py-2 text-xs font-medium text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                                                            on:click={() => removeSourceItem(index)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                class="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                on:click={handleBackNavigation}
                            >
                                <ArrowLeftOutline class="h-4 w-4" />
                                <span>Back</span>
                            </button>

                            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    class="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                    on:click={() => {
                                        isSequenceModeVisible = !isSequenceModeVisible;
                                    }}
                                >
                                    {isSequenceModeVisible ? 'Hide sequence tools' : 'Show sequence tools'}
                                </button>

                                <GradientButton
                                    type="submit"
                                    color="pinkToOrange"
                                    class={`w-full sm:w-auto sm:px-8 sm:py-3 ${isSubmitting ? 'pointer-events-none opacity-80' : ''}`}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Loading…' : 'Continue'}
                                </GradientButton>
                            </div>
                        </div>
                    </form>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
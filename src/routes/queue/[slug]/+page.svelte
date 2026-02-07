<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import QueueBinomeCard from '$lib/components/QueueBinomeCard.svelte';
    import { getReactionsByIds, getPlaylist, getQueueBySlug, updateQueueDocument } from '$lib/helpers/firebase';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { readQueueProgress } from '$lib/helpers/queueProgress';

    export let data;

    const { slug } = data ?? {};
    let queueDefinition = null;
    let resolvedItems = [];
    let isLoading = true;
    let statusMessage = '';
    let ownerId = '';
    let ownerName = '';
    let isOwner = false;
    let isPublished = false;
    let updatingPublishState = false;

    let queueEntries = [];
    let queueIsLoading = false;
    let queueStatusMessage = '';

    let canResume = false;
    let resumeIndex = 0;
    let resumeReactionId = '';

    $: queueTitle = queueDefinition?.data?.title || 'Untitled queue';
    $: totalBinomes = queueDefinition?.data?.items?.length ?? 0;
    $: currentSetIndexParam = Number($page.url?.searchParams?.get('queueIndex') ?? 0);
    $: currentSetIndex = Number.isFinite(currentSetIndexParam) ? currentSetIndexParam : 0;
    $: currentSetReactionId = $page.url?.searchParams?.get('queueReactionId') || '';

    const asArray = (value) => (Array.isArray(value) ? value : []);

    const buildQueueWatchUrl = (reactionId, index, { autoplay = true, fullscreen = false } = {}) => {
        const params = new URLSearchParams();
        params.set('queueSlug', slug);
        params.set('queueIndex', String(index));
        params.set('queueReactionId', reactionId);
        if (autoplay) params.set('queueAutoPlay', 'true');
        if (fullscreen) params.set('isFullscreen', 'true');
        return `/reaction/${reactionId}?${params.toString()}`;
    };

    const handlePlayFromStart = async () => {
        if (!queueEntries?.length) return;
        await goto(buildQueueWatchUrl(queueEntries[0].reactionId, 0, { autoplay: true, fullscreen: false }));
    };

    const handleResume = async () => {
        if (!queueEntries?.length) return;

        const idx = canResume
            ? resumeIndex
            : Math.min(Math.max(currentSetIndex, 0), queueEntries.length - 1);
        const target = queueEntries[idx];
        if (!target?.reactionId) return;
        await goto(buildQueueWatchUrl(target.reactionId, idx, { autoplay: true, fullscreen: false }));
    };

    const handleTogglePublish = async () => {
        if (!queueDefinition?.id || updatingPublishState) return;
        updatingPublishState = true;
        const newState = !isPublished;
        const userId = $page.data?.userId;
        
        try {
            await updateQueueDocument({
                slug: queueDefinition.id,
                isPublished: newState,
                userId
            });
            isPublished = newState;
            if (queueDefinition?.data) queueDefinition.data.isPublished = newState;
        } catch (error) {
            console.error('Failed to update public status', error);
            // Revert is not needed because we only update local state on success 
            // but we bind strictly via a change handler in UI for safety
        } finally {
            updatingPublishState = false;
        }
    };

    const hydrateQueueItems = async () => {
        const authedUserId = $page?.data?.userId;
        if (!authedUserId) {
            handlePrivateRoute();
            statusMessage = 'Sign in to access your queues.';
            isLoading = false;
            return;
        }

        queueDefinition = await getQueueBySlug(slug, authedUserId);

        if (!queueDefinition) {
            statusMessage = 'Queue not found.';
            isLoading = false;
            return;
        }

        ownerId = queueDefinition?.data?.ownerId || '';
        isOwner = Boolean(ownerId && ownerId === authedUserId);
        isPublished = queueDefinition?.data?.isPublished ?? false;
        ownerName = (isOwner ? ($page.data?.displayName || '') : (queueDefinition?.data?.ownerName || '')).trim();

        const reactionIds = queueDefinition.data?.items
            ?.filter((item) => item?.type === 'reaction' && item?.id)
            .map((item) => item.id) ?? [];
        const playlistIds = queueDefinition.data?.items
            ?.filter((item) => item?.type === 'playlist' && item?.id)
            .map((item) => item.id) ?? [];

        const [reactionResults, playlistPayloads] = await Promise.all([
            reactionIds.length ? getReactionsByIds(reactionIds) : [],
            Promise.all(
                playlistIds.map(async (playlistId) => ({
                    id: playlistId,
                    data: await getPlaylist(playlistId)
                }))
            )
        ]);

        const reactions = asArray(reactionResults);
        const reactionMap = new Map(reactions.filter((entry) => entry?.id).map((entry) => [entry.id, entry]));

        const firstReactionIds = playlistPayloads
            .map((playlist) => playlist?.data?.reactionBinomeIds?.[0])
            .filter(Boolean);

        const firstReactionResults = firstReactionIds.length ? await getReactionsByIds(firstReactionIds) : [];
        const firstReactions = asArray(firstReactionResults);
        const firstReactionMap = new Map(firstReactions.filter((entry) => entry?.id).map((entry) => [entry.id, entry]));

        const playlists = playlistPayloads.map((playlist) => {
            const firstReactionId = playlist?.data?.reactionBinomeIds?.[0];
            return {
                ...playlist,
                firstReaction: firstReactionId ? firstReactionMap.get(firstReactionId) : null
            };
        });
        const playlistMap = new Map(playlists.map((entry) => [entry.id, entry]));

        resolvedItems = (queueDefinition.data?.items ?? []).map((item, index) => {
            if (item.type === 'reaction') {
                return { ...item, reaction: reactionMap.get(item.id), key: `${item.id}-${index}` };
            }
            if (item.type === 'playlist') {
                return { ...item, playlist: playlistMap.get(item.id), key: `${item.id}-${index}` };
            }
            return { ...item, key: `${item.type ?? 'unknown'}-${index}` };
        });

        // Build a flattened queue of reactions for sequential watching.
        // Rules:
        // - reaction items: add their id
        // - playlist items: add all reaction ids in order
        // The queue is independent from the grid presentation.
        queueIsLoading = true;
        queueStatusMessage = '';
        try {
            const nextEntries = [];
            for (const item of (queueDefinition.data?.items ?? [])) {
                if (item?.type === 'reaction' && item?.id) {
                    nextEntries.push({ sourceType: 'reaction', sourceId: item.id, reactionId: item.id, label: item?.label || '' });
                    continue;
                }
                if (item?.type === 'playlist' && item?.id) {
                    const playlistDoc = playlistMap.get(item.id)?.data;
                    const ids = Array.isArray(playlistDoc?.reactionBinomeIds) ? playlistDoc.reactionBinomeIds.filter(Boolean) : [];
                    ids.forEach((reactionId, playlistIndex) => {
                        nextEntries.push({
                            sourceType: 'playlist',
                            sourceId: item.id,
                            playlistIndex,
                            reactionId,
                            label: item?.label || ''
                        });
                    });
                }
            }

            // Hydrate queue entries with reaction metadata for the “Up next” rail
            const uniqueIds = [...new Set(nextEntries.map((entry) => entry.reactionId).filter(Boolean))];
            const hydrated = uniqueIds.length ? await getReactionsByIds(uniqueIds) : [];
            const hydratedMap = new Map(asArray(hydrated).filter((entry) => entry?.id).map((entry) => [entry.id, entry]));

            queueEntries = nextEntries.map((entry, index) => ({
                ...entry,
                index,
                reaction: hydratedMap.get(entry.reactionId) || null
            }));

            // Resolve Resume target from localStorage (prefer reactionId match; fallback to saved index).
            try {
                const saved = readQueueProgress(authedUserId, slug);
                if (saved && queueEntries.length) {
                    const matchIndex = queueEntries.findIndex((entry) => entry?.reactionId === saved.reactionId);
                    const resolvedIndex = matchIndex >= 0
                        ? matchIndex
                        : Math.min(Math.max(Number(saved.index) || 0, 0), queueEntries.length - 1);

                    const resolved = queueEntries[resolvedIndex];
                    if (resolved?.reactionId) {
                        canResume = true;
                        resumeIndex = resolvedIndex;
                        resumeReactionId = resolved.reactionId;
                    } else {
                        canResume = false;
                        resumeIndex = 0;
                        resumeReactionId = '';
                    }
                } else {
                    canResume = false;
                    resumeIndex = 0;
                    resumeReactionId = '';
                }
            } catch (error) {
                console.warn('Failed to read queue resume progress', error);
                canResume = false;
                resumeIndex = 0;
                resumeReactionId = '';
            }

            if (!queueEntries.length) {
                queueStatusMessage = 'Nothing to play yet. Add at least one reaction or playlist item.';
            }
        } catch (error) {
            console.error('Failed to build queue entries', error);
            queueStatusMessage = 'Could not prepare the watch queue.';
            queueEntries = [];
        } finally {
            queueIsLoading = false;
        }

        if (!resolvedItems.length) {
            statusMessage = 'This queue does not contain any binomes yet.';
        } else {
            statusMessage = '';
        }

        isLoading = false;
    };

    onMount(hydrateQueueItems);
</script>

<svelte:head>
    <title>{queueDefinition?.data?.title ? `${queueDefinition.data.title} • Pure Reactions` : 'Queue • Pure Reactions'}</title>
</svelte:head>

<main class="set-page bg-background text-text-primary">
    <div class="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div class="mb-8 space-y-3">
            <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Queue</p>
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div class="space-y-2">
                    <h1 class="text-3xl font-semibold md:text-4xl">{queueTitle}</h1>
                    {#if queueDefinition?.data?.description}
                        <p class="max-w-3xl text-sm text-text-muted">{queueDefinition.data.description}</p>
                    {/if}
                </div>
                <div class="flex items-center gap-3 text-sm text-text-muted">
                    <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                        {queueEntries.length} reaction{queueEntries.length === 1 ? '' : 's'} in queue
                    </span>
                    {#if isOwner}
                         <button 
                            type="button"
                            role="switch"
                            aria-checked={isPublished}
                            on:click={handleTogglePublish}
                            disabled={updatingPublishState}
                            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur transition-colors hover:bg-white/10 disabled:opacity-50"
                        >
                            <span class={`h-2 w-2 rounded-full ${isPublished ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-white/20'}`}></span>
                            <span>{isPublished ? 'Public' : 'Private'}</span>
                        </button>
                    {/if}
                    {#if ownerId}
                        <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                            {#if isOwner}
                                Your queue
                            {:else}
                                Owner: {ownerName || 'Unknown user'}
                            {/if}
                        </span>
                    {/if}
                </div>
            </div>

            {#if !isLoading && queueDefinition}
                <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="text-sm text-text-muted">
                        {#if queueIsLoading}
                            Preparing watch queue
                        {:else if queueStatusMessage}
                            {queueStatusMessage}
                        {/if}
                    </div>
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center" aria-label="Queue playback controls">
                        <button
                            class="btn-primary"
                            type="button"
                            on:click={handlePlayFromStart}
                            disabled={queueIsLoading || !queueEntries.length}
                            aria-label="Play this queue from the beginning"
                        >
                            Play queue
                        </button>
                        <button
                            class="btn-secondary"
                            type="button"
                            on:click={handleResume}
                            disabled={queueIsLoading || !queueEntries.length || !canResume}
                            aria-label={canResume
                                ? `Resume this queue from item ${resumeIndex + 1}`
                                : 'Resume is available after you start watching this queue'}
                        >
                            Resume{#if canResume} • #{resumeIndex + 1}{/if}
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        {#if isLoading}
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {#each Array(6) as _, _index}
                    <div class="animate-pulse rounded-xl border border-white/5 bg-white/5 p-6">
                        <div class="mb-4 h-3 w-20 rounded-full bg-white/10" aria-hidden="true" />
                        <div class="aspect-video rounded-lg bg-white/10" aria-hidden="true" />
                    </div>
                {/each}
            </div>
        {:else if !queueDefinition}
            <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">
                Queue not found in Firebase. Create a queue document whose id matches the slug and includes an items array.
            </div>
        {:else}
            {#if resolvedItems.length === 0}
                <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">{statusMessage}</div>
            {:else}
                {#if queueEntries.length > 0}
                    <section class="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-elevated">
                        <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Watch</p>
                                <h2 class="mt-1 text-lg font-semibold text-text-primary">Up next</h2>
                            </div>
                            <p class="text-xs text-text-muted">
                                {#if currentSetReactionId}
                                    Currently queued: <span class="text-text-primary">#{Math.min(currentSetIndex + 1, queueEntries.length)}</span> / {queueEntries.length}
                                {:else}
                                    Start from the top or pick any item
                                {/if}
                            </p>
                        </div>

                        <ol class="queue" aria-label="Queue watch queue">
                            {#each queueEntries as entry (entry.reactionId + '-' + entry.index)}
                                <li class="queue-li">
                                    <a
                                        class="queue-item"
                                        href={buildQueueWatchUrl(entry.reactionId, entry.index, { autoplay: true, fullscreen: false })}
                                        aria-current={entry.reactionId === currentSetReactionId ? 'true' : undefined}
                                        aria-label={`Watch ${entry.reaction?.data?.reactionVideoTitle || entry.reaction?.data?.originalVideoTitle || 'reaction'} (item ${entry.index + 1} of ${queueEntries.length})`}
                                    >
                                        <QueueBinomeCard
                                            linkless
                                            item={{
                                                type: 'reaction',
                                                id: entry.reactionId,
                                                reaction: entry.reaction
                                            }}
                                            index={entry.index}
                                        />
                                    </a>
                                </li>
                            {/each}
                        </ol>
                    </section>
                {/if}
            {/if}
        {/if}
    </div>
</main>

<style>
    .set-page {
        min-height: 100vh;
        background: radial-gradient(circle at 15% 20%, rgba(88, 112, 193, 0.08), transparent 35%),
            radial-gradient(circle at 80% 10%, rgba(117, 66, 223, 0.08), transparent 30%),
            radial-gradient(circle at 40% 70%, rgba(67, 217, 173, 0.06), transparent 32%),
            #0b1018;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1.05rem;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(88, 112, 193, 0.9), rgba(117, 66, 223, 0.85));
        color: white;
        font-weight: 600;
        box-shadow: 0 18px 40px rgba(5, 8, 12, 0.34);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
    }

    .btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1.05rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(245, 247, 250, 0.92);
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(10px);
        transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
    }

    .btn-primary:hover,
    .btn-secondary:hover {
        transform: translateY(-1px);
        box-shadow: 0 22px 48px rgba(5, 8, 12, 0.38);
    }

    .btn-primary:focus-visible,
    .btn-secondary:focus-visible {
        outline: 2px solid rgba(88, 112, 193, 0.7);
        outline-offset: 4px;
    }

    .btn-primary:disabled,
    .btn-secondary:disabled {
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

    .queue-item:hover {
        transform: translateY(-1px);
        filter: brightness(1.02);
    }

    .queue-item:focus-visible {
        outline: 2px solid rgba(67, 217, 173, 0.55);
        outline-offset: 3px;
    }

    .queue-item[aria-current='true'] {
        outline: 2px solid rgba(67, 217, 173, 0.55);
        outline-offset: 4px;
    }
</style>

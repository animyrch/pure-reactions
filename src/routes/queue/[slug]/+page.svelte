<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import SEO from '$lib/components/SEO.svelte';
    import CollectionEntrypointPanel from '$lib/components/design-system/CollectionEntrypointPanel.svelte';
    import ReactionListGrid from '$lib/components/design-system/ReactionListGrid.svelte';
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

    $: queueTitle = queueDefinition?.data?.title || 'Untitled queue';
    $: currentSetIndexParam = Number($page.url?.searchParams?.get('queueIndex') ?? 0);
    $: currentSetIndex = Number.isFinite(currentSetIndexParam) ? currentSetIndexParam : 0;

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
                    } else {
                        canResume = false;
                        resumeIndex = 0;
                    }
                } else {
                    canResume = false;
                    resumeIndex = 0;
                }
            } catch (error) {
                console.warn('Failed to read queue resume progress', error);
                canResume = false;
                resumeIndex = 0;
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

    const getPlaylistItemVideoId = (entry) => entry?.reactionId || '';

    const getPlaylistItemTitle = (entry) =>
        entry?.reaction?.data?.reactionVideoTitle || entry?.reaction?.data?.originalVideoTitle || 'Untitled';

    const getPlaylistItemChannel = (entry) => entry?.reaction?.data?.reactionVideoAuthor || '';

    const handleOpenPlaylistItem = async (index) => {
        const target = queueEntries[index];
        if (!target?.reactionId) return;
        await goto(buildQueueWatchUrl(target.reactionId, index, { autoplay: true, fullscreen: false }));
    };

    onMount(hydrateQueueItems);
</script>

<SEO
    title={queueDefinition?.data?.title ? `${queueDefinition.data.title} Queue` : 'Queue'}
    description={queueDefinition?.data?.description || 'Watch this curated queue of synchronized reaction videos on Pure Reactions.'}
    canonical="/queue/{slug}"
    keywords="reaction queue, pure reactions queue, synchronized reactions playlist"
/>

<main class="min-h-screen bg-background text-text-primary">
    <div class="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div class="mb-8">
            {#if isLoading}
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {#each Array(6) as _, _index}
                        <div class="animate-pulse rounded-xl border border-white/5 bg-white/5 p-6">
                            <div class="mb-4 h-3 w-20 rounded-full bg-white/10" aria-hidden="true"></div>
                            <div class="aspect-video rounded-lg bg-white/10" aria-hidden="true"></div>
                        </div>
                    {/each}
                </div>
            {:else if !queueDefinition}
                <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">
                    Queue not found in Firebase. Create a queue document whose id matches the slug and includes an items array.
                </div>
            {:else}
                <CollectionEntrypointPanel
                    collectionType="queue"
                    title={queueTitle}
                    description={queueDefinition?.data?.description || ''}
                    itemCount={queueEntries.length}
                    itemLabel="reaction"
                    statusMessage={queueIsLoading ? 'Preparing watch queue' : queueStatusMessage}
                    primaryAriaLabel="Play this queue from the beginning"
                    primaryDisabled={queueIsLoading || !queueEntries.length}
                    onPrimaryClick={handlePlayFromStart}
                    secondaryLabel={canResume ? `Resume • #${resumeIndex + 1}` : 'Resume'}
                    secondaryAriaLabel={canResume
                        ? `Resume this queue from item ${resumeIndex + 1}`
                        : 'Resume is available after you start watching this queue'}
                    secondaryDisabled={queueIsLoading || !queueEntries.length || !canResume}
                    onSecondaryClick={handleResume}
                >
                    <svelte:fragment slot="meta">
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
                    </svelte:fragment>

                    {#if resolvedItems.length === 0}
                        <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">{statusMessage}</div>
                    {:else}
                        <ReactionListGrid
                            items={queueEntries}
                            onPlaylistItemClick={handleOpenPlaylistItem}
                            {getPlaylistItemVideoId}
                            {getPlaylistItemTitle}
                            {getPlaylistItemChannel}
                        />
                    {/if}
                </CollectionEntrypointPanel>
            {/if}
        </div>
    </div>
</main>

<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import SetBinomeCard from '$lib/components/SetBinomeCard.svelte';
    import { getReactionsByIds, getPlaylist, getSetBySlug } from '$lib/helpers/firebase';

    export let data;

    const { slug } = data ?? {};
    let setDefinition = null;
    let resolvedItems = [];
    let isLoading = true;
    let statusMessage = '';
    let ownerId = '';
    let isOwner = false;

    const asArray = (value) => (Array.isArray(value) ? value : []);

    const hydrateSetItems = async () => {
        setDefinition = await getSetBySlug(slug);

        if (!setDefinition) {
            statusMessage = 'Set not found in Firebase. Create a document whose id equals the slug.';
            isLoading = false;
            return;
        }

        ownerId = setDefinition?.data?.ownerId || '';
        isOwner = Boolean(ownerId && ownerId === $page.data?.userId);

        const reactionIds = setDefinition.data?.items
            ?.filter((item) => item?.type === 'reaction' && item?.id)
            .map((item) => item.id) ?? [];
        const playlistIds = setDefinition.data?.items
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

        resolvedItems = (setDefinition.data?.items ?? []).map((item, index) => {
            if (item.type === 'reaction') {
                return { ...item, reaction: reactionMap.get(item.id), key: `${item.id}-${index}` };
            }
            if (item.type === 'playlist') {
                return { ...item, playlist: playlistMap.get(item.id), key: `${item.id}-${index}` };
            }
            return { ...item, key: `${item.type ?? 'unknown'}-${index}` };
        });

        if (!resolvedItems.length) {
            statusMessage = 'This set does not contain any binomes yet.';
        } else {
            statusMessage = '';
        }

        isLoading = false;
    };

    onMount(hydrateSetItems);
</script>

<svelte:head>
    <title>{setDefinition?.data?.title ? `${setDefinition.data.title} • Pure Reactions` : 'Set • Pure Reactions'}</title>
</svelte:head>

<main class="set-page bg-background text-text-primary">
    <div class="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div class="mb-8 space-y-3">
            <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Set</p>
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div class="space-y-2">
                    <h1 class="text-3xl font-semibold md:text-4xl">{setDefinition?.data?.title || 'Untitled set'}</h1>
                    {#if setDefinition?.data?.description}
                        <p class="max-w-3xl text-sm text-text-muted">{setDefinition.data.description}</p>
                    {/if}
                </div>
                <div class="flex items-center gap-3 text-sm text-text-muted">
                    <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                        {setDefinition?.data?.items?.length ?? 0} binomes
                    </span>
                    {#if ownerId}
                        <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                            {#if isOwner}
                                Your set
                            {:else}
                                Owner: {ownerId}
                            {/if}
                        </span>
                    {/if}
                </div>
            </div>
        </div>

        {#if isLoading}
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {#each Array(6) as _, index}
                    <div class="animate-pulse rounded-xl border border-white/5 bg-white/5 p-6">
                        <div class="mb-4 h-3 w-20 rounded-full bg-white/10" aria-hidden="true" />
                        <div class="aspect-video rounded-lg bg-white/10" aria-hidden="true" />
                    </div>
                {/each}
            </div>
        {:else if !setDefinition}
            <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">
                Set not found in Firebase. Create a set document whose id matches the slug and includes an items array.
            </div>
        {:else}
            {#if resolvedItems.length === 0}
                <div class="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">{statusMessage}</div>
            {:else}
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {#each resolvedItems as item, index (item.key)}
                        <SetBinomeCard {item} {index} />
                    {/each}
                </div>
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
</style>

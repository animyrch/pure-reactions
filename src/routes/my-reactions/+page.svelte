<script>
	import { afterNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { ArrowLeftOutline } from 'flowbite-svelte-icons';
	import { getUserReactions, getUserPlaylists } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import ReactionFilters from '$lib/components/Navigation/ReactionFilters.svelte';
	import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS, TYPE_FILTERS } from '$lib/constants/filters';
	import { page } from '$app/stores';

	export let data;

	const fallbackHref = '/account';
	let backHref = fallbackHref;

	let destroyed = false;
	let loadTimeout;

	onDestroy(() => {
		destroyed = true;
		clearTimeout(loadTimeout);
	});

	afterNavigate(({ from, to, type }) => {
		if (destroyed || type === 'popstate') return;

		const toPath = to?.url?.pathname || '';
		if (toPath !== '/my-reactions') return;

		const fromPath = from?.url?.pathname || '';
		if (!fromPath || fromPath === toPath) return;

		backHref = `${from.url.pathname}${from.url.search}${from.url.hash}`;
	});
    
	let combinedItems = [];
	let isLoading = false;
	
	$: publishedFilter = $page.url.searchParams.get("published") || FILTERS.ALL;
	$: typeFilter = $page.url.searchParams.get("type") || TYPE_FILTERS.ALL;

	const loadReactions = async () => {
		if (!$isLoggedIn) {
			return;
		}
        isLoading = true;
        combinedItems = [];
        clearTimeout(loadTimeout);
        loadTimeout = setTimeout(async () => {
			if (destroyed) return;
			// Load data in parallel when both are needed
			const loadReactionsPromise = (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.REACTIONS_ONLY)
				? getUserReactions(data.userId, publishedFilter)
				: Promise.resolve([]);
			
			const loadPlaylistsPromise = (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.PLAYLISTS_ONLY)
				? getUserPlaylists(data.userId, publishedFilter)
				: Promise.resolve([]);
			
			const [reactions, playlists] = await Promise.all([loadReactionsPromise, loadPlaylistsPromise]);
			
			// Transform playlists to match reaction structure
			// Filter out playlists without required data to prevent broken rendering
			const transformedPlaylists = playlists
				.filter(playlist => playlist.firstReactionBinomeData)
				.map(playlist => ({
					id: playlist.id,
					type: 'playlist',
					data: {
						playlistId: playlist.id,
						reactionVideoId: playlist.firstReactionBinomeData.reactionVideoId,
						originalVideoId: playlist.firstReactionBinomeData.originalVideoId,
						reactionVideoTitle: playlist.firstReactionBinomeData.reactionVideoTitle,
						customReactionTitle: playlist.firstReactionBinomeData.customReactionTitle,
						reactionVideoAuthor: playlist.firstReactionBinomeData.reactionVideoAuthor,
						originalVideoTitle: playlist.firstReactionBinomeData.originalVideoTitle,
					}
				}));

			// Combine reactions and playlists
			if (destroyed) return;
			combinedItems = [...reactions, ...transformedPlaylists];
			isLoading = false;
        }, 100);
    }

    $: loadReactions(), publishedFilter, typeFilter;
</script>

{#if $isLoggedIn}
	<div>
		<div class="mb-3">
			<a
				href={backHref}
				class="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<ArrowLeftOutline class="h-4 w-4" aria-hidden="true" />
				Back
			</a>
		</div>
		<ReactionFilters />
		{#if isLoading}
			<ReactionsList reactions={[]} loading={true} />
		{:else}
			<ReactionsList reactions={combinedItems}/>
		{/if}
	</div>
{:else}{handlePrivateRoute()}{/if}
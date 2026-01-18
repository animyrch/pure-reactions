<script>
	import { getUserReactions, getUserPlaylists } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import ReactionFilters from '$lib/components/Navigation/ReactionFilters.svelte';
	import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS, TYPE_FILTERS } from '$lib/constants/filters';
	import { page } from '$app/stores';

	export let data;
    
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
        setTimeout(async () => {
			let reactions = [];
			let playlists = [];

			// Load reactions if needed
			if (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.REACTIONS_ONLY) {
            	reactions = await getUserReactions(data.userId, publishedFilter);
			}

			// Load playlists if needed
			if (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.PLAYLISTS_ONLY) {
            	playlists = await getUserPlaylists(data.userId, publishedFilter);
			}
			
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
						reactionVideoAuthor: playlist.firstReactionBinomeData.reactionVideoAuthor,
						originalVideoTitle: playlist.firstReactionBinomeData.originalVideoTitle,
					}
				}));

			// Combine reactions and playlists
			combinedItems = [...reactions, ...transformedPlaylists];
			isLoading = false;
        }, 100);
    }

    $: loadReactions(), publishedFilter, typeFilter;
</script>

{#if $isLoggedIn}
	<div>
		<ReactionFilters />
		{#if isLoading}
			<ReactionsList reactions={[]} loading={true} />
		{:else}
			<ReactionsList reactions={combinedItems}/>
		{/if}
	</div>
{:else}{handlePrivateRoute()}{/if}
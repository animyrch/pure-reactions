<script>
	import { getUserReactions, getUserPlaylists } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS } from '$lib/constants/filters';

	export let data;
    
	let combinedItems = [];
	let filter = 'all';
	let isLoading = false;

	const loadReactions = async () => {
		if (!isLoggedIn) {
			return;
		}
        isLoading = true;
        combinedItems = [];
        setTimeout(async () => {
            const reactions = await getUserReactions(data.userId, filter); // Pass the filter to the getAllReactions function
            const playlists = await getUserPlaylists(data.userId);
			
			// Transform playlists to match reaction structure
			const transformedPlaylists = playlists.map(playlist => ({
				id: playlist.id,
				type: 'playlist',
				data: {
					playlistId: playlist.id,
					reactionVideoId: playlist.firstReactionBinomeData?.reactionVideoId,
					originalVideoId: playlist.firstReactionBinomeData?.originalVideoId,
					reactionVideoTitle: playlist.firstReactionBinomeData?.reactionVideoTitle,
					reactionVideoAuthor: playlist.firstReactionBinomeData?.reactionVideoAuthor,
					originalVideoTitle: playlist.firstReactionBinomeData?.originalVideoTitle,
				}
			}));

			// Combine reactions and playlists
			combinedItems = [...reactions, ...transformedPlaylists];
			isLoading = false;
        }, 100);
    }

    $: loadReactions(), filter;
</script>

{#if isLoading}
	<span>Loading...</span>
{:else}
	{#if $isLoggedIn}
		<div>
			<div class="filter-container mb-4">
				<select bind:value={filter}>
					<option value={FILTERS.ALL}>All</option>
					<option value={FILTERS.PUBLISHED}>Published</option>
					<option value={FILTERS.UNPUBLISHED}>Unpublished</option>
				</select>
			</div>
			<ReactionsList reactions={combinedItems}/>
		</div>
	{:else}{handlePrivateRoute()}{/if}
{/if}
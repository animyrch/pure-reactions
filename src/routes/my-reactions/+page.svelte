<script>
	import { getUserReactions, getUserPlaylists } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import PlaylistsList from '$lib/components/PlaylistsList.svelte';
	import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS } from '$lib/constants/filters';

	export let data;
    
	let reactions = [];
	let playlists = [];
	let filter = 'all';
	let isLoading = false;

	const loadReactions = async () => {
		if (!isLoggedIn) {
			return;
		}
        isLoading = true;
        reactions = [];
		playlists = [];
        setTimeout(async () => {
            reactions = await getUserReactions(data.userId, filter); // Pass the filter to the getAllReactions function
            playlists = await getUserPlaylists(data.userId);
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
			<div
				class="flex gap-8 flex-wrap justify-center"
			>
				<div class="w-5/12 flex flex-col gap-4 items-center">
					<h2>
						My Reactions
					</h2>
					<ReactionsList {reactions}/>
				</div>
				<div class="w-5/12 flex flex-col gap-4 items-center">
					<h2>
						My Playlists
					</h2>
					<PlaylistsList {playlists}/>
				</div>
			</div>
		</div>
	{:else}{handlePrivateRoute()}{/if}
{/if}
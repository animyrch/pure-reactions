<script>
	import { getUserReactions } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS } from '$lib/constants/filters';

	export let data;
    
	let reactions = [];
	let filter = 'all';
	let isLoading = false;

	const loadReactions = async () => {
		if (!isLoggedIn) {
			return;
		}
        isLoading = true;
        reactions = []
        setTimeout(async () => {
            reactions = await getUserReactions(data.userId, filter); // Pass the filter to the getAllReactions function
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
			<ReactionsList {reactions}/>
		</div>
	{:else}{handlePrivateRoute()}{/if}
{/if}
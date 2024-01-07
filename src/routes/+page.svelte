<!-- src/App.svelte -->

<script>
	import { getAllReactions } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import ReactionsSorting from '$lib/components/Navigation/ReactionsSorting.svelte';
	import { page } from '$app/stores';
    import { SORTINGS } from '$lib/constants/sortings';
    import { userExtraDataStore } from '$lib/stores/userExtraData';

	// Initialize Firebase
	let reactions = [];

	$: {
		const queryParamsSize = $page.url.searchParams.size;
			loadReactions();
	}

	const loadReactions = async () => {
		reactions = []
		setTimeout(async () => {
			const sortBy = $page.url.searchParams.get('sortBy') || SORTINGS.NEW;
			const follows = $userExtraDataStore.userExtraData?.follows;
			reactions = await getAllReactions(sortBy, follows);
		}, 100);
	};
</script>
		
<div>
	{#if $page.route.id === '/'}
		<ReactionsSorting />
	{/if}
	<ReactionsList {reactions}/>
</div>
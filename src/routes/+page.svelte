<!-- src/App.svelte -->

<script>
	import { getReactionsByPage, getSetsByPage } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import ReactionsSorting from '$lib/components/Navigation/ReactionsSorting.svelte';
	import { page } from '$app/stores';
    import { SORTINGS } from '$lib/constants/sortings';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { onMount, onDestroy } from 'svelte';

	// Initialize Firebase
	let reactions = [];
	let isLoading = false;
	let lastReactionDoc = null;
	let lastSetDoc = null;
	let initialLoad = true;
	const pageSize = 9;
	const setPageSize = 3; // Include fewer sets to maintain balance

	const loadReactions = async () => {
		const sortBy = $page.url.searchParams.get('sortBy') || SORTINGS.NEW;
		const follows = $userExtraDataStore.userExtraData?.follows;
		
		// Fetch reactions and sets in parallel
		const [reactionsResponse, setsResponse] = await Promise.all([
			getReactionsByPage(lastReactionDoc, pageSize, sortBy, follows),
			getSetsByPage(lastSetDoc, setPageSize)
		]);
		
		lastReactionDoc = reactionsResponse.lastVisible;
		lastSetDoc = setsResponse.lastVisible;
		
		// For sets, we'll use a generic placeholder - the actual thumbnails will be 
		// fetched when rendering if needed, or we can show a set-specific placeholder
		const hydratedSets = setsResponse.sets;
		
		// Merge and sort by creation date
		const newItems = [...reactionsResponse.reactions, ...hydratedSets]
			.sort((a, b) => {
				const aTime = a.data?.createdAt?.toMillis?.() || 0;
				const bTime = b.data?.createdAt?.toMillis?.() || 0;
				return bTime - aTime;
			});
		
		reactions = [...reactions, ...newItems];
	};
	loadReactions();
	// Create an intersection observer to load more reactions when the user scrolls to the bottom of the list
    let observer;
    onMount(() => {
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 1.0
        }
        observer = new IntersectionObserver(loadMore, options);
        observer.observe(document.querySelector('.load-more'));
    });
    onDestroy(() => {
        if (observer) observer.disconnect();
    });

    function loadMore(entries, _observer) {
        if (entries[0].isIntersecting) {
            if (!initialLoad) {
                loadReactions();
            } else {
                initialLoad = false;
            }
        }
    }
</script>
		
<div>
	{#if $page.route.id === '/'}
		<ReactionsSorting />
	{/if}
	{#if isLoading}
    	<div>Loading...</div>
	{:else}
		<ReactionsList {reactions}/>
	{/if}
	<div class="load-more"></div>
</div>
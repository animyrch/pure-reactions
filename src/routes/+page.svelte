<!-- src/App.svelte -->

<script>
	import { getReactionsByPage } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import ReactionsSorting from '$lib/components/Navigation/ReactionsSorting.svelte';
	import { page } from '$app/stores';
    import { SORTINGS } from '$lib/constants/sortings';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { onMount, onDestroy } from 'svelte';

	// Initialize Firebase
	let reactions = [];
	let isLoading = false;
	let lastDoc = null;
	let initialLoad = true;
	const pageSize = 9;

	const loadReactions = async () => {
		const sortBy = $page.url.searchParams.get('sortBy') || SORTINGS.NEW;
		const follows = $userExtraDataStore.userExtraData?.follows;
		const firebaseResponse = await getReactionsByPage(lastDoc, pageSize, sortBy, follows);
		lastDoc = firebaseResponse.lastVisible;
		reactions = [...reactions, ...firebaseResponse.reactions];
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
<!-- src/App.svelte -->

<script>
	import { getReactionsByPage, getQueuesByPage } from "$lib/helpers/firebase";
	import ReactionsList from "$lib/components/ReactionsList.svelte";
	import ReactionsSorting from "$lib/components/Navigation/ReactionsSorting.svelte";
	import { page } from "$app/stores";
	import { SORTINGS } from "$lib/constants/sortings";
	import { userExtraDataStore } from "$lib/stores/userExtraData";
	import { onMount, onDestroy, tick } from "svelte";
	import { handlePrivateRoute } from "$lib/helpers/routing";
	import { isLoggedIn } from "$lib/stores/user";

	// Initialize Firebase
	$: if (
		$page.url.searchParams.get("sortBy") === SORTINGS.FOLLOWING &&
		!$isLoggedIn
	) {
		handlePrivateRoute();
	}
	let reactions = [];
	let isLoading = false;
	let lastReactionDoc = null;
	let lastQueueDoc = null;
	let hasMoreReactions = true;
	let hasMoreQueues = true;
	let sentinel;
	const pageSize = 15;
	const queuePageSize = 3; // Include fewer queues to maintain balance

	const ensureFillViewport = async () => {
		await tick();
		if (isLoading || !sentinel) return;
		if (!hasMoreReactions && !hasMoreQueues) return;
		const rect = sentinel.getBoundingClientRect();
		if (rect.top <= window.innerHeight) {
			loadReactions();
		}
	};

	const loadReactions = async () => {
		if (isLoading) return;
		if (!hasMoreReactions && !hasMoreQueues) return;
		isLoading = true;
		const sortBy = $page.url.searchParams.get("sortBy") || SORTINGS.NEW;
		const follows = $userExtraDataStore.userExtraData?.follows;

		try {
			const reactionsPromise = hasMoreReactions
				? getReactionsByPage(lastReactionDoc, pageSize, sortBy, follows)
				: Promise.resolve({ reactions: [], lastVisible: null });
			const queuesPromise = hasMoreQueues
				? getQueuesByPage(lastQueueDoc, queuePageSize)
				: Promise.resolve({ queues: [], lastVisible: null });

			// Fetch reactions and queues in parallel
			const [reactionsResponse, queuesResponse] = await Promise.all([
				reactionsPromise,
				queuesPromise,
			]);

			if (hasMoreReactions) {
				lastReactionDoc = reactionsResponse.lastVisible || null;
				hasMoreReactions =
					reactionsResponse.reactions?.length === pageSize &&
					!!reactionsResponse.lastVisible;
			}
			if (hasMoreQueues) {
				lastQueueDoc = queuesResponse.lastVisible || null;
				hasMoreQueues =
					queuesResponse.queues?.length === queuePageSize &&
					!!queuesResponse.lastVisible;
			}

			const hydratedQueues = queuesResponse.queues || [];

			// Merge and sort by creation date
			const newItems = [
				...(reactionsResponse.reactions || []),
				...hydratedQueues,
			].sort((a, b) => {
				const aTime = a.data?.createdAt?.toMillis?.() || 0;
				const bTime = b.data?.createdAt?.toMillis?.() || 0;
				return bTime - aTime;
			});

			reactions = [...reactions, ...newItems];
		} finally {
			isLoading = false;
			ensureFillViewport();
		}
	};
	// Create an intersection observer to load more reactions when the user scrolls to the bottom of the list
	let observer;
	onMount(() => {
		const options = {
			root: null,
			rootMargin: "400px 0px",
			threshold: 0,
		};
		observer = new IntersectionObserver(loadMore, options);
		if (sentinel) observer.observe(sentinel);
		loadReactions();
	});
	onDestroy(() => {
		if (observer) observer.disconnect();
	});

	function loadMore(entries, _observer) {
		if (entries[0]?.isIntersecting) {
			loadReactions();
		}
	}
</script>

<div>
	{#if $page.route.id === "/"}
		<ReactionsSorting />
	{/if}
	{#if isLoading && reactions.length === 0}
		<div>Loading...</div>
	{:else}
		<ReactionsList {reactions} />
	{/if}
	<div class="load-more" bind:this={sentinel} aria-hidden="true"></div>
</div>

<!-- src/App.svelte -->

<script>
	import { getReactionsByPage } from "$lib/helpers/firebase";
	import ReactionsList from "$lib/components/ReactionsList.svelte";
	import ReactionsSorting from "$lib/components/Navigation/ReactionsSorting.svelte";
	import SEO from "$lib/components/SEO.svelte";
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
	let hasMoreReactions = true;
	let sentinel;
	const pageSize = 15;

	const ensureFillViewport = async () => {
		await tick();
		if (isLoading || !sentinel) return;
		if (!hasMoreReactions) return;
		const rect = sentinel.getBoundingClientRect();
		if (rect.top <= window.innerHeight) {
			loadReactions();
		}
	};

	const loadReactions = async () => {
		if (isLoading) return;
		if (!hasMoreReactions) return;
		isLoading = true;
		const sortBy = $page.url.searchParams.get("sortBy") || SORTINGS.NEW;
		const follows = $userExtraDataStore.userExtraData?.follows;

		try {
			const reactionsResponse = await getReactionsByPage(
				lastReactionDoc,
				pageSize,
				sortBy,
				follows,
			);
			lastReactionDoc = reactionsResponse.lastVisible || null;
			hasMoreReactions =
				reactionsResponse.reactions?.length === pageSize &&
				!!reactionsResponse.lastVisible;
			reactions = [...reactions, ...(reactionsResponse.reactions || [])];
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

<SEO 
	title="Pure Reactions - Synchronized Twin-Player Viewing"
	description="Watch synchronized content with perfect timing. Reactions, translations, voiceovers, commentary—all synced with original videos. No copyright claims, pure creative freedom."
	canonical="/"
	keywords="synchronized video player, twin player, reaction videos, video translations, voiceover sync, copyright free, fair use free"
/>

<!-- Value Proposition Banner -->
{#if $page.route.id === "/"}
	<div class="value-banner mx-auto max-w-5xl px-4 py-8 md:py-12">
		<div class="rounded-lg border border-accent-primary/30 bg-gradient-to-r from-accent-primary/5 to-accent-secondary/5 p-6 md:p-8">
			<h2 class="mb-3 text-2xl font-bold text-text-primary md:text-3xl">
				Watch Synchronized Content. <span class="text-accent-primary">No Limits.</span> No Claims.
			</h2>
			<p class="mb-4 text-text-secondary md:text-lg">
				Experience reactions, translations, voiceovers, and commentary perfectly synchronized with original videos. Two streams, perfect timing, zero copyright risk.
			</p>
			<div class="flex flex-wrap gap-4">
				<a 
					href="/how-it-works" 
					class="inline-flex items-center gap-2 rounded-lg border border-accent-primary px-5 py-2.5 font-medium text-accent-primary transition-colors hover:bg-accent-primary/10"
				>
					How It Works
					<span aria-hidden="true">→</span>
				</a>
				<a 
					href="/react" 
					class="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-5 py-2.5 font-medium text-background transition-colors hover:bg-accent-primary/90"
				>
					Create Synced Content
				</a>
			</div>
		</div>
	</div>
{/if}

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

<style>
	.value-banner {
		padding-top: calc(72px + 1rem); /* Account for fixed nav */
	}
</style>

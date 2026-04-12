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
	import { isLoggedIn } from "$lib/stores/user";
	import { goto } from "$app/navigation";

	/** @type {import('./$types').PageData} */
	export let data;

	// Initialize Firebase
	$: if (
		$page.url.searchParams.get("sortBy") === SORTINGS.FOLLOWING &&
		!$isLoggedIn
	) {
		goto(`/?sortBy=${SORTINGS.NEW}`);
	}

	// Seed the first page from server-side data so the initial HTML contains
	// reaction cards without requiring JavaScript.
	let reactions = data.reactions || [];
	let isLoading = false;
	// When the server pre-fetched the first page we use its cursor (a ms
	// timestamp) to start the next client-side fetch from the right place.
	// The cursor is a plain Date which Firestore Lite's startAfter() accepts
	// as a field value matching the createdAt orderBy clause.
	let lastReactionDoc = data.lastCursorMs ? new Date(data.lastCursorMs) : null;
	let hasMoreReactions = (data.reactions?.length ?? 0) >= pageSize;
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
		// Skip the initial fetch when the server already provided the first page.
		if (reactions.length === 0) {
			loadReactions();
		} else {
			ensureFillViewport();
		}
	});
	onDestroy(() => {
		if (observer) observer.disconnect();
	});

	function loadMore(entries, _observer) {
		if (entries[0]?.isIntersecting) {
			loadReactions();
		}
	}

	const websiteJsonLd = JSON.stringify({
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "Pure Reactions",
		"url": "https://purereactions.com",
		"potentialAction": {
			"@type": "SearchAction",
			"target": {
				"@type": "EntryPoint",
				"urlTemplate": "https://purereactions.com/search?q={search_term_string}"
			},
			"query-input": "required name=search_term_string"
		}
	});
	// Build the JSON-LD script element as a string so that the literal closing
	// tag does not appear in the Svelte template (which confuses HTML parsers).
	const jsonLdScriptTag = `<script type="application/ld+json">${websiteJsonLd}</` + `script>`;
</script>

<svelte:head>
	<!-- WebSite + SearchAction JSON-LD for Google Sitelinks Search Box -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html jsonLdScriptTag}
</svelte:head>

<SEO
	title="Pure Reactions - Synchronized Twin-Player Viewing"
	description="Watch synchronized content with perfect timing. Reactions, translations, voiceovers, commentary—all synced with original videos. No copyright claims, pure creative freedom."
	canonical="/"
	keywords="synchronized video player, twin player, reaction videos, video translations, voiceover sync, copyright free, fair use free"
/>

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
</style>

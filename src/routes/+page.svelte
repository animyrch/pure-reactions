<script>
	import { getReactionsByPage } from "$lib/helpers/firebase";
	import SEO from "$lib/components/SEO.svelte";
	import { page } from "$app/stores";
	import { SORTINGS } from "$lib/constants/sortings";
	import { userExtraDataStore } from "$lib/stores/userExtraData";
	import { onMount, onDestroy, tick } from "svelte";
	import { fade } from "svelte/transition";
	import { isLoggedIn } from "$lib/stores/user";
	import { goto } from "$app/navigation";

	import LandingHero from "$lib/components/landing/LandingHero.svelte";
	import LandingSyncExplainer from "$lib/components/landing/LandingSyncExplainer.svelte";
	import LandingWorkflow from "$lib/components/landing/LandingWorkflow.svelte";
	import LandingTrust from "$lib/components/landing/LandingTrust.svelte";
	import LandingCreatorProof from "$lib/components/landing/LandingCreatorProof.svelte";

	/** @type {import('./$types').PageData} */
	export let data;
	const pageSize = 15;

	$: if (
		$page.url.searchParams.get("sortBy") === SORTINGS.FOLLOWING &&
		!$isLoggedIn
	) {
		goto(`/?sortBy=${SORTINGS.NEW}`);
	}

	let reactions = data.reactions || [];
	let isLoading = false;
	let hasLoadedInitialResults = reactions.length > 0;
	let lastReactionDoc = data.lastCursorMs ? new Date(data.lastCursorMs) : null;
	let hasMoreReactions = reactions.length > 0 ? reactions.length >= pageSize : true;
	let sentinel;

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
		} catch (error) {
			console.error('Failed to load reactions for landing page:', error);
			hasMoreReactions = false;
		} finally {
			isLoading = false;
			hasLoadedInitialResults = true;
			ensureFillViewport();
		}
	};

	let creatorProofVisible = false;
	let pillMounted = false;
	let proofObserver;

	let observer;
	onMount(() => {
		const options = {
			root: null,
			rootMargin: "400px 0px",
			threshold: 0,
		};
		observer = new IntersectionObserver(loadMore, options);
		if (sentinel) observer.observe(sentinel);
		if (reactions.length === 0) {
			loadReactions();
		} else {
			ensureFillViewport();
		}
	});
	onMount(() => {
		const proofSection = document.getElementById('creator-proof');
		if (proofSection) {
			proofObserver = new IntersectionObserver(
				([entry]) => {
					creatorProofVisible = entry.isIntersecting;
				},
				{ threshold: 0.1 }
			);
			proofObserver.observe(proofSection);
		}
		const pillTimer = setTimeout(() => { pillMounted = true; }, 600);
		return () => clearTimeout(pillTimer);
	});

	onDestroy(() => {
		if (observer) observer.disconnect();
		if (proofObserver) proofObserver.disconnect();
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

	const appJsonLd = JSON.stringify({
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"name": "Pure Reactions",
		"url": "https://purereactions.com",
		"applicationCategory": "MultimediaApplication",
		"operatingSystem": "Web",
		"description": "A creator tool for recording synchronized reaction, commentary, translation, and voiceover content. Your recording and the original video stay separate—copyright-safe and perfectly synced.",
		"offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
		"featureList": [
			"Synchronized twin-player playback",
			"Copyright-safe reaction recording",
			"YouTube and TikTok source support",
			"Reaction, commentary, translation and voiceover workflows"
		]
	});

	const jsonLdScriptTag =
		`<script type="application/ld+json">${websiteJsonLd}</` + `script>` +
		`<script type="application/ld+json">${appJsonLd}</` + `script>`;
</script>

<svelte:head>
	{@html jsonLdScriptTag}
</svelte:head>

<SEO
	title="Pure Reactions — Sync Your Transformative Content (Reaction, Commentary & Translation Videos)"
	description="Record reaction videos, commentary, translations, voiceovers and more—perfectly synchronized with the original video. Your content stays copyright-safe on your own channel. Free to use."
	canonical="/"
	keywords="reaction video tool, commentary creator, translation video sync, voiceover sync, synchronized video player, twin player, copyright safe reactions, reaction content creator, video sync platform, accessibility creator, mixer, synced reaction recording"
	image="/og-preview.png"
/>

{#if pillMounted && !creatorProofVisible}
	<button
		transition:fade={{ duration: 300 }}
		class="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/90 px-5 py-2.5 text-sm font-medium text-text-secondary shadow-elevated ring-1 ring-border-subtle backdrop-blur-sm transition-colors duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		on:click={() => document.getElementById('creator-proof')?.scrollIntoView({ behavior: 'smooth' })}
		aria-label="Scroll down to see what creators are making"
	>
		See what creators are making
		<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>
{/if}

<!-- Landing narrative -->
<div class="landing-page">
	<LandingHero />
	<LandingSyncExplainer />
	<LandingWorkflow />
	<LandingTrust />
	<LandingCreatorProof {reactions} loading={isLoading} hasLoaded={hasLoadedInitialResults} />
	<div class="load-more" bind:this={sentinel} aria-hidden="true"></div>
</div>

<style>
	.landing-page {
		/* Pull the landing sections out of the default app-container padding
		   so hero and full-bleed sections stretch edge-to-edge. */
		margin-left: calc(-1 * max(1rem, var(--safe-area-inset-left, 0px)));
		margin-right: calc(-1 * max(1rem, var(--safe-area-inset-right, 0px)));
	}
</style>

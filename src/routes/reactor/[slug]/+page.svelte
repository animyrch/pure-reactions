<script>
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import SEO from '$lib/components/SEO.svelte';

    export let data;

    $: slug = data.slug ?? '';
    $: profilePageJsonLd = (() => {
        const json = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `${slug} reactions on Pure Reactions`,
            url: `https://purereactions.com/reactor/${encodeURIComponent(slug)}`,
            mainEntity: {
                '@type': 'Person',
                name: slug,
            },
        }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
        return `<script type="application/ld+json">${json}<` + `/script>`;
    })();
</script>

<SEO
    title="{slug} - Reactor"
    description="Watch all reaction videos by {slug} on Pure Reactions. Synchronized, fair-use-free reactions with twin-player technology."
    canonical="/reactor/{slug}"
    keywords="reactions by {slug}, reaction videos, pure reactions, {slug} reactor"
    type="profile"
/>

<svelte:head>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html profilePageJsonLd}
</svelte:head>

<div>
	<header class="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 lg:px-10">
		<p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Reactor</p>
		<h1 class="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">{slug}</h1>
	</header>
	<ReactionsList reactions={data.reactorPureReactions} />
</div>
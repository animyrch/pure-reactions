<script>
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import SEO from '$lib/components/SEO.svelte';

    export let data;

    $: slug = data.slug ?? '';
    $: profilePageJsonLd = (() => {
        const json = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `${slug} - Original Creator on Pure Reactions`,
            url: `https://purereactions.com/creator/${encodeURIComponent(slug)}`,
            mainEntity: {
                '@type': 'Person',
                name: slug,
            },
        }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
        return `<script type="application/ld+json">${json}<` + `/script>`;
    })();
</script>

<SEO
    title="{slug} - Creator"
    description="Watch all reaction videos reacting to content by {slug} on Pure Reactions. Synchronized, fair-use-free reactions with twin-player technology."
    canonical="/creator/{slug}"
    keywords="reactions to {slug}, reaction videos, pure reactions, {slug} original creator"
    type="profile"
/>

<svelte:head>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html profilePageJsonLd}
</svelte:head>

<div>
	<header class="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 lg:px-10">
		<p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Original Creator</p>
		<h1 class="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">{slug}</h1>
	</header>
	<ReactionsList reactions={data.creatorPureReactions} />
</div>
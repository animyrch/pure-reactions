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
	<ReactionsList reactions={data.creatorPureReactions} />
</div>
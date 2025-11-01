<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";
    import { onMount } from "svelte";
    import { getReactionsToOriginalVideo } from '$lib/helpers/firebase';

    export let originalVideoId;
    export let reactionVideoId;

    let otherReactions = [];
    let itemRefs = [];
    let activeIndex = -1;
    let fetchKey = '';

    let viewAllHref = '/search';

    $: viewAllHref = originalVideoId
        ? `/search?originalVideoId=${encodeURIComponent(originalVideoId)}`
        : '/search';

    async function loadOtherReactions() {
        if (!originalVideoId || !reactionVideoId) {
            otherReactions = [];
            activeIndex = -1;
            return;
        }

        try {
            const reactions = await getReactionsToOriginalVideo(originalVideoId, reactionVideoId);
            otherReactions = reactions;
            activeIndex = -1;
        } catch (error) {
            console.error('Failed to load related reactions:', error);
            otherReactions = [];
            activeIndex = -1;
        }
    }

    onMount(() => {
        loadOtherReactions();
    });

    $: if (originalVideoId && reactionVideoId) {
        const key = `${originalVideoId}:${reactionVideoId}`;
        if (key !== fetchKey) {
            fetchKey = key;
            loadOtherReactions();
        }
    }

    function registerItem(node, idx) {
        itemRefs = [...itemRefs];
        itemRefs[idx] = node;
        return {
            destroy() {
                itemRefs = itemRefs.filter((_, index) => index !== idx);
            }
        };
    }

    function focusItem(index) {
        const items = itemRefs.filter(Boolean);
        const target = items[index];
        if (!target) return;

        const focusable = target.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
        const elementToFocus = focusable || target;
        elementToFocus.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        activeIndex = index;
    }

    function handleCarouselKeydown(event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
            return;
        }

        const items = itemRefs.filter(Boolean);
        if (!items.length) {
            return;
        }

        const activeElement = document.activeElement;
        let currentIndex = items.findIndex((item) => item.contains(activeElement));

        if (currentIndex === -1) {
            event.preventDefault();
            focusItem(0);
            return;
        }

        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = Math.min(Math.max(currentIndex + direction, 0), items.length - 1);
        if (nextIndex !== currentIndex) {
            focusItem(nextIndex);
        }
    }
</script>

{#if otherReactions.length > 0}
    <section class="space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.3em] text-slate-500">More reactions</p>
                <h2 class="text-2xl font-semibold text-white">Other creators reacting to this video</h2>
            </div>
            <a
                class="inline-flex items-center gap-2 text-sm font-medium text-blue-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                href={viewAllHref}
            >
                View all reactions
                <span aria-hidden="true">→</span>
            </a>
        </div>

        <div
            class="carousel"
            role="listbox"
            aria-label="Other reactions to this video"
            tabindex="0"
            on:keydown={handleCarouselKeydown}
        >
            {#each otherReactions as reaction, index (reaction.id ?? index)}
                <div
                    class="carousel-item"
                    role="option"
                    aria-selected={index === activeIndex}
                    use:registerItem={index}
                    data-carousel-item
                    on:focusin={() => (activeIndex = index)}
                >
                    <ReactionsListElement {reaction} />
                </div>
            {/each}
        </div>
    </section>
{/if}

<style>
    section {
        padding-block: 1.5rem;
    }

    .carousel {
        display: flex;
        gap: 1rem;
        overflow-x: auto;
        padding-bottom: 0.75rem;
        scroll-snap-type: x mandatory;
        scroll-padding-left: 1rem;
        scrollbar-width: thin;
    }

    .carousel:focus-visible {
        outline: 2px solid rgba(59, 130, 246, 0.6);
        outline-offset: 4px;
    }

    .carousel::-webkit-scrollbar {
        height: 6px;
    }

    .carousel::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.4);
        border-radius: 999px;
    }

    .carousel-item {
        scroll-snap-align: start;
        flex: 0 0 min(75vw, 18rem);
    }

    @media (min-width: 640px) {
        .carousel {
            scroll-snap-type: none;
            overflow-x: visible;
            padding-bottom: 0;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
        }

        .carousel-item {
            flex: initial;
        }
    }
</style>
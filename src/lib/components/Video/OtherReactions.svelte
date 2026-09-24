<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { getReactionsToOriginalVideo } from "$lib/helpers/firebase";
    import { generateOriginalVideoSlug } from "$lib/helpers/originalVideo";
    import { UserSolid } from "flowbite-svelte-icons";

    export let originalVideoId;
    export let reactionVideoId;
    export let originalVideoTitle = "";
    export let originalVideoAuthor = "";
    export let hasOtherReactions = false;

    $: hasOtherReactions = otherReactions.length > 0;

    let otherReactions = [];
    let itemRefs = [];
    let activeIndex = -1;
    let fetchKey = "";

    function viewAllReactions() {
        const slug = generateOriginalVideoSlug(originalVideoTitle, originalVideoAuthor);
        goto(`/reactions/${encodeURIComponent(slug)}`);
    }

    async function loadOtherReactions() {
        if (!originalVideoId || !reactionVideoId) {
            otherReactions = [];
            activeIndex = -1;
            return;
        }

        try {
            const reactions = await getReactionsToOriginalVideo(
                originalVideoId,
                reactionVideoId,
            );
            otherReactions = reactions;
            activeIndex = -1;
        } catch (error) {
            console.error("Failed to load related reactions:", error);
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
            },
        };
    }

    function focusItem(index) {
        const items = itemRefs.filter(Boolean);
        const target = items[index];
        if (!target) return;

        const focusable = target.querySelector(
            'a, button, [tabindex]:not([tabindex="-1"])',
        );
        const elementToFocus = focusable || target;
        elementToFocus.focus({ preventScroll: true });
        target.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
        });
        activeIndex = index;
    }

    function handleCarouselKeydown(event) {
        if (
            event.key !== "ArrowRight" &&
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowDown" &&
            event.key !== "ArrowUp"
        ) {
            return;
        }

        const items = itemRefs.filter(Boolean);
        if (!items.length) {
            return;
        }

        const activeElement = document.activeElement;
        let currentIndex = items.findIndex((item) =>
            item.contains(activeElement),
        );

        if (currentIndex === -1) {
            event.preventDefault();
            focusItem(0);
            return;
        }

        event.preventDefault();
        const direction =
            event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(
            Math.max(currentIndex + direction, 0),
            items.length - 1,
        );
        if (nextIndex !== currentIndex) {
            focusItem(nextIndex);
        }
    }
</script>

{#if otherReactions.length > 0}
    <section class="space-y-4">
        <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-3">
                    <span
                        class="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded bg-[#ff2f51] text-background"
                        aria-hidden="true"
                    >
                        <UserSolid class="h-4 w-4" />
                    </span>
                    <h2 class="truncate text-sm font-semibold leading-none text-text-primary">
                        More reactions
                    </h2>
                </div>
                <p class="mt-2 text-xs leading-tight text-text-muted">
                    Same video. Different creators.
                </p>
            </div>
            <button
                class="inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap text-sm font-medium text-[#02c4f9] transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                type="button"
                aria-label="View all {otherReactions.length} reactions"
                on:click={viewAllReactions}
            >
                View all ({otherReactions.length})
                <span aria-hidden="true">→</span>
            </button>
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
        padding-block: 1rem;
        padding-inline: 1rem;
    }

    @media (min-width: 640px) {
        section {
            padding-block: 1.5rem;
            padding-inline: 0;
        }
    }

    .carousel {
        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        padding-bottom: 0.75rem;
        scroll-snap-type: x mandatory;
        scroll-padding-left: 1rem;
        scrollbar-width: thin;
    }

    @media (min-width: 640px) {
        .carousel {
            gap: 1rem;
        }
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
        flex: 0 0 min(14rem, 82vw);
        max-width: 82vw;
    }

    @media (max-width: 639px) {
        .carousel-item {
            flex-basis: min(12.5rem, 78vw);
            max-width: 78vw;
        }
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

    @media (min-width: 1024px) {
        .carousel {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            grid-template-columns: none;
        }

        .carousel-item {
            flex: initial;
            max-width: 100%;
            width: 100%;
        }
    }
</style>

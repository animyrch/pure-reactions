<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";

    export let hit;
    export let tabIndex = -1;
    export let active = false;
    export let index = 0;
    export let register = () => {};

    const dispatch = createEventDispatcher();

    const hitAdjustedAsReaction = {
        id: hit.objectID,
        data: {
            ...hit
        }
    };

    let wrapper;
    $: ariaTitle =
        hitAdjustedAsReaction?.data?.reactionVideoTitleOrig ||
        hitAdjustedAsReaction?.data?.reactionVideoTitle ||
        hitAdjustedAsReaction?.data?.originalVideoTitleOrig ||
        hitAdjustedAsReaction?.data?.originalVideoTitle ||
        'View reaction';

    onMount(() => {
        register(wrapper);
    });

    $: if (wrapper && register) {
        register(wrapper);
    }

    const handleFocus = () => {
        dispatch('focus', { index });
    };

    const handleHover = () => {
        dispatch('highlight', { index });
    };

    const handleSelect = () => {
        dispatch('select', { index });
    };

    const handleKeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const link = wrapper?.querySelector('a');
            if (link) {
                link.click();
            } else {
                handleSelect();
            }
        }
    };
</script>

<div
    bind:this={wrapper}
    class={`group block h-full rounded-2xl transition duration-subtle ease-cinematic focus-visible:outline-none ${active ? 'ring-2 ring-focus ring-offset-2 ring-offset-background' : 'ring-0 ring-transparent'}`}
    tabindex={tabIndex}
    role="link"
    aria-label={ariaTitle}
    on:focus={handleFocus}
    on:mouseenter={handleHover}
    on:keydown={handleKeydown}
    on:click={handleSelect}
>
    <ReactionsListElement reaction={hitAdjustedAsReaction} />
</div>
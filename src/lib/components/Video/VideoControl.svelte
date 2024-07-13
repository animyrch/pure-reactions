<script>
    import { createEventDispatcher } from 'svelte';
    import { Button, P, Span } from 'flowbite-svelte';
    import {
        PauseSolid,
        PlaySolid,
        ClockOutline
    } from 'flowbite-svelte-icons';

    export let bothVideosStarted;

    let isPlaying = true;
    const dispatch = createEventDispatcher();

    function togglePlayState() {
        isPlaying = !isPlaying;
        dispatch('playStateChanged', { isPlaying });
    }
    function syncVideos() {
        dispatch('syncVideos');
    }
    function handleKeydown(event) {
        if (event.key === ' ') {
            event.preventDefault();
            togglePlayState();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div>
    {#if !bothVideosStarted}
        <P class="text-center mb-6 text-lg lg:text-xl sm:px-16 xl:px-48">
            <Span highlight>Click on both videos to start watching the reaction.</Span>
        </P>
    {:else}
        <div class="flex justify-between">
            <Button on:click={togglePlayState}>
                {#if isPlaying}
                    <PauseSolid class="w-10 h-5 me-2" />Stop Videos
                {:else}
                    <PlaySolid class="w-10 h-5 me-2" />Resume Videos
                {/if}
            </Button>
            <Button on:click={syncVideos}>
                <ClockOutline class="w-10 h-5 me-2" />Sync Videos
            </Button>
        </div>
    {/if}
</div>
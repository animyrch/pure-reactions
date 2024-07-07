<script>
    import { createEventDispatcher } from 'svelte';
    import { Button, P } from 'flowbite-svelte';
    import {
        PauseSolid,
        PlaySolid
    } from 'flowbite-svelte-icons';

    export let bothVideosStarted;

    let isPlaying = true;
    const dispatch = createEventDispatcher();

    function togglePlayState() {
        isPlaying = !isPlaying;
        dispatch('playStateChanged', { isPlaying });
    }
</script>

<div>
    {#if !bothVideosStarted}
        <P class="mb-6 text-lg lg:text-xl sm:px-16 xl:px-48 dark:text-gray-400">Click on both videos to start watching the reaction.</P>
    {:else}
        <Button on:click={togglePlayState}>
            {#if isPlaying}
                <PauseSolid class="w-10 h-5 me-2" />Stop Videos
            {:else}
                <PlaySolid class="w-10 h-5 me-2" />Resume Videos
            {/if}
        </Button>
    {/if}
</div>
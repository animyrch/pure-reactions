<script>
    import { ExpandSolid, MinimizeSolid } from 'flowbite-svelte-icons';
    import { GradientButton, Button } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';

    export let isUsersOwnVideo;
    export let canShowEditModeButton;
    export let canShowCloseEditModeButton;
    export let isPublished;
    export let isReactionMissing;
    export let isFullscreen;

    const dispatch = createEventDispatcher();

    function enterEditMode() {
        dispatch('enterEditMode');
    }
    function closeEditMode() {
        dispatch('closeEditMode');
    }
    function setIsPublished() {
        dispatch('setIsPublished');
    }
    function setIsUnpublished() {
        dispatch('setIsUnpublished');
    }
    function openWithFullscreen() {
        dispatch('openWithFullscreen');
    }
    function openWithHalfscreen() {
        dispatch('openWithHalfscreen');
    }
</script>

<div class="flex justify-between m-2">
    {#if isUsersOwnVideo}
        <div class="text-left">
            {#if canShowEditModeButton}
                <Button
                    on:click={enterEditMode}
                    color="alternative"
                >
                    Edit Reaction
                </Button>
            {/if}
            {#if canShowCloseEditModeButton}
                <Button
                    on:click={closeEditMode}
                    color="alternative"
                >
                    Finish Editing
                </Button>
            {/if}
        </div>
    {/if}
    {#if !isPublished && !isReactionMissing}
        <GradientButton
            on:click={setIsPublished}
            color="pinkToOrange"
        >
            Publish
        </GradientButton>
    {/if}
    {#if isPublished}
        <Button
            on:click={setIsUnpublished}
            color="light"
        >
            Unpublish
        </Button>
    {/if}
    <div class="hidden md:block">
        {#if isFullscreen}
            <Button
                size="md"
                color="blue"
                pill
                on:click={openWithHalfscreen}
            >
                <MinimizeSolid class="w-3.5 h-3.5 me-2" />
                <span>Halfscreen</span>
            </Button>
        {:else}
            <Button
                size="md"
                color="blue"
                pill
                on:click={openWithFullscreen}
            >
            <ExpandSolid class="w-3.5 h-3.5 me-2" />
            <span>Fullscreen</span>
            </Button>
        {/if}
    </div>
</div>
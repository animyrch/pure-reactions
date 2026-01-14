<script>
    import ReactionStage from "$lib/components/reaction/ReactionStage.svelte";

    // Mock props
    let isFullscreen = false;
    let isControlSurfaceVisible = true;
    let isReactionMissing = false;
    let playerOriginal = {}; // Just needs to be truthy to show controls
    let playerReaction = {}; // Just needs to be truthy to show controls
    let bothVideosStarted = true;
    let reactionCurrentTime = 30;
    let reactionDuration = 100;
</script>

<div class="test-container" style="background: #333; min-height: 100vh;">
    <h1>ReactionStage Layout Test</h1>
    <p>Toggle controls bellow to simulate states.</p>
    <button
        class="bg-white p-2 text-black"
        on:click={() => (isFullscreen = !isFullscreen)}
        >Toggle Fullscreen (Prop)</button
    >
    <button
        class="bg-white p-2 text-black"
        on:click={() => (isReactionMissing = !isReactionMissing)}
        >Toggle Missing Reaction</button
    >

    <div style="margin-top: 20px;">
        <ReactionStage
            bind:isFullscreen
            bind:isControlSurfaceVisible
            {isReactionMissing}
            {playerOriginal}
            {playerReaction}
            {bothVideosStarted}
            {reactionCurrentTime}
            {reactionDuration}
            alwaysShowMissingPlaceholder={true}
        />
    </div>
</div>

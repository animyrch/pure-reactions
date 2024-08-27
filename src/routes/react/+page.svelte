<script>
    import { StepIndicator, Label, Input, P, Span } from 'flowbite-svelte';
    import { ArrowLeftOutline } from 'flowbite-svelte-icons';
    import { GradientButton } from 'flowbite-svelte';
    import { goToRoute } from "$lib/helpers/routing";
    import { extractYouTubeVideoId, extractYoutubePlaylistId } from '$lib/helpers/youtube';
    import { auth } from '$lib/helpers/firebase';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { onMount } from 'svelte';

    const createReactForm = {
        currentStep: 1,
        steps: [
            'Reaction Type',
            'Original Video Id',
            'Original Playlist Id'
        ],
        originalVideoId: '',
        reactionVideoId: '',
        originalPlaylistId: '',
        reactionType: null,
        errors: {
            missingOriginalVideoId: false,
            missingReactionVideoId: false,
            missingReactionType: false,
            missingOriginalPlaylistId: false
        }
    };
    let user;
    
    const onConfirmVideoReaction = () => {
        createReactForm.reactionType = 'video';
        // if video reaction, delete step three from steps
        createReactForm.currentStep++;
    };
    const onConfirmPlaylistReaction = () => {
        createReactForm.reactionType = 'playlist';
        // if playlist reaction, delete step two from steps
        createReactForm.currentStep++;
        createReactForm.currentStep++;
    };
    const goToVideoReaction = () => {
        const videoId = extractYouTubeVideoId(createReactForm.originalVideoId);
        goToRoute(`/backend?id=${videoId}`);
    };
    const goToPlaylistReaction = () => {
        console.log('go to playlist reaction');
        console.log(createReactForm.originalPlaylistId);
        const playlistId = extractYoutubePlaylistId(createReactForm.originalPlaylistId);
        if (!playlistId) {
            createReactForm.errors.missingOriginalPlaylistId = true;
            return;
        }
        goToRoute(`/react/to-playlist?id=${playlistId}`);
    };
    const onConfirmStep1 = () => {
        if (createReactForm.originalVideoId) {
            createReactForm.errors.missingOriginalVideoId = false;
            goToVideoReaction();
        } else {
            createReactForm.errors.missingOriginalVideoId = true;
        }
    };
    const onConfirmPlaylistId = () => {
        if (createReactForm.originalPlaylistId) {
            createReactForm.errors.missingOriginalPlaylistId = false;
            goToPlaylistReaction();
        } else {
            createReactForm.errors.missingOriginalPlaylistId = true;
        }
    };

    const onConfirmStep = () => {
        createReactForm.currentStep++;
    }
    const goBackOneStep = () => {
        // if step three, go back twice
        if (createReactForm.currentStep === 3) {
            createReactForm.currentStep--;
        }
        createReactForm.currentStep--;
    };

    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
      }
    });
</script>

<div class="max-w-96 m-auto">
    <div class="step-indicator-container mb-5">
        {#if createReactForm.currentStep}
        <StepIndicator
            currentStep={parseInt(createReactForm.currentStep)}
            steps={createReactForm.steps}
            glow
        />
        {/if}
    </div>
    
    {#if createReactForm.currentStep === 1}
        <div class="mb-2">
            <form>
                <Label for="reaction-type" color={createReactForm.errors.missingReactionType ? "red" : undefined} class="mb-2">
                    Are you reacting to a single video or a playlist?
                </Label>
            </form>
        </div>
        <div class="text-center">
            <GradientButton on:click={onConfirmVideoReaction} color="pinkToOrange">A video</GradientButton>
            <GradientButton on:click={onConfirmPlaylistReaction} color="pinkToOrange">A playlist</GradientButton>
        </div>
    {:else if createReactForm.currentStep === 2}
        <div class="mb-2">
            <form>
                <Label for="original-video-id" color={createReactForm.errors.missingOriginalVideoId ? "red" : undefined} class="mb-2">
                    What are you reacting to? Enter the youtube url or the video id below:
                    <Span>Video needs to be public</Span>
                </Label>
                <Input bind:value={createReactForm.originalVideoId} type="text" id="original-video-id" color={createReactForm.errors.missingOriginalVideoId ? "red" : undefined} required />
            </form>
        </div>
        <div class="text-center">
            <GradientButton on:click={onConfirmStep1} color="pinkToOrange">Confirm</GradientButton>
        </div>
    {:else if createReactForm.currentStep === 3}
        <div class="mb-2">
            <form>
                <Label for="original-playlist-id" color={createReactForm.errors.missingOriginalPlaylistId ? "red" : undefined} class="mb-2">
                    What are you reacting to? Enter the youtube url or the playlist id below:
                    <Span>Playlist needs to be public</Span>
                </Label>
                <Input bind:value={createReactForm.originalPlaylistId} type="text" id="original-playlist-id" color={createReactForm.errors.missingOriginalPlaylistId ? "red" : undefined} required />
            </form>
        </div>
        <div class="text-center">
            <GradientButton on:click={onConfirmPlaylistId} color="pinkToOrange">Confirm</GradientButton>
        </div>
    {/if}
    <div class="backwards-navigation-container mt-5">
        {#if createReactForm.currentStep !== 1 && createReactForm.currentStep !== 4}
            <div>
                <GradientButton
                    color="pinkToOrange"
                    class="!p-2"
                    on:click={goBackOneStep}
                >
                    <ArrowLeftOutline class="w-5 h-5" />
                </GradientButton>
            </div>
        {/if}
    </div>
</div>
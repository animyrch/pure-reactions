<script>
    import { StepIndicator, Label, Input, P } from 'flowbite-svelte';
    import { ArrowLeftOutline } from 'flowbite-svelte-icons';
    import { GradientButton } from 'flowbite-svelte';
    import { goToRoute } from "$lib/helpers/routing";
    import { extractYouTubeVideoId } from '$lib/helpers/youtube';

    const createReactForm = {
        currentStep: 1,
        steps: [
            'Original Video Id',
            'Recording platform'
        ],
        originalVideoId: '',
        reactionVideoId: '',
        errors: {
            missingOriginalVideoId: false,
            missingReactionVideoId: false
        }
    };

    const onConfirmStep2Own = () => {
        goToRoute(`/backend?id=${extractYouTubeVideoId(createReactForm.originalVideoId)}`);
    };
    const onConfirmStep2Here = () => {
        goToRoute(`/backend?id=${extractYouTubeVideoId(createReactForm.originalVideoId)}&record=true`);
    };
    const onConfirmStep3 = () => {
        if (createReactForm.reactionVideoId) {
            createReactForm.errors.missingReactionVideoId = false;
            onConfirmStep();
        } else {
            createReactForm.errors.missingReactionVideoId = true;
        }
    };
    const onConfirmStep1 = () => {
        if (createReactForm.originalVideoId) {
            createReactForm.errors.missingOriginalVideoId = false;
            onConfirmStep();
        } else {
            createReactForm.errors.missingOriginalVideoId = true;
        }
    };
    const onConfirmStep = () => {
        createReactForm.currentStep++;
    }
    const goBackOneStep = () => {
        createReactForm.currentStep--;
    };
</script>

<div class="max-w-96">
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
                <Label for="original-video-id" color={createReactForm.errors.missingOriginalVideoId ? "red" : undefined} class="mb-2">
                    What are you reacting to? Enter the youtube url or the video id below:
                </Label>
                <Input bind:value={createReactForm.originalVideoId} type="text" id="original-video-id" color={createReactForm.errors.missingOriginalVideoId ? "red" : undefined} required />
            </form>
        </div>
        <div class="text-center">
            <GradientButton on:click={onConfirmStep1} color="pinkToOrange">Confirm</GradientButton>
        </div>
    {:else if  createReactForm.currentStep === 2}
        <form>
            <Label color={createReactForm.errors.missingOriginalVideoId ? "red" : undefined} class="mb-2">
                <p>Will the reaction be recorded here or on your side?</p>
                <p class="text-xs">(Your video will be synced with original video automatically even if you record yourself but cuts in the video will break this sync. Sync adjustment feature will come soon):</p>
            </Label>
            <div class="flex gap-1">
                <GradientButton on:click={onConfirmStep2Own} color="pinkToOrange">I handle my own recording</GradientButton>
                <GradientButton on:click={onConfirmStep2Here} color="pinkToOrange">I will record here and now</GradientButton>
            </div>
        </form>
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
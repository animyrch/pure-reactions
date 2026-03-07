<script>
    import { GradientButton } from 'flowbite-svelte';
    import { ArrowLeftOutline } from 'flowbite-svelte-icons';
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { goToRoute, handlePrivateRoute } from '$lib/helpers/routing';
    import { extractYouTubeVideoId, extractYoutubePlaylistId } from '$lib/helpers/youtube';
    import { extractTikTokVideoId } from '$lib/helpers/platform';
    import { auth } from '$lib/helpers/firebase';

    const steps = [
        {
            id: 'original-video',
            title: 'Original video',
            prompt: 'What are you reacting to?',
            helper: 'Paste a YouTube or TikTok URL. We will load it instantly and keep playback locked to your session.'
        }
    ];

    const createReactForm = {
        currentStep: 1,
        originalVideoId: '',
        errors: {
            originalVideoId: ''
        }
    };

    let activeStep = steps[0];
    let originalVideoInput;
    let isSubmitting = false;

    $: activeStep = steps[createReactForm.currentStep - 1] ?? steps[0];

    const clearOriginalVideoError = () => {
        if (createReactForm.errors.originalVideoId) {
            createReactForm.errors.originalVideoId = '';
        }
    };

    const handleBackNavigation = () => {
        if (createReactForm.currentStep > 1) {
            createReactForm.currentStep = Math.max(1, createReactForm.currentStep - 1);
            return;
        }

        goToRoute('/');
    };

    const proceedToRecorder = async (videoId, originalValue, platform = 'youtube') => {
        if (platform === 'tiktok') {
            await goToRoute(`/backend?id=${videoId}&platform=tiktok`);
            return;
        }
        const playlistId = extractYoutubePlaylistId(originalValue);
        const redirectUrl = playlistId
            ? `/backend?id=${videoId}&playlist=${playlistId}`
            : `/backend?id=${videoId}`;
        await goToRoute(redirectUrl);
    };

    const onConfirmStep1 = async () => {
        if (isSubmitting) {
            return;
        }
        const rawValue = createReactForm.originalVideoId?.trim();
        if (!rawValue) {
            createReactForm.errors.originalVideoId = 'Paste a YouTube or TikTok link or video ID to continue.';
            return;
        }

        // Try YouTube first
        const youtubeVideoId = extractYouTubeVideoId(rawValue);
        if (youtubeVideoId) {
            isSubmitting = true;
            createReactForm.errors.originalVideoId = '';
            try {
                await proceedToRecorder(youtubeVideoId, rawValue, 'youtube');
            } catch (error) {
                console.error('Failed to navigate to recorder:', error);
                isSubmitting = false;
                createReactForm.errors.originalVideoId = 'Something went wrong. Please try again.';
            }
            return;
        }

        // Try TikTok
        const tiktokVideoId = extractTikTokVideoId(rawValue);
        if (tiktokVideoId) {
            isSubmitting = true;
            createReactForm.errors.originalVideoId = '';
            try {
                await proceedToRecorder(tiktokVideoId, rawValue, 'tiktok');
            } catch (error) {
                console.error('Failed to navigate to recorder:', error);
                isSubmitting = false;
                createReactForm.errors.originalVideoId = 'Something went wrong. Please try again.';
            }
            return;
        }

        createReactForm.errors.originalVideoId = 'We couldn’t read that link. Make sure it is a valid YouTube or TikTok URL.';
    };

    onMount(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            handlePrivateRoute();
            return;
        }

        originalVideoInput?.focus();
    });
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-14 sm:py-20">
        <div class="flex items-center justify-between gap-6">
            <button
                type="button"
                class="group inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                on:click={handleBackNavigation}
            >
                <ArrowLeftOutline class="h-4 w-4 transition group-hover:text-white" />
                <span>Back</span>
            </button>

            <div class="flex items-center gap-2" role="status" aria-label="Setup progress">
                {#each steps as step, index (step.id)}
                    <span
                        class={`h-2.5 rounded-full transition-all duration-300 ${
                            index + 1 === createReactForm.currentStep
                                ? 'w-8 bg-blue-400'
                                : index + 1 < createReactForm.currentStep
                                ? 'w-5 bg-emerald-400'
                                : 'w-2 bg-slate-700'
                        }`}
                        aria-hidden="true"
                    />
                {/each}
                <span class="sr-only">
                    Step {createReactForm.currentStep} of {steps.length}
                </span>
            </div>
        </div>

        <div class="mt-12 flex flex-1 items-center">
            {#if activeStep}
                <div
                    class="w-full rounded-3xl border border-slate-900/60 bg-slate-900/50 p-8 shadow-[0_35px_80px_-60px_rgba(15,23,42,1)]"
                    transition:fade={{ duration: 200 }}
                >
                    <form class="space-y-8" on:submit|preventDefault={onConfirmStep1} aria-describedby={`${activeStep.id}-helper`} aria-busy={isSubmitting}>
                        <div class="space-y-3">
                            <p class="text-xs uppercase tracking-[0.35em] text-slate-500">{activeStep.title}</p>
                            <h1 class="text-3xl font-semibold text-white">{activeStep.prompt}</h1>
                            <p id={`${activeStep.id}-helper`} class="text-sm text-slate-400">
                                {activeStep.helper}
                            </p>
                        </div>

                        <div class="space-y-2">
                            <label class="text-sm font-medium text-slate-200" for="original-video-id">
                                YouTube or TikTok link
                            </label>
                            <input
                                id="original-video-id"
                                name="original-video-id"
                                type="text"
                                bind:this={originalVideoInput}
                                bind:value={createReactForm.originalVideoId}
                                on:input={clearOriginalVideoError}
                                placeholder="https://youtube.com/watch?v=… or https://www.tiktok.com/@user/video/…"
                                class={`w-full rounded-2xl border bg-slate-950/60 px-5 py-4 text-base text-slate-100 shadow-[0_20px_60px_-45px_rgba(15,23,42,1)] focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                                    createReactForm.errors.originalVideoId ? 'border-rose-500/80' : 'border-slate-800/80'
                                }`}
                                autocomplete="off"
                                inputmode="url"
                            />
                            {#if createReactForm.errors.originalVideoId}
                                <p class="text-sm text-rose-400" role="alert">
                                    {createReactForm.errors.originalVideoId}
                                </p>
                            {/if}
                        </div>

                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                class="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                on:click={handleBackNavigation}
                            >
                                <ArrowLeftOutline class="h-4 w-4" />
                                <span>Back</span>
                            </button>

                            <GradientButton
                                type="submit"
                                color="pinkToOrange"
                                class={`w-full sm:w-auto sm:px-8 sm:py-3 ${isSubmitting ? 'pointer-events-none opacity-80' : ''}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Loading…' : 'Continue'}
                            </GradientButton>
                        </div>
                    </form>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
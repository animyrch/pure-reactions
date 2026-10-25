<script>
    import { Modal } from 'flowbite-svelte';

    export let open = false;
    export let shareUrl = '';
    export let savedTwitchChannel = '';
    export let twitchChannelDraft = '';
    export let twitchChannelError = '';
    export let isSavingTwitchChannel = false;
    export let isCopyingShareUrl = false;
    export let viewerCount = 0;
    export let originalVideoTitle = '';
    export let onSaveChannel = () => {};
    export let onCopy = () => {};

    const fieldClass =
        'w-full rounded-xl border border-border-strong/40 bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30';
    const secondaryButtonClass =
        'shrink-0 whitespace-nowrap rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60';
    const primaryButtonClass =
        'flex items-center justify-center rounded-xl bg-accent-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60';
</script>

<Modal
    bind:open
    autoclose={false}
    color="none"
    class="!bg-surface !text-text-primary border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
    bodyClass="relative bg-transparent p-6 sm:p-8"
>
    <div class="space-y-5 pe-8 text-text-primary" data-testid="share-session-modal">
        <div>
            <h3 class="text-lg font-semibold text-text-primary">
                Share Your Reaction Session
            </h3>
            <p class="mt-1 text-sm text-text-muted">
                Share this link so collaborators can watch your reaction live.
                Playback stays in sync with your controls.
            </p>
        </div>

        {#if savedTwitchChannel}
            <p class="text-sm text-text-secondary" data-testid="share-twitch-channel-note">
                Copy sends viewers to
                <span class="font-semibold text-text-primary">twitch.tv/{savedTwitchChannel}</span>.
                Change it in your
                <a
                    class="text-accent-primary underline hover:text-accent-primary/80"
                    href="/account/edit#twitch-channel"
                >account details</a>.
            </p>
        {:else}
            <div class="space-y-2">
                <label class="text-sm font-medium text-text-primary" for="share-twitch-channel">
                    Twitch channel
                </label>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                        id="share-twitch-channel"
                        type="text"
                        bind:value={twitchChannelDraft}
                        placeholder="yourchannel or twitch.tv/yourchannel"
                        autocomplete="off"
                        spellcheck="false"
                        class={fieldClass}
                        aria-invalid={twitchChannelError ? 'true' : 'false'}
                        on:keydown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onSaveChannel();
                            }
                        }}
                    />
                    <button
                        type="button"
                        class={secondaryButtonClass}
                        on:click={onSaveChannel}
                        disabled={isSavingTwitchChannel}
                    >
                        {isSavingTwitchChannel ? 'Saving…' : 'Save channel'}
                    </button>
                </div>
                <p class="text-xs text-text-muted">
                    Not set yet. Add it here, or in your
                    <a
                        class="text-accent-primary underline hover:text-accent-primary/80"
                        href="/account/edit#twitch-channel"
                    >account details</a>.
                </p>
            </div>
        {/if}

        {#if twitchChannelError}
            <p class="text-sm text-danger" role="alert">{twitchChannelError}</p>
        {/if}

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
                type="text"
                value={shareUrl}
                readonly
                class={`${fieldClass} font-mono`}
                aria-label="Share session link"
            />
            <button
                type="button"
                class={primaryButtonClass}
                on:click={onCopy}
                disabled={isCopyingShareUrl}
                data-testid="share-copy"
            >
                {isCopyingShareUrl ? 'Copying…' : 'Copy'}
            </button>
        </div>

        <div class="grid gap-2 text-xs text-text-muted">
            <p>👥 Viewers: {viewerCount}</p>
            <p>📹 Video: {originalVideoTitle}</p>
        </div>
    </div>
</Modal>

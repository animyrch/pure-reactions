<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import { BookmarkOutline, BookmarkSolid } from 'flowbite-svelte-icons';

    export let slug;
    export let isText = false;

    let bookmarks;
    $: bookmarks = $userExtraDataStore.userExtraData?.bookmarks;
    $: isBookmarked = bookmarks?.includes(slug);
    $: actionLabel = isBookmarked ? 'Remove this reaction from my bookmarks' : 'Add this reaction to my bookmarks';
    $: tooltipLabel = isBookmarked ? 'Remove bookmark' : 'Add bookmark';

    const onBookmarkReactionBinome = () => {
        userExtraDataStore.addBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };

    const onUnbookmarkReactionBinome = () => {
        userExtraDataStore.removeBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };
</script>

<div class={isText ? 'w-full' : 'inline-flex'}>
    {#if isText}
        <ReactionAction
            buttonText={actionLabel}
            on:change={isBookmarked ? onUnbookmarkReactionBinome : onBookmarkReactionBinome}
            className="w-full justify-start gap-2 text-sm font-medium hover:text-accent-primary focus-visible:ring-0 focus-visible:outline-none focus-visible:text-accent-primary"
        >
            <span class="flex gap-2">
                {#if isBookmarked}
                    <span>Remove Bookmark</span>
                    <BookmarkSolid class="h-4 w-4 text-accent-primary" aria-hidden="true" />
                {:else}
                    <span>Add Bookmark</span>
                    <BookmarkOutline class="h-4 w-4 text-text-primary" aria-hidden="true" />
                {/if}
            </span>
        </ReactionAction>
    {:else}
        <ReactionAction
            buttonText={actionLabel}
            tooltip={tooltipLabel}
            iconOnly={true}
            ariaLabel={tooltipLabel}
            pressed={isBookmarked}
            on:change={isBookmarked ? onUnbookmarkReactionBinome : onBookmarkReactionBinome}
        >
            {#if isBookmarked}
                <BookmarkSolid class="h-6 w-6 text-accent-primary transition-colors duration-subtle ease-cinematic group-hover:text-accent-primary" aria-hidden="true" />
            {:else}
                <BookmarkOutline class="h-6 w-6 text-text-primary transition-colors duration-subtle ease-cinematic group-hover:text-accent-primary" aria-hidden="true" />
            {/if}
        </ReactionAction>
    {/if}
</div>
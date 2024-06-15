<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import { BookmarkOutline, BookmarkSolid } from 'flowbite-svelte-icons';

    export let slug;
    export let isText = false;

    let bookmarks;
    $: bookmarks = $userExtraDataStore.userExtraData?.bookmarks;

    const onBookmarkReactionBinome = () => {
        userExtraDataStore.addBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };

    const onUnbookmarkReactionBinome = () => {
        userExtraDataStore.removeBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };
</script>

<div class="h-4">
    {#if bookmarks?.includes(slug)}
        <ReactionAction
            buttonText="Remove from bookmarks"
            on:change={onUnbookmarkReactionBinome}
        >
            {#if isText}
                <span>Remove Bookmark</span>
            {:else}
                <BookmarkSolid class="h-4 text-red-700" />
            {/if}
        </ReactionAction>
    {:else}
        <ReactionAction
            buttonText="Add this reaction to my bookmarks"
            on:change={onBookmarkReactionBinome}
        >
            {#if isText}
                <span>Add Bookmark</span>
            {:else}
                <BookmarkOutline class="h-4 text-gray-800" />
            {/if}
        </ReactionAction>
    {/if}
</div>
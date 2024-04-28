<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import { BookmarkOutline, BookmarkSolid } from 'flowbite-svelte-icons';

    export let bookmarks;
    export let slug;

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
            <BookmarkSolid class="h-4 text-red-700" />
        </ReactionAction>
    {:else}
        <ReactionAction
            buttonText="Add this reaction to my bookmarks"
            on:change={onBookmarkReactionBinome}
        >           
            <BookmarkOutline class="h-4 text-gray-800" />
        </ReactionAction>
    {/if}
</div>
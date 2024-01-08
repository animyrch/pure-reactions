<script>
    import Bookmark from "$lib/icons/Bookmark.svelte";
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import ReactionAction from "$lib/components/ReactionAction.svelte";

    export let bookmarks;
    export let slug;

    const onBookmarkReactionBinome = () => {
        userExtraDataStore.addBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };

    const onUnbookmarkReactionBinome = () => {
        userExtraDataStore.removeBookmark($userExtraDataStore.userExtraData, $currentUser?.uid, slug);
    };
</script>

<div>
    {#if bookmarks?.includes(slug)}
        <ReactionAction
            buttonText="Remove from bookmarks"
            on:change={onUnbookmarkReactionBinome}
        >
            <Bookmark
            active={true}
            />
        </ReactionAction>
    {:else}
        <ReactionAction
            buttonText="Add this reaction to my bookmarks"
            on:change={onBookmarkReactionBinome}
        >
            <Bookmark />
        </ReactionAction>
    {/if}
</div>
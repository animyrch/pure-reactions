<script>
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { isLoggedIn } from '$lib/stores/user';
    import BookmarkListElement from "$lib/components/BookmarkListElement.svelte";
</script>

<div>
    {#if $isLoggedIn}
        {#if $userExtraDataStore.userExtraData?.bookmarks}
            {#each $userExtraDataStore.userExtraData?.bookmarks as reactionBinomeId}
                <BookmarkListElement {reactionBinomeId} />
            {/each}
        {/if}
    {:else}{handlePrivateRoute()}{/if}
</div>
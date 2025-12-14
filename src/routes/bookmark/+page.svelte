<script>
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { isLoggedIn } from '$lib/stores/user';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import { getReactionsByIds } from '$lib/helpers/firebase';

    let reactions = [];
    let isLoading = false;

    const loadReactions = async () => {
        isLoading = true; 
		reactions = [];
        const result = await getReactionsByIds($userExtraDataStore.userExtraData?.bookmarks);
        reactions = Array.isArray(result) ? result : [];
        isLoading = false; 
	};
    $: if ($userExtraDataStore.userExtraData?.bookmarks && $userExtraDataStore.userExtraData.bookmarks.length > 0) {
        loadReactions();
    }
</script>

<div>
    {#if $isLoggedIn}
        {#if $userExtraDataStore.userExtraData?.bookmarks}
            {#if isLoading}
                <div>Loading...</div>
            {:else}
                <ReactionsList {reactions}/>
            {/if}
        {/if}
    {:else}{handlePrivateRoute()}{/if}
</div>
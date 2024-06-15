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
		reactions = []
        reactions = await getReactionsByIds($userExtraDataStore.userExtraData?.bookmarks);
        isLoading = false; 
	};
    $: if ($userExtraDataStore.userExtraData?.bookmarks) {
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
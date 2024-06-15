<script>
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { isLoggedIn } from '$lib/stores/user';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import { getReactionsByIds } from '$lib/helpers/firebase';

    let reactions = [];
    const loadReactions = async () => {
		reactions = []
		setTimeout(async () => {
			reactions = await getReactionsByIds($userExtraDataStore.userExtraData?.bookmarks);
		}, 100);
	};
    $: if ($userExtraDataStore.userExtraData?.bookmarks) {
        loadReactions();
    }
</script>

<div>
    {#if $isLoggedIn}
        {#if $userExtraDataStore.userExtraData?.bookmarks}
            <ReactionsList {reactions}/>
        {/if}
    {:else}{handlePrivateRoute()}{/if}
</div>
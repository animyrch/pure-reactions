<script>
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { isLoggedIn, currentUser } from '$lib/stores/user';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import { getReactionsByIds, getUserQueues } from '$lib/helpers/firebase';
	import { page } from '$app/stores';

    let reactions = [];
    let queues = [];
    let isLoading = false;
    let isLoadingQueues = false;
    let lastQueuesUserId = '';
    let hasLoadedQueues = false;

    $: authedUserId = $page?.data?.userId || $currentUser?.uid;

    const loadReactions = async () => {
        isLoading = true; 
		reactions = [];
        const result = await getReactionsByIds($userExtraDataStore.userExtraData?.bookmarks);
        reactions = Array.isArray(result) ? result : [];
        isLoading = false; 
	};

    const loadQueues = async () => {
        if (!authedUserId) return;
        if (isLoadingQueues) return;
        if (hasLoadedQueues && lastQueuesUserId === authedUserId) return;
        isLoadingQueues = true;
        try {
            const result = await getUserQueues(authedUserId);
            queues = Array.isArray(result) ? result : [];
            lastQueuesUserId = authedUserId;
            hasLoadedQueues = true;
        } finally {
            isLoadingQueues = false;
        }
    };

    $: if (Array.isArray($userExtraDataStore.userExtraData?.bookmarks) && $userExtraDataStore.userExtraData.bookmarks.length > 0) {
        loadReactions();
    } else {
        reactions = [];
    }

    $: if ($isLoggedIn && authedUserId) {
        loadQueues();
    }
</script>

<div>
    {#if $isLoggedIn}
        <div class="mb-10">
            <div class="mb-4">
                <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Queues</p>
                <h2 class="mt-1 text-lg font-semibold text-text-primary">Your queues</h2>
            </div>
            {#if isLoadingQueues}
                <div>Loading...</div>
            {:else if queues.length}
                <ReactionsList reactions={queues} />
            {:else}
                <div class="text-sm text-text-muted">No queues yet.</div>
            {/if}
        </div>

        {#if $userExtraDataStore.userExtraData?.bookmarks}
            <div class="mb-4">
                <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Bookmarks</p>
                <h2 class="mt-1 text-lg font-semibold text-text-primary">Saved reactions</h2>
            </div>
            {#if isLoading}
                <div>Loading...</div>
            {:else}
                <ReactionsList {reactions}/>
            {/if}
        {/if}
    {:else}{handlePrivateRoute()}{/if}
</div>
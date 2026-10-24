<script>
    import PersonalPage from "$lib/components/PersonalPage.svelte";
    import PersonalListSection from "$lib/components/PersonalListSection.svelte";
    import { userExtraDataStore } from "$lib/stores/userExtraData";
    import { isLoggedIn, currentUser } from "$lib/stores/user";
    import { getPlaylist, getReactionsByIds, getUserQueues } from "$lib/helpers/firebase";
    import { attachQueueCovers } from "$lib/helpers/queueCover";
    import { page } from "$app/stores";

    let reactions = [];
    let queues = [];
    let isLoading = false;
    let isLoadingQueues = false;
    let lastQueuesUserId = "";
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
            const list = Array.isArray(result) ? result : [];
            try {
                queues = await attachQueueCovers(list, { getReactionsByIds, getPlaylist });
            } catch (error) {
                console.error('Failed to load queue covers', error);
                queues = list;
            }
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

<PersonalPage>
    <PersonalListSection
        eyebrow="Queues"
        loading={isLoadingQueues}
        items={queues}
        empty="No queues yet."
    />

    {#if $userExtraDataStore.userExtraData?.bookmarks}
        <PersonalListSection
            eyebrow="Bookmarks"
            loading={isLoading}
            items={reactions}
            emptyMessage={false}
            sectionClass=""
        />
    {/if}
</PersonalPage>

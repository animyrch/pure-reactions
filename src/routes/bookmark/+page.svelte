<script>
    import { onDestroy } from "svelte";
    import PageBackLink from "$lib/components/PageBackLink.svelte";
    import PersonalPage from "$lib/components/PersonalPage.svelte";
    import PersonalListSection from "$lib/components/PersonalListSection.svelte";
    import { userExtraDataStore } from "$lib/stores/userExtraData";
    import { isLoggedIn, currentUser } from "$lib/stores/user";
    import { getPlaylist, getReactionsByIds, getUserQueues } from "$lib/helpers/firebase";
    import { deleteOwnedContent } from "$lib/helpers/deleteOwnedContent";
    import { attachQueueCovers } from "$lib/helpers/queueCover";
    import { showToast } from "$lib/stores/toast";
    import { TOASTS } from "$lib/constants/toasts";
    import { page } from "$app/stores";

    let reactions = [];
    let queues = [];
    let isLoading = false;
    let isLoadingQueues = false;
    let lastQueuesUserId = "";
    let hasLoadedQueues = false;
    let destroyed = false;
    let deleteDialog;
    let pendingDelete = null;
    let isDeleting = false;
    let deleteError = "";
    const deletedQueueIds = new Set();

    onDestroy(() => {
        destroyed = true;
    });

    $: authedUserId = $page?.data?.userId || $currentUser?.uid;

    const queueTitle = (item) => {
        const title = item?.data?.title;
        return (typeof title === "string" && title.trim()) || "this queue";
    };

    const askDelete = (item) => {
        if (item?.type !== "queue" || !item?.id || isDeleting) return;
        pendingDelete = item;
        deleteError = "";
        deleteDialog?.showModal();
    };

    const closeDeleteDialog = () => {
        pendingDelete = null;
        deleteError = "";
        isDeleting = false;
        if (deleteDialog?.open) deleteDialog.close();
    };

    const handleDialogCancel = (event) => {
        if (isDeleting) event.preventDefault();
    };

    const handleDialogClose = () => {
        if (isDeleting) return;
        pendingDelete = null;
        deleteError = "";
    };

    const confirmDelete = async () => {
        const target = pendingDelete;
        if (!target?.id || isDeleting) return;

        isDeleting = true;
        deleteError = "";
        try {
            await deleteOwnedContent({ kind: "queue", id: target.id });
            if (destroyed) return;
            deletedQueueIds.add(target.id);
            queues = queues.filter((queue) => queue.id !== target.id);
            showToast("Queue deleted.", TOASTS.SUCCESS);
            closeDeleteDialog();
        } catch (error) {
            console.error("Failed to delete queue", error);
            if (destroyed) return;
            deleteError = error?.message || "Could not delete this.";
            showToast(deleteError, TOASTS.WARNING);
            isDeleting = false;
        }
    };

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
            const list = (Array.isArray(result) ? result : []).filter(
                (queue) => !deletedQueueIds.has(queue.id)
            );
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

<PageBackLink path="/bookmark" />

<PersonalPage>
    <PersonalListSection
        eyebrow="Queues"
        loading={isLoadingQueues}
        items={queues}
        empty="No queues yet."
        onDelete={askDelete}
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

    <dialog
        bind:this={deleteDialog}
        class="w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-surface p-6 text-text-primary shadow-elevated backdrop:bg-black/60"
        aria-labelledby="delete-queue-title"
        on:cancel={handleDialogCancel}
        on:close={handleDialogClose}
    >
        <h2 id="delete-queue-title" class="text-lg font-semibold">Delete this queue?</h2>
        <p class="mt-3 text-sm text-text-muted">
            {queueTitle(pendingDelete)} will be removed. The reactions in it stay. This cannot be undone.
        </p>
        {#if deleteError}
            <p class="mt-3 text-sm text-red-400">{deleteError}</p>
        {/if}
        <div class="mt-6 flex justify-end gap-3">
            <button
                type="button"
                class="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                on:click={closeDeleteDialog}
                disabled={isDeleting}
            >
                Cancel
            </button>
            <button
                type="button"
                class="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                on:click={confirmDelete}
                disabled={isDeleting}
            >
                {isDeleting ? "Deleting…" : "Delete"}
            </button>
        </div>
    </dialog>
</PersonalPage>

<script>
	import { onDestroy } from 'svelte';
	import { getUserReactions, getUserPlaylists } from '$lib/helpers/firebase';
	import { deleteOwnedContent } from '$lib/helpers/deleteOwnedContent';
    import PageBackLink from '$lib/components/PageBackLink.svelte';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
	import ReactionFilters from '$lib/components/Navigation/ReactionFilters.svelte';
	import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isLoggedIn } from '$lib/stores/user';
	import { FILTERS, TYPE_FILTERS } from '$lib/constants/filters';
	import { showToast } from '$lib/stores/toast';
	import { TOASTS } from '$lib/constants/toasts';
	import { page } from '$app/stores';

	export let data;

	let destroyed = false;
	let loadTimeout;

	onDestroy(() => {
		destroyed = true;
		clearTimeout(loadTimeout);
	});

	let combinedItems = [];
	let isLoading = false;
	let deleteDialog;
	let pendingDelete = null;
	let isDeleting = false;
	let deleteError = '';
	const deletedKeys = new Set();

	const itemKey = (item) =>
		`${item?.type === 'playlist' ? 'playlist' : 'reaction'}:${item?.id || ''}`;

	const itemTitle = (item) => {
		const data = item?.data || {};
		return (
			(typeof data.customReactionTitle === 'string' && data.customReactionTitle.trim()) ||
			(typeof data.reactionVideoTitle === 'string' && data.reactionVideoTitle.trim()) ||
			(typeof data.originalVideoTitle === 'string' && data.originalVideoTitle.trim()) ||
			(item?.type === 'playlist' ? 'this playlist' : 'this reaction')
		);
	};

	$: pendingIsPlaylist = pendingDelete?.type === 'playlist';
	
	$: publishedFilter = $page.url.searchParams.get("published") || FILTERS.ALL;
	$: typeFilter = $page.url.searchParams.get("type") || TYPE_FILTERS.ALL;

	const askDelete = (item) => {
		if (!item?.id || isDeleting) return;
		pendingDelete = item;
		deleteError = '';
		deleteDialog?.showModal();
	};

	const closeDeleteDialog = () => {
		pendingDelete = null;
		deleteError = '';
		isDeleting = false;
		if (deleteDialog?.open) deleteDialog.close();
	};

	const handleDialogCancel = (event) => {
		if (isDeleting) event.preventDefault();
	};

	const handleDialogClose = () => {
		if (isDeleting) return;
		pendingDelete = null;
		deleteError = '';
	};

	const confirmDelete = async () => {
		const target = pendingDelete;
		if (!target?.id || isDeleting) return;

		const kind = target.type === 'playlist' ? 'playlist' : 'reaction';
		isDeleting = true;
		deleteError = '';
		try {
			await deleteOwnedContent({ kind, id: target.id });
			if (destroyed) return;
			deletedKeys.add(itemKey(target));
			combinedItems = combinedItems.filter((item) => itemKey(item) !== itemKey(target));
			showToast(kind === 'playlist' ? 'Playlist deleted.' : 'Reaction deleted.', TOASTS.SUCCESS);
			closeDeleteDialog();
		} catch (error) {
			console.error('Failed to delete content', error);
			if (destroyed) return;
			deleteError = error?.message || 'Could not delete this.';
			showToast(deleteError, TOASTS.WARNING);
			isDeleting = false;
		}
	};

	const loadReactions = async () => {
		if (!$isLoggedIn) {
			return;
		}
        isLoading = true;
        combinedItems = [];
        clearTimeout(loadTimeout);
        loadTimeout = setTimeout(async () => {
			if (destroyed) return;
			// Load data in parallel when both are needed
			const loadReactionsPromise = (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.REACTIONS_ONLY)
				? getUserReactions(data.userId, publishedFilter)
				: Promise.resolve([]);
			
			const loadPlaylistsPromise = (typeFilter === TYPE_FILTERS.ALL || typeFilter === TYPE_FILTERS.PLAYLISTS_ONLY)
				? getUserPlaylists(data.userId, publishedFilter)
				: Promise.resolve([]);
			
			const [reactions, playlists] = await Promise.all([loadReactionsPromise, loadPlaylistsPromise]);
			
			// Transform playlists to match reaction structure
			// Filter out playlists without required data to prevent broken rendering
			const transformedPlaylists = playlists
				.filter(playlist => playlist.firstReactionBinomeData)
				.map(playlist => ({
					id: playlist.id,
					type: 'playlist',
					data: {
						playlistId: playlist.id,
						reactionVideoId: playlist.firstReactionBinomeData.reactionVideoId,
						originalVideoId: playlist.firstReactionBinomeData.originalVideoId,
						reactionVideoTitle: playlist.firstReactionBinomeData.reactionVideoTitle,
						customReactionTitle: playlist.firstReactionBinomeData.customReactionTitle,
						reactionVideoAuthor: playlist.firstReactionBinomeData.reactionVideoAuthor,
						originalVideoTitle: playlist.firstReactionBinomeData.originalVideoTitle,
					}
				}));

			// Combine reactions and playlists
			if (destroyed) return;
			combinedItems = [...reactions, ...transformedPlaylists].filter(
				(item) => !deletedKeys.has(itemKey(item))
			);
			isLoading = false;
        }, 100);
    }

    $: loadReactions(), publishedFilter, typeFilter;
</script>

<PageBackLink path="/my-reactions" />

{#if $isLoggedIn}
	<div>
		<ReactionFilters />
		{#if isLoading}
			<ReactionsList reactions={[]} loading={true} />
		{:else}
			<ReactionsList reactions={combinedItems} onDelete={askDelete} />
		{/if}
	</div>

	<dialog
		bind:this={deleteDialog}
		class="w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-surface p-6 text-text-primary shadow-elevated backdrop:bg-black/60"
		aria-labelledby="delete-content-title"
		on:cancel={handleDialogCancel}
		on:close={handleDialogClose}
	>
		<h2 id="delete-content-title" class="text-lg font-semibold">
			{pendingIsPlaylist ? 'Delete this playlist?' : 'Delete this reaction?'}
		</h2>
		<p class="mt-3 text-sm text-text-muted">
			{#if pendingIsPlaylist}
				{itemTitle(pendingDelete)} and the reactions in it will be removed. This cannot be undone.
			{:else}
				{itemTitle(pendingDelete)} will be removed. This cannot be undone.
			{/if}
		</p>
		{#if deleteError}
			<p class="mt-3 text-sm text-red-400">{deleteError}</p>
		{/if}
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
				on:click={closeDeleteDialog}
				disabled={isDeleting}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
				on:click={confirmDelete}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting…' : 'Delete'}
			</button>
		</div>
	</dialog>
{:else}{handlePrivateRoute()}{/if}
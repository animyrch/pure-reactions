<script>
	import { onDestroy, onMount } from 'svelte';
	import { Button } from 'flowbite-svelte';
	import { DotsVerticalOutline } from 'flowbite-svelte-icons';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import ReactionAction from '$lib/components/ReactionAction.svelte';
	import BookmarkManagement from '../BookmarkManagement.svelte';
	import { TOASTS } from '$lib/constants/toasts';
	import { getUserQueues, upsertReactionIntoQueue, removeReactionFromQueue } from '$lib/helpers/firebase';
	import { handlePrivateRoute } from '$lib/helpers/routing';
	import { showToast } from '$lib/stores/toast';
	import { currentUser } from '$lib/stores/user';

	export let reactionPageId;
	export let reactionVideoAuthor;

	const fallbackSuffix = Math.random().toString(36).slice(2, 8);
	const menuOpenEventName = 'thumbnail-context-open';

	let userQueues = [];
	let selectedQueueSlug = '';
	let newQueueName = '';
	let statusMessage = '';
	let isLoadingQueues = false;
	let isSavingQueue = false;
	let hasLoadedQueues = false;
	let isOpen = false;
	let isQueuesSectionOpen = false;
	let menuEl;

	$: buttonId = reactionPageId ? `offset-${reactionPageId}` : `offset-fallback-${fallbackSuffix}`;
	$: inputId = `queue-new-${buttonId}`;
	$: authedUserId = $page?.data?.userId || $currentUser?.uid;
	$: queuesWithReaction = userQueues.map((queue) => {
		const items = Array.isArray(queue?.data?.items) ? queue.data.items : [];
		const hasReaction = items.some((item) => item?.type === 'reaction' && item?.id === reactionPageId);
		return { ...queue, hasReaction };
	});

	// Auto-load queues once the user id becomes available or when menu opens
	$: if (authedUserId && !hasLoadedQueues && !isLoadingQueues && isOpen) {
		loadUserQueues(false);
	}

	const handleOpenYoutubePage = () => {
		if (!reactionVideoAuthor || typeof window === 'undefined') return;
		window.open(`https://www.youtube.com/${reactionVideoAuthor}`, '_blank', 'noopener');
	};

	const handleOpenReactorPage = () => {
		if (!reactionVideoAuthor) return;
		goto(`/reactor/${reactionVideoAuthor}`);
	};

	const ensureUserId = (redirectOnFail = true) => {
		const uid = authedUserId;
		if (!uid && redirectOnFail) {
			handlePrivateRoute();
		}
		return uid || null;
	};

	const loadUserQueues = async (redirectOnFail = false) => {
		const uid = ensureUserId(redirectOnFail);
		if (!uid) {
			statusMessage = 'Sign in to manage queues.';
			return;
		}
		isLoadingQueues = true;
		statusMessage = '';
		try {
			userQueues = await getUserQueues(uid);
			if (!selectedQueueSlug && userQueues?.[0]?.id) {
				selectedQueueSlug = userQueues[0].id;
			}
			hasLoadedQueues = true;
		} catch (error) {
			console.error('Failed to fetch queues', error);
			statusMessage = 'Could not load your queues.';
		} finally {
			isLoadingQueues = false;
		}
	};

	const handleAddToQueue = async () => {
		const uid = ensureUserId(true);
		if (!uid) return;

		const targetName = newQueueName?.trim();
		if (!targetName) {
			statusMessage = 'Enter a new queue name.';
			return;
		}

		isSavingQueue = true;
		statusMessage = '';
		try {
			const result = await upsertReactionIntoQueue({
				nameOrSlug: targetName,
				reactionId: reactionPageId,
				userId: uid
			});

			if (result?.created) {
				showToast('Queue created and reaction added.', TOASTS.SUCCESS);
				await loadUserQueues(false);
				newQueueName = '';
			} else {
				showToast('Reaction added to queue.', TOASTS.SUCCESS);
			}
		} catch (error) {
			console.error('Failed to add reaction to queue', error);
			statusMessage = error?.message || 'Could not add to queue.';
			showToast(statusMessage, TOASTS.ERROR);
		} finally {
			isSavingQueue = false;
		}
	};

	const handleToggleQueueMembership = async (queueSlug, currentlyHasReaction) => {
		const uid = ensureUserId(true);
		if (!uid) return;

		isSavingQueue = true;
		statusMessage = '';
		try {
			if (currentlyHasReaction) {
				await removeReactionFromQueue({
					queueSlug,
					reactionId: reactionPageId,
					userId: uid
				});
				showToast('Reaction removed from queue.', TOASTS.SUCCESS);
			} else {
				await upsertReactionIntoQueue({
					nameOrSlug: queueSlug,
					reactionId: reactionPageId,
					userId: uid
				});
				showToast('Reaction added to queue.', TOASTS.SUCCESS);
			}
			await loadUserQueues(false);
		} catch (error) {
			console.error('Failed to update queue membership', error);
			statusMessage = error?.message || 'Could not update queue.';
			showToast(statusMessage, TOASTS.ERROR);
		} finally {
			isSavingQueue = false;
		}
	};

	const closeMenu = () => {
		isOpen = false;
		isQueuesSectionOpen = false;
	};

	const toggleMenu = (event) => {
		event?.stopPropagation?.();
		isOpen = !isOpen;

		if (isOpen && typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent(menuOpenEventName, { detail: buttonId }));
		}

		// Opportunistic load when opening the menu
		if (!isOpen && authedUserId && !hasLoadedQueues && !isLoadingQueues) {
			loadUserQueues(false);
		}
	};

	const handleAnotherMenuOpen = (event) => {
		if (event?.detail && event.detail !== buttonId) {
			closeMenu();
		}
	};

	const handleClickOutside = (event) => {
		if (!menuEl) return;
		if (!menuEl.contains(event.target)) {
			closeMenu();
		}
	};

	const handleEscape = (event) => {
		if (event.key === 'Escape') {
			closeMenu();
		}
	};

	onMount(() => {
		loadUserQueues(false);
		window.addEventListener('click', handleClickOutside);
		window.addEventListener('keydown', handleEscape);
		window.addEventListener(menuOpenEventName, handleAnotherMenuOpen);
	});

	onDestroy(() => {
		window.removeEventListener('click', handleClickOutside);
		window.removeEventListener('keydown', handleEscape);
		window.removeEventListener(menuOpenEventName, handleAnotherMenuOpen);
	});
</script>

<div class="context-wrapper" bind:this={menuEl}>
	<Button
		color="white"
		outline="true"
		id={buttonId}
		on:click={toggleMenu}
		aria-expanded={isOpen}
		aria-controls={`menu-${buttonId}`}
	>
		<DotsVerticalOutline size="md" />
	</Button>
	{#if isOpen}
		<ul
			id={`menu-${buttonId}`}
			class="menu-panel"
			role="menu"
			aria-label="Thumbnail actions"
			on:click|stopPropagation
		>
			{#if reactionVideoAuthor}
				<li>
					<ReactionAction
						buttonText="Open Youtube Page"
						className="w-full justify-start rounded-sm px-sm py-1 text-left text-text-primary hover:text-accent-primary focus-visible:ring-0 focus-visible:outline-none focus-visible:text-accent-primary"
						on:change={handleOpenYoutubePage}
					/>
				</li>
				<li>
					<ReactionAction
						buttonText="Open Reactor Page"
						className="w-full justify-start rounded-sm px-sm py-1 text-left text-text-primary hover:text-accent-primary focus-visible:ring-0 focus-visible:outline-none focus-visible:text-accent-primary"
						on:change={handleOpenReactorPage}
					/>
				</li>
			{/if}
			<li>
				<BookmarkManagement slug={reactionPageId} isText={true} />
			</li>
			<li class="mt-1 border-t border-white/10 pt-2">
				<button
					type="button"
					class="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm font-semibold uppercase tracking-[0.2em] text-text-muted hover:text-text-primary"
					on:click={() => (isQueuesSectionOpen = !isQueuesSectionOpen)}
					aria-expanded={isQueuesSectionOpen}
					aria-controls={`sets-panel-${buttonId}`}
				>
					<span>Queues</span>
					<span class="text-base">{isQueuesSectionOpen ? '▾' : '▸'}</span>
				</button>

				{#if isQueuesSectionOpen}
					<div id={`sets-panel-${buttonId}`} class="mt-2" transition:slide>
						<div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
							<span>Add to queue</span>
							{#if !hasLoadedQueues && !isLoadingQueues}
								<button class="text-[11px] font-semibold text-accent-primary" type="button" on:click={() => loadUserQueues(true)}>
									Load
								</button>
							{/if}
						</div>

						{#if statusMessage}
							<p class="mt-2 text-xs text-warning">{statusMessage}</p>
						{/if}

						{#if isLoadingQueues}
							<p class="mt-2 text-xs text-text-muted">Loading your queues…</p>
						{:else}
							{#if authedUserId}
								<div class="mt-2 flex items-center justify-between">
									<p class="text-xs text-text-muted">Your queues</p>
									<button class="text-[11px] font-semibold text-accent-primary" type="button" on:click={() => loadUserQueues(false)} disabled={isLoadingQueues}>
										Refresh
									</button>
								</div>

								{#if queuesWithReaction?.length}
									<div class="mt-1 space-y-1">
										{#each queuesWithReaction as queue}
											<button
												type="button"
												class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-white/5"
												on:click={() => handleToggleQueueMembership(queue.id, queue.hasReaction)}
												disabled={isSavingQueue}
											>
												<span class="truncate">{queue?.data?.title || queue.id}</span>
												<span class="ml-2 flex-shrink-0">
													{#if queue.hasReaction}
														<span class="text-accent-primary">✓</span>
													{:else}
														<span class="text-text-muted">+</span>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								{:else}
									<p class="mt-2 text-xs text-text-muted">No queues yet. Create one below.</p>
								{/if}

								<label class="mt-3 block text-xs text-text-muted" for={inputId}>Create new queue</label>
								<input
									id={inputId}
									class="w-full rounded-sm border border-white/10 bg-white/5 p-2 text-sm text-text-primary"
									placeholder="New queue name"
									bind:value={newQueueName}
								/>

								<button
									class="mt-2 w-full rounded-sm bg-accent-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
									type="button"
									on:click={handleAddToQueue}
									disabled={isSavingQueue || !newQueueName?.trim()}
								>
									{isSavingQueue ? 'Saving…' : 'Create & add to queue'}
								</button>
							{:else}
								<button class="mt-2 w-full rounded-sm bg-accent-primary px-3 py-2 text-sm font-semibold text-white" type="button" on:click={() => handlePrivateRoute()}>
									Sign in to save to a queue
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			</li>
		</ul>
	{/if}
</div>

<style>
	.context-wrapper {
		position: relative;
		display: inline-block;
	}

	.menu-panel {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 220px;
		max-width: min(320px, 90vw);
		z-index: 1000;
		border-radius: 0.75rem;
		background: rgba(12, 16, 24, 0.96);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 18px 40px rgba(5, 8, 12, 0.35);
		padding: 0.5rem 0.5rem 0.75rem;
		backdrop-filter: blur(8px);
	}

	@media (max-width: 640px) {
		.menu-panel {
			left: 0;
			right: auto;
		}
	}
</style>

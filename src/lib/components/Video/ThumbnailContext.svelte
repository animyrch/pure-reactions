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
	import { getUserSets, upsertReactionIntoSet, removeReactionFromSet } from '$lib/helpers/firebase';
	import { handlePrivateRoute } from '$lib/helpers/routing';
	import { showToast } from '$lib/stores/toast';
	import { currentUser } from '$lib/stores/user';

	export let reactionPageId;
	export let reactionVideoAuthor;

	const fallbackSuffix = Math.random().toString(36).slice(2, 8);
	const menuOpenEventName = 'thumbnail-context-open';

	let userSets = [];
	let selectedSetSlug = '';
	let newSetName = '';
	let statusMessage = '';
	let isLoadingSets = false;
	let isSavingSet = false;
	let hasLoadedSets = false;
	let isOpen = false;
	let isSetsSectionOpen = false;
	let menuEl;

	$: buttonId = reactionPageId ? `offset-${reactionPageId}` : `offset-fallback-${fallbackSuffix}`;
	$: selectId = `set-select-${buttonId}`;
	$: inputId = `set-new-${buttonId}`;
	$: authedUserId = $page?.data?.userId || $currentUser?.uid;
	$: setsWithReaction = userSets.map((set) => {
		const items = Array.isArray(set?.data?.items) ? set.data.items : [];
		const hasReaction = items.some((item) => item?.type === 'reaction' && item?.id === reactionPageId);
		return { ...set, hasReaction };
	});

	// Auto-load sets once the user id becomes available or when menu opens
	$: if (authedUserId && !hasLoadedSets && !isLoadingSets && isOpen) {
		loadUserSets(false);
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

	const loadUserSets = async (redirectOnFail = false) => {
		const uid = ensureUserId(redirectOnFail);
		if (!uid) {
			statusMessage = 'Sign in to manage sets.';
			return;
		}
		isLoadingSets = true;
		statusMessage = '';
		try {
			userSets = await getUserSets(uid);
			if (!selectedSetSlug && userSets?.[0]?.id) {
				selectedSetSlug = userSets[0].id;
			}
			hasLoadedSets = true;
		} catch (error) {
			console.error('Failed to fetch sets', error);
			statusMessage = 'Could not load your sets.';
		} finally {
			isLoadingSets = false;
		}
	};

	const handleAddToSet = async () => {
		const uid = ensureUserId(true);
		if (!uid) return;

		const targetName = newSetName?.trim();
		if (!targetName) {
			statusMessage = 'Enter a new set name.';
			return;
		}

		isSavingSet = true;
		statusMessage = '';
		try {
			const result = await upsertReactionIntoSet({
				nameOrSlug: targetName,
				reactionId: reactionPageId,
				userId: uid
			});

			if (result?.created) {
				showToast('Set created and reaction added.', TOASTS.SUCCESS);
				await loadUserSets(false);
				newSetName = '';
			} else {
				showToast('Reaction added to set.', TOASTS.SUCCESS);
			}
		} catch (error) {
			console.error('Failed to add reaction to set', error);
			statusMessage = error?.message || 'Could not add to set.';
			showToast(statusMessage, TOASTS.ERROR);
		} finally {
			isSavingSet = false;
		}
	};

	const handleToggleSetMembership = async (setSlug, currentlyHasReaction) => {
		const uid = ensureUserId(true);
		if (!uid) return;

		isSavingSet = true;
		statusMessage = '';
		try {
			if (currentlyHasReaction) {
				await removeReactionFromSet({
					setSlug,
					reactionId: reactionPageId,
					userId: uid
				});
				showToast('Reaction removed from set.', TOASTS.SUCCESS);
			} else {
				await upsertReactionIntoSet({
					nameOrSlug: setSlug,
					reactionId: reactionPageId,
					userId: uid
				});
				showToast('Reaction added to set.', TOASTS.SUCCESS);
			}
			await loadUserSets(false);
		} catch (error) {
			console.error('Failed to update set membership', error);
			statusMessage = error?.message || 'Could not update set.';
			showToast(statusMessage, TOASTS.ERROR);
		} finally {
			isSavingSet = false;
		}
	};

	const closeMenu = () => {
		isOpen = false;
		isSetsSectionOpen = false;
	};

	const toggleMenu = (event) => {
		event?.stopPropagation?.();
		isOpen = !isOpen;

		if (isOpen && typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent(menuOpenEventName, { detail: buttonId }));
		}

		// Opportunistic load when opening the menu
		if (!isOpen && authedUserId && !hasLoadedSets && !isLoadingSets) {
			loadUserSets(false);
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
		loadUserSets(false);
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
					on:click={() => (isSetsSectionOpen = !isSetsSectionOpen)}
					aria-expanded={isSetsSectionOpen}
					aria-controls={`sets-panel-${buttonId}`}
				>
					<span>Sets</span>
					<span class="text-base">{isSetsSectionOpen ? '▾' : '▸'}</span>
				</button>

				{#if isSetsSectionOpen}
					<div id={`sets-panel-${buttonId}`} class="mt-2" transition:slide>
						<div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
							<span>Add to set</span>
							{#if !hasLoadedSets && !isLoadingSets}
								<button class="text-[11px] font-semibold text-accent-primary" type="button" on:click={() => loadUserSets(true)}>
									Load
								</button>
							{/if}
						</div>

						{#if statusMessage}
							<p class="mt-2 text-xs text-warning">{statusMessage}</p>
						{/if}

						{#if isLoadingSets}
							<p class="mt-2 text-xs text-text-muted">Loading your sets…</p>
						{:else}
							{#if authedUserId}
								<div class="mt-2 flex items-center justify-between">
									<p class="text-xs text-text-muted">Your sets</p>
									<button class="text-[11px] font-semibold text-accent-primary" type="button" on:click={() => loadUserSets(false)} disabled={isLoadingSets}>
										Refresh
									</button>
								</div>

								{#if setsWithReaction?.length}
									<div class="mt-1 space-y-1">
										{#each setsWithReaction as set}
											<button
												type="button"
												class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-white/5"
												on:click={() => handleToggleSetMembership(set.id, set.hasReaction)}
												disabled={isSavingSet}
											>
												<span class="truncate">{set?.data?.title || set.id}</span>
												<span class="ml-2 flex-shrink-0">
													{#if set.hasReaction}
														<span class="text-accent-primary">✓</span>
													{:else}
														<span class="text-text-muted">+</span>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								{:else}
									<p class="mt-2 text-xs text-text-muted">No sets yet. Create one below.</p>
								{/if}

								<label class="mt-3 block text-xs text-text-muted" for={inputId}>Create new set</label>
								<input
									id={inputId}
									class="w-full rounded-sm border border-white/10 bg-white/5 p-2 text-sm text-text-primary"
									placeholder="New set name"
									bind:value={newSetName}
								/>

								<button
									class="mt-2 w-full rounded-sm bg-accent-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
									type="button"
									on:click={handleAddToSet}
									disabled={isSavingSet || !newSetName?.trim()}
								>
									{isSavingSet ? 'Saving…' : 'Create & add to set'}
								</button>
							{:else}
								<button class="mt-2 w-full rounded-sm bg-accent-primary px-3 py-2 text-sm font-semibold text-white" type="button" on:click={() => handlePrivateRoute()}>
									Sign in to save to a set
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

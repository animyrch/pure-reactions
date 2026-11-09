<script>
	import { auth } from '$lib/constants/firebase';
	import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
	import { updateDisplayNameHelper, updateReactorDisplayNameForUser } from '$lib/helpers/firebase';
	import { displayNameMatchesEmailLocalPart } from '$lib/helpers/publicDisplayName';
	import {
		publicDisplayNameRequest,
		settlePublicDisplayName
	} from '$lib/stores/publicDisplayNamePrompt';

	let name = '';
	let filledFor = '';
	let saving = false;
	let errorMessage = '';

	$: request = $publicDisplayNameRequest;
	$: trimmedName = name.trim();
	$: canSave = Boolean(
		request &&
			trimmedName &&
			!displayNameMatchesEmailLocalPart(trimmedName, request.email)
	);

	$: if (request && request.uid !== filledFor) {
		name = request.displayName || '';
		filledFor = request.uid;
		saving = false;
		errorMessage = '';
	}

	const reset = () => {
		name = '';
		filledFor = '';
		saving = false;
		errorMessage = '';
	};

	const dismiss = () => {
		if (saving) return;
		settlePublicDisplayName(false);
		reset();
	};

	const save = async () => {
		if (!request || !canSave || saving) return;
		saving = true;
		errorMessage = '';
		try {
			const user = auth?.currentUser;
			if (!user || user.uid !== request.uid) {
				throw new Error('Sign in again to choose a public name.');
			}
			await updateDisplayNameHelper(user, trimmedName);
			const updated = await updateReactorDisplayNameForUser({
				userId: user.uid,
				displayName: trimmedName
			});
			if (updated?.error) {
				throw new Error('Could not update the name on your reactions.');
			}
			settlePublicDisplayName(true);
			reset();
		} catch (error) {
			console.error('Could not save public display name:', error);
			errorMessage = error?.message || 'Could not save your name. The reaction was not published.';
			saving = false;
		}
	};

	const submit = (event) => {
		event.preventDefault();
		save();
	};

	const tabbableSelector = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	function trapDialogFocus(node) {
		const previouslyFocused = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;

		const focusInitial = () => {
			const input = node.querySelector('input');
			if (input instanceof HTMLElement) input.focus();
		};
		focusInitial();

		const onKeydown = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				dismiss();
				return;
			}
			if (event.key !== 'Tab') return;

			const tabbable = [...node.querySelectorAll(tabbableSelector)];
			if (tabbable.length === 0) {
				event.preventDefault();
				return;
			}

			const first = tabbable[0];
			const last = tabbable[tabbable.length - 1];
			const active = document.activeElement;
			const leavingBackward = event.shiftKey && (active === first || !node.contains(active));
			const leavingForward = !event.shiftKey && (active === last || !node.contains(active));

			if (!leavingBackward && !leavingForward) return;

			event.preventDefault();
			(leavingBackward ? last : first).focus();
		};

		document.addEventListener('keydown', onKeydown, true);
		return {
			destroy() {
				document.removeEventListener('keydown', onKeydown, true);
				if (previouslyFocused?.isConnected && !node.contains(previouslyFocused)) {
					previouslyFocused.focus();
				}
			}
		};
	}
</script>

{#if request}
	<div class="public-name-prompt" role="presentation">
		<div
			class="public-name-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="public-name-title"
			use:trapDialogFocus
		>
			<h2 id="public-name-title">Choose a public name</h2>
			<p>
				This name will be shown on the reaction you publish. Choose a name that is different from the part of your email before @.
			</p>
			<form on:submit={submit}>
				<label for="public-display-name">Display name</label>
				<input
					id="public-display-name"
					type="text"
					autocomplete="nickname"
					bind:value={name}
					disabled={saving}
					placeholder="How you appear on reactions"
				/>
				{#if errorMessage}
					<p class="public-name-error" role="alert">{errorMessage}</p>
				{/if}
				<div class="public-name-actions">
					<CinematicButton type="button" variant="muted" size="sm" disabled={saving} on:click={dismiss}>
						Not now
					</CinematicButton>
					<CinematicButton type="submit" variant="primary" size="sm" disabled={!canSave} loading={saving}>
						Save and publish
					</CinematicButton>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.public-name-prompt {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgba(5, 5, 5, 0.72);
	}

	.public-name-panel {
		width: min(100%, 28rem);
		padding: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 1rem;
		background: #141414;
		color: #f5f5f5;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	p {
		margin-top: 0.75rem;
		font-size: 0.95rem;
		line-height: 1.5;
		color: rgba(245, 245, 245, 0.78);
	}

	label {
		display: block;
		margin-top: 1rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	input {
		width: 100%;
		margin-top: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.75rem;
		background: #0c0c0c;
		color: #f5f5f5;
		padding: 0.75rem 1rem;
	}

	input:focus {
		outline: 2px solid rgba(232, 196, 160, 0.45);
		outline-offset: 1px;
	}

	input:disabled {
		opacity: 0.6;
	}

	.public-name-error {
		color: #ff8b96;
	}

	.public-name-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}
</style>

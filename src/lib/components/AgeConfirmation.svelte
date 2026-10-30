<script>
	import { ageConfirmationRequest, recordAgeConfirmation, settleAgeConfirmation } from '$lib/helpers/ageConfirmation';

	let checked = false;
	let saving = false;
	let errorMessage = '';

	$: request = $ageConfirmationRequest;

	const reset = () => {
		checked = false;
		saving = false;
		errorMessage = '';
	};

	const confirm = async () => {
		if (!request || !checked || saving) return;
		saving = true;
		errorMessage = '';
		try {
			await recordAgeConfirmation(request.userId);
			settleAgeConfirmation(true);
			reset();
		} catch (error) {
			console.error('Could not save age confirmation:', error);
			errorMessage = 'Could not save your confirmation. Try again.';
			saving = false;
		}
	};

	const dismiss = () => {
		if (saving) return;
		settleAgeConfirmation(false);
		reset();
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
			const checkbox = node.querySelector('input[type="checkbox"]');
			if (checkbox instanceof HTMLElement) checkbox.focus();
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
	<div class="age-confirmation" role="presentation">
		<div
			class="age-confirmation-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="age-confirmation-title"
			use:trapDialogFocus
		>
			<h2 id="age-confirmation-title">Confirm your age</h2>
			<p>People under 15 can't publish or edit an account. This does not store a birth date.</p>
			<label>
				<input type="checkbox" bind:checked disabled={saving} />
				<span>I am 15 or older.</span>
			</label>
			{#if errorMessage}
				<p class="age-confirmation-error" role="alert">{errorMessage}</p>
			{/if}
			<div class="age-confirmation-actions">
				<button type="button" on:click={dismiss} disabled={saving}>Not now</button>
				<button type="button" on:click={confirm} disabled={!checked || saving}>
					{saving ? 'Saving…' : 'Confirm'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.age-confirmation {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgba(5, 5, 5, 0.72);
	}

	.age-confirmation-panel {
		width: min(100%, 28rem);
		padding: 1.5rem;
		border-radius: 0.75rem;
		background: #fff;
		color: #111;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	p {
		margin-top: 0.75rem;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	label {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		margin-top: 1rem;
		font-size: 0.95rem;
	}

	.age-confirmation-error {
		color: #9f1239;
	}

	.age-confirmation-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	button {
		border-radius: 0.5rem;
		padding: 0.6rem 0.9rem;
	}

	button:last-child {
		background: #9d174d;
		color: #fff;
	}

	button:disabled {
		opacity: 0.6;
	}
</style>

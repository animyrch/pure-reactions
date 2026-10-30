<script>
	import { onMount } from 'svelte';
	import { analyticsConsent, loadAnalyticsConsent, storeAnalyticsConsent } from '$lib/helpers/analyticsConsent';

	let ready = false;

	onMount(() => {
		loadAnalyticsConsent();
		ready = true;
	});
</script>

{#if ready && $analyticsConsent === null}
	<div class="analytics-consent" role="region" aria-labelledby="analytics-consent-title">
		<p id="analytics-consent-title">This site measures visits only if you allow it.</p>
		<div class="analytics-consent-actions">
			<button type="button" on:click={() => storeAnalyticsConsent('reject')}>Reject</button>
			<button type="button" on:click={() => storeAnalyticsConsent('accept')}>Accept</button>
		</div>
	</div>
{/if}

<style>
	.analytics-consent {
		position: fixed;
		z-index: 70;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		max-width: 52rem;
		margin: 0 auto;
		padding: 1rem 1.1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.9rem;
		background: #15181f;
		color: #f5f7fa;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
	}

	p {
		max-width: 36rem;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.analytics-consent-actions {
		display: flex;
		gap: 0.6rem;
	}

	button {
		min-width: 6.5rem;
		border-radius: 999px;
		padding: 0.55rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #f5f7fa;
	}

	button:last-child {
		background: #5cb2ff;
		border-color: #5cb2ff;
		color: #0f1115;
		font-weight: 600;
	}
</style>

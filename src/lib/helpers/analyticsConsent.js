import { writable } from 'svelte/store';

export const ANALYTICS_CONSENT_KEY = 'pure-reactions:analytics-consent';

export const analyticsConsent = writable(null);

export function readStoredAnalyticsConsent() {
	if (typeof localStorage === 'undefined') return null;
	try {
		const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
		return value === 'accept' || value === 'reject' ? value : null;
	} catch {
		return null;
	}
}

export function storeAnalyticsConsent(value) {
	if (value !== 'accept' && value !== 'reject') return;
	try {
		localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
	} catch {
		// The in-memory choice still applies for this page view.
	}
	analyticsConsent.set(value);
}

export function loadAnalyticsConsent() {
	analyticsConsent.set(readStoredAnalyticsConsent());
}

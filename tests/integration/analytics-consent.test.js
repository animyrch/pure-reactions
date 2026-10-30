import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
	ANALYTICS_CONSENT_KEY,
	analyticsConsent,
	readStoredAnalyticsConsent,
	storeAnalyticsConsent
} from '../../src/lib/helpers/analyticsConsent.js';

const memory = new Map();

function installLocalStorage() {
	globalThis.localStorage = {
		getItem: (key) => (memory.has(key) ? memory.get(key) : null),
		setItem: (key, value) => memory.set(key, String(value)),
		removeItem: (key) => memory.delete(key),
		clear: () => memory.clear()
	};
}

afterEach(() => {
	memory.clear();
	analyticsConsent.set(null);
	delete globalThis.localStorage;
});

describe('analytics consent', () => {
	it('treats a missing or unknown value as no choice', () => {
		installLocalStorage();
		expect(readStoredAnalyticsConsent()).toBeNull();
		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'maybe');
		expect(readStoredAnalyticsConsent()).toBeNull();
	});

	it('stores accept and reject', () => {
		installLocalStorage();
		storeAnalyticsConsent('reject');
		expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('reject');
		expect(get(analyticsConsent)).toBe('reject');
		storeAnalyticsConsent('accept');
		expect(get(analyticsConsent)).toBe('accept');
	});
});

import { writable } from 'svelte/store';
import { needsPublicDisplayName } from '#lib/helpers/publicDisplayName.js';

export const publicDisplayNameRequest = writable(null);

let pending = null;
let activeChecks = 0;
let batch = 0;
let declinedBatch = 0;
let nameDeclined = false;

const userId = (user) => (typeof user?.uid === 'string' ? user.uid : '');

export function beginPublishNameCheck() {
	if (activeChecks === 0) {
		batch += 1;
		nameDeclined = false;
	}
	activeChecks += 1;
	return batch;
}

export function publishNameWasDeclined() {
	return nameDeclined;
}

export function endPublishNameCheck() {
	activeChecks = Math.max(0, activeChecks - 1);
}

export function ensurePublicDisplayName(user, checkBatch) {
	const uid = userId(user);
	if (!uid) return Promise.resolve(false);

	if (!needsPublicDisplayName(user?.displayName, user?.email)) return Promise.resolve(true);
	if (declinedBatch === checkBatch) return Promise.resolve(false);
	if (pending?.uid === uid) return pending.promise;

	let resolvePrompt;
	const promise = new Promise((resolve) => {
		resolvePrompt = resolve;
	});
	pending = { uid, promise, resolve: resolvePrompt };
	const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
	publicDisplayNameRequest.set({
		uid,
		email: typeof user?.email === 'string' ? user.email : '',
		displayName
	});
	return promise;
}

export function settlePublicDisplayName(accepted) {
	const current = pending;
	pending = null;
	if (!accepted) {
		declinedBatch = batch;
		nameDeclined = true;
	} else {
		nameDeclined = false;
	}
	publicDisplayNameRequest.set(null);
	current?.resolve(Boolean(accepted));
}

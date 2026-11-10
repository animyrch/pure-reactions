import { writable } from 'svelte/store';
import { doc, getDoc } from 'firebase/firestore/lite';
import { auth, COLLECTION_USER_DATA, db } from '$lib/constants/firebase';

export const ageConfirmationRequest = writable(null);

let pending = null;

export async function hasAgeConfirmation(userId) {
	if (!db || !userId) return false;
	const snapshot = await getDoc(doc(db, COLLECTION_USER_DATA, userId));
	return Boolean(snapshot.exists() && snapshot.data()?.ageConfirmedAt);
}

export async function recordAgeConfirmation(userId) {
	const user = auth?.currentUser;
	if (!userId || !user || user.uid !== userId) {
		throw new Error('Could not record age confirmation');
	}
	const idToken = await user.getIdToken(true);
	const response = await fetch('/api/account/age-confirmation', {
		method: 'POST',
		headers: { Authorization: `Bearer ${idToken}` }
	});
	if (!response.ok) {
		let message = 'Could not record age confirmation';
		try {
			const body = await response.json();
			if (typeof body?.error === 'string' && body.error.trim()) {
				message = body.error.trim();
			}
		} catch {
			// The status is enough when the body is empty.
		}
		throw new Error(message);
	}
}

export function ensureAgeConfirmed(userId) {
	if (!userId) return Promise.resolve(false);
	return hasAgeConfirmation(userId).then((alreadyConfirmed) => {
		if (alreadyConfirmed) return true;
		if (pending?.userId === userId) return pending.promise;

		let resolveConfirmation;
		const promise = new Promise((resolve) => {
			resolveConfirmation = resolve;
		});
		pending = { userId, promise, resolve: resolveConfirmation };
		ageConfirmationRequest.set({ userId });
		return promise;
	});
}

export function settleAgeConfirmation(accepted) {
	const current = pending;
	pending = null;
	ageConfirmationRequest.set(null);
	current?.resolve(Boolean(accepted));
}

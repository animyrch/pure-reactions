import { writable } from 'svelte/store';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore/lite';
import { COLLECTION_USER_DATA, db } from '$lib/constants/firebase';

export const ageConfirmationRequest = writable(null);

let pending = null;

export async function hasAgeConfirmation(userId) {
	if (!db || !userId) return false;
	const snapshot = await getDoc(doc(db, COLLECTION_USER_DATA, userId));
	return Boolean(snapshot.exists() && snapshot.data()?.ageConfirmedAt);
}

export async function recordAgeConfirmation(userId) {
	if (!db || !userId) return;
	await setDoc(
		doc(db, COLLECTION_USER_DATA, userId),
		{ ageConfirmedAt: serverTimestamp() },
		{ merge: true }
	);
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

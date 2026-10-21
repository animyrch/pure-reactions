import { auth } from '$lib/helpers/firebase';

export const deleteOwnedContent = async ({ kind, id }) => {
	const user = auth.currentUser;
	if (!user) {
		throw new Error('You must be signed in to delete this.');
	}

	const idToken = await user.getIdToken();
	const response = await fetch('/api/content/delete', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${idToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ kind, id })
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(result.error || 'Could not delete this.');
	}
	return result;
};

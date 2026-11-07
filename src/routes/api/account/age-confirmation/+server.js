import { json } from '@sveltejs/kit';
import { COLLECTION_USER_DATA } from '$lib/constants/firebase';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';
import { RATE_LIMITS, enforceRateLimit } from '$lib/server/rateLimit';

const isTimestamp = (value) => Boolean(value && typeof value.toDate === 'function');

export const POST = async ({ request }) => {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { adminAuth, adminDb, adminFieldValue } = await initializeFirebaseAdmin();
	if (!adminAuth || !adminDb || !adminFieldValue) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	let decodedToken;
	try {
		decodedToken = await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length));
	} catch (error) {
		console.error('Token verification failed:', error);
		return json({ error: 'Invalid token' }, { status: 401 });
	}

	if (decodedToken.email_verified !== true) {
		return json({ error: 'Verify your email before confirming your age.' }, { status: 403 });
	}

	const userId = decodedToken.uid;

	const limited = await enforceRateLimit({
		id: userId,
		...RATE_LIMITS.ageConfirmation,
	});
	if (limited) return limited;

	const ref = adminDb.collection(COLLECTION_USER_DATA).doc(userId);
	await adminDb.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(ref);
		if (snapshot.exists && isTimestamp(snapshot.get('ageConfirmedAt'))) return;
		transaction.set(ref, { ageConfirmedAt: adminFieldValue.serverTimestamp() }, { merge: true });
	});

	return json({ ok: true });
};

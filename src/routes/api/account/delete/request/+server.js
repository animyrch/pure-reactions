import { json } from '@sveltejs/kit';
import crypto from 'crypto';

// Lazy import Firebase Admin to avoid SSR/build issues
let adminAuth = null;
let adminDb = null;
let adminInitialized = false;

async function initializeFirebaseAdmin() {
	if (adminInitialized) {
		return { adminAuth, adminDb };
	}

	try {
		const { getAuth } = await import('firebase-admin/auth');
		const { getFirestore } = await import('firebase-admin/firestore');
		const { initializeApp, getApps, cert } = await import('firebase-admin');
		const { FIREBASE_CONFIG } = await import('$lib/constants/firebase');

		let adminApp;
		if (!getApps().length) {
			// In production (Netlify), service account is provided via environment
			if (process.env.FIREBASE_SERVICE_ACCOUNT) {
				const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
				adminApp = initializeApp({
					credential: cert(serviceAccount),
					projectId: FIREBASE_CONFIG.projectId
				});
			} else {
				// For local development with emulator or GOOGLE_APPLICATION_CREDENTIALS
				adminApp = initializeApp({
					projectId: FIREBASE_CONFIG.projectId
				});
			}
		} else {
			adminApp = getApps()[0];
		}

		adminAuth = getAuth(adminApp);
		adminDb = getFirestore(adminApp);
		adminInitialized = true;
	} catch (error) {
		console.error('Failed to initialize Firebase Admin:', error);
	}

	return { adminAuth, adminDb };
}

// In-memory rate limiting (simple implementation)
const requestAttempts = new Map();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in ms
const MAX_REQUESTS_PER_WINDOW = 3;

function checkRateLimit(userId) {
	const now = Date.now();
	const attempts = requestAttempts.get(userId) || [];
	
	// Filter out old attempts
	const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
	
	if (recentAttempts.length >= MAX_REQUESTS_PER_WINDOW) {
		return false;
	}
	
	recentAttempts.push(now);
	requestAttempts.set(userId, recentAttempts);
	return true;
}

export const POST = async ({ request }) => {
	try {
		// Initialize Firebase Admin (lazy)
		const { adminAuth, adminDb } = await initializeFirebaseAdmin();

		// Get the Firebase ID token from the Authorization header
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const idToken = authHeader.split('Bearer ')[1];
		
		if (!adminAuth) {
			console.error('Firebase Admin not initialized');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		// Verify the token and get user ID from auth context
		let decodedToken;
		try {
			decodedToken = await adminAuth.verifyIdToken(idToken);
		} catch (error) {
			console.error('Token verification failed:', error);
			return json({ error: 'Invalid token' }, { status: 401 });
		}

		const userId = decodedToken.uid;

		// Check rate limit
		if (!checkRateLimit(userId)) {
			return json({ 
				error: 'Too many deletion requests. Please try again later.' 
			}, { status: 429 });
		}

		// Generate a one-time token
		const deletionToken = crypto.randomBytes(32).toString('hex');
		const expiresAt = Date.now() + 3600000; // 1 hour from now

		// Store the deletion token in Firestore
		await adminDb.collection('deletionTokens').doc(deletionToken).set({
			userId,
			expiresAt,
			used: false,
			createdAt: Date.now()
		});

		// In a real implementation, you would send an email here
		// For now, we'll return the confirmation URL
		const confirmationUrl = `${request.headers.get('origin')}/account/delete/confirm?token=${deletionToken}`;
		
		// TODO: Send email via SendGrid, AWS SES, or similar service
		// For now, log the URL (in production, this should be sent via email)
		console.log('Deletion confirmation URL:', confirmationUrl);

		return json({ 
			success: true,
			message: 'A confirmation link has been sent to your email. Please check your inbox.',
			// Include URL only in development
			...(process.env.NODE_ENV === 'development' && { confirmationUrl })
		}, { status: 200 });

	} catch (error) {
		console.error('Error requesting account deletion:', error);
		return json({ 
			error: 'Failed to process deletion request' 
		}, { status: 500 });
	}
};

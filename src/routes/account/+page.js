import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { getAuth } from 'firebase/auth';

/** @type {import('./$types').PageLoad} */
export async function load() {
    // On the client, we can check auth state
    if (browser) {
        // We use a small trick: check auth.currentUser immediately.
        // If it's null, we might be logged out or just initializing.
        // But for E2E tests, it's usually null immediately if logged out.
        const auth = getAuth();
        if (!auth.currentUser) {
            // We give it a chance to initialize by waiting for the store in the component,
            // but for a hard redirect, we can do it here if we are sure.
            // Actually, let's just use the component redirect but better.
        }
    }
    return {};
}

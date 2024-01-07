// store.js
import { writable, derived } from 'svelte/store';

export const currentUser = writable({});

export const isLoggedIn = derived(currentUser, ($currentUser) => {
    const emailVerified = $currentUser?.emailVerified || false;
    return emailVerified;
});
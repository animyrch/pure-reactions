// store.js
import { writable, derived } from 'svelte/store';

export const currentUser = writable({});

export const isLoggedIn = derived(currentUser, ($currentUser) => {
    console.log('$currentUser:', $currentUser);
    const emailVerified = $currentUser?.emailVerified || false;
    console.log('userBookmarksId value:', emailVerified);
    return emailVerified;
});
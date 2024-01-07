// store.js
import { writable } from 'svelte/store';

// Check if window is defined (i.e., we are on the client side)
const isClient = typeof window !== 'undefined';

export const currentPath = writable(isClient ? window.location.pathname : '');

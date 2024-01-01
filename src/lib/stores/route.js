// store.js
import { writable } from 'svelte/store';

// Check if window is defined (i.e., we are on the client side)
const isClient = typeof window !== 'undefined';

export const currentPath = writable(isClient ? window.location.pathname : '');

// if (isClient) {
//   // Update the currentPath store whenever the pathname changes
//   window.addEventListener('popstate', () => {
//     console.log('popstate event triggered');
//     currentPath.set(window.location.pathname);
//   });
// }

// toast.js
import { writable } from 'svelte/store';

export const toasts = writable([]);

export function showToast(message, type = "warning", duration = 5000) {
  const id = Math.random().toString(36).substring(7); // Generate a unique ID
  toasts.update((currentToasts) => [...currentToasts, { id, type, message, duration }]);

  setTimeout(() => {
    hideToast(id);
  }, duration);
}

export function hideToast(id) {
  toasts.update((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
}

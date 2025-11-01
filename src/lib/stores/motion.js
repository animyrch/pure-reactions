import { readable } from 'svelte/store';

const getMediaQuery = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)');
};

export const prefersReducedMotion = readable(false, (set) => {
    const mediaQuery = getMediaQuery();

    if (!mediaQuery) {
        return undefined;
    }

    const updatePreference = (event) => {
        set(event.matches);
    };

    set(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', updatePreference);
        return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(updatePreference);
        return () => mediaQuery.removeListener(updatePreference);
    }

    return undefined;
});

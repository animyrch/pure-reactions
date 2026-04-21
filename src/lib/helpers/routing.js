import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';
import { currentPath } from '$lib/stores/route';
import { currentUser } from '$lib/stores/user';

function buildVerificationRoute() {
    if (!browser) {
        return '/account/verify';
    }

    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!currentLocation || currentLocation === '/account/verify') {
        return '/account/verify';
    }

    const params = new URLSearchParams({ redirect: currentLocation });
    return `/account/verify?${params.toString()}`;
}

export function handlePrivateRoute() {
    if (browser) {
        const user = get(currentUser);
        if (user?.uid && !user?.emailVerified) {
            goToRoute(buildVerificationRoute());
            showToast('Verify your account to continue.');
            return;
        }

        goToRoute('/login');
        showToast('You need to login to do this action!');
    }
}

export async function goToRoute(route) {
    if (browser) {
        await goto(route);
        currentPath.set(route);
    }
}
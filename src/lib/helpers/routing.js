import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { showToast } from '$lib/stores/toast';
import { currentPath } from '$lib/stores/route';

export function handlePrivateRoute() {
    if (browser) {
        goToRoute('/login');
        showToast('You need to login to access this page!');
    }
}

export function goToRoute(route) {
    if (browser) {
        goto(route);
        currentPath.set(route);
    }
}
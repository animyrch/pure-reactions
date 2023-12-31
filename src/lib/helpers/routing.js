import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { showToast } from '$lib/stores/toast';

export function handlePrivateRoute() {
    if (browser) {
        goto('/');
    }
    showToast('You need to login to access this page!');
}
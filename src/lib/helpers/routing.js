import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { showToast } from '$lib/stores/toast';

export function handlePrivateRoute() {
    // redirectURL.setRedirectURL(location.href)
    if (browser) {
        goto('/');
    }

    showToast('You need to login to access this page!');
    // Swal.fire({
    // title: 'You are not authenticated',
    // text: 'Please log in or sign up to view this page',
    // type: 'error',
    // allowOutsideClick: false,
    // confirmButtonText: 'Will do!',
    // })
}
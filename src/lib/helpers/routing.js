import { goto } from '$app/navigation';
import { browser } from '$app/environment';
    
export function handlePrivateRoute() {
    // redirectURL.setRedirectURL(location.href)
    if (browser) {
        goto('/');
    }

    // Swal.fire({
    // title: 'You are not authenticated',
    // text: 'Please log in or sign up to view this page',
    // type: 'error',
    // allowOutsideClick: false,
    // confirmButtonText: 'Will do!',
    // })
}
import { browser } from '$app/environment';

export function isMobileDevice() {
    if (browser && window) {
        // return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return window.innerWidth < 640;
    }
    return false;
}
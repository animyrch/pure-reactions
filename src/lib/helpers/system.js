import { browser } from '$app/environment';

export function isMobileDevice() {
    if (browser) {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    return false;
}
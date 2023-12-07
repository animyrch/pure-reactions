/** @type {import('./$types').PageLoad} */
import netlifyIdentity from 'netlify-identity-widget';
import { browser } from '$app/environment';

export function load() {
    if (browser) {
        netlifyIdentity.init();
    }
    return {
        handleUserAction: () => {
            console.log('executed');
            netlifyIdentity.open('login');
        }
    };
}

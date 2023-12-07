/** @type {import('./$types').PageLoad} */
import netlifyIdentity from 'netlify-identity-widget';
import { browser } from '$app/environment';
import { user } from '../store.js'
import { goto } from '$app/navigation';

let username;
let userId;

export function load() {
    if (browser) {
        netlifyIdentity.init();
    }

    user.subscribe((value) => {
        // Update the local variable when the user store changes
        username = value?.username;
        userId = value?.id;
    });

    const handleUserAction = (action) => {
        if (action === 'login' || action === 'signup') {
            netlifyIdentity.open(action);
            netlifyIdentity.on('login', u => {
                user.login(u);
                location.reload();
            });
        }
        if (action === 'logout') {
            goto('/');
            user.logout();
            netlifyIdentity.logout();
            location.reload();
        }
    };
    return {
        handleUserAction,
        isLoggedIn: !!userId,
        username
    };
}

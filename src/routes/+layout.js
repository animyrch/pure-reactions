/** @type {import('./$types').PageLoad} */
import { browser } from '$app/environment';
import { checkUserSignInStatusWrapper, signOutWrapper, signInWithEmailAndPasswordWrapper } from '$lib/helpers/firebase.js';
import { createUserWithEmailAndPasswordWrapper } from '../lib/helpers/firebase.js';
import { showToast } from '$lib/stores/toast';
import { goToRoute } from '$lib/helpers/routing';
import { TOASTS } from '$lib/constants/toasts';

let displayName;
let userEmail;
let isLoggedIn;
let userId;

export async function load() {
    if (browser && !!window) {
        // auth actions worked here
        const user = await checkUserSignInStatusWrapper();
        console.log(user);
        userEmail = user?.email;
        displayName = user?.displayName;
        isLoggedIn = user?.emailVerified;
        userId = user?.uid;
    }

    const handleUserAction = async (action, details = {}) => {
        const email = details.email;
        const password = details.password;
        if (action === 'login') {
            const successful = await signInWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                goToRoute('/');
            }
        }
        console.log(action, email, password, action === 'signup' && email && password)
        if (action === 'signup' && email && password) {
            const successful = await createUserWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                goToRoute('/');
                showToast('Success! Check your email to confirm your account.', TOASTS.SUCCESS, 10000);
            }
        }
        if (action === 'logout') {
            await signOutWrapper();
            goToRoute('/');
        }
    };
    return {
        handleUserAction,
        isLoggedIn,
        displayName,
        userEmail,
        userId
    };
}

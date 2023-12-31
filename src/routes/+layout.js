/** @type {import('./$types').PageLoad} */
import { browser } from '$app/environment';
import { checkUserSignInStatusWrapper, signOutWrapper, signInWithEmailAndPasswordWrapper } from '$lib/helpers/firebase.js';
import { createUserWithEmailAndPasswordWrapper } from '../lib/helpers/firebase.js';

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

    const handleUserAction = async (action, { detail } = {}) => {
        const email = detail && detail.email;
        const password = detail && detail.password;
        if (action === 'login') {
            const successful = await signInWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                location.reload();
            }
        }
        if (action === 'signup' && email && password) {
            await createUserWithEmailAndPasswordWrapper(email, password);
        }
        if (action === 'logout') {
            await signOutWrapper();
            location.reload();
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

/** @type {import('./$types').PageLoad} */
import { browser } from '$app/environment';
import { checkUserSignInStatusWrapper, signOutWrapper, signInWithEmailAndPasswordWrapper } from '$lib/helpers/firebase.js';
import { createUserWithEmailAndPasswordWrapper } from '../lib/helpers/firebase.js';
import { showToast } from '$lib/stores/toast';
import { goToRoute } from '$lib/helpers/routing';
import { TOASTS } from '$lib/constants/toasts';
import { currentUser } from '$lib/stores/user';
import { userExtraDataStore } from '$lib/stores/userExtraData';
let displayName;
let userEmail;
let userId;

export async function load() {
    if (browser && !!window) {
        // auth actions worked here
        const user = await checkUserSignInStatusWrapper();
        currentUser.set(user);
        userEmail = user?.email;
        displayName = user?.displayName;
        userId = user?.uid;
        await userExtraDataStore.fetchUserData(userId);
    }

    const handleUserAction = async (action, details = {}) => {
        const email = details.email;
        const password = details.password;
        if (action === 'login') {
            const successful = await signInWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                goToRoute('/');
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
            }
        }
        if (action === 'signup' && email && password) {
            const successful = await createUserWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                goToRoute('/');
                showToast('Success! Check your email to confirm your account.', TOASTS.SUCCESS, 10000);
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
            }
        }
        if (action === 'logout') {
            await signOutWrapper();
            currentUser.set({});
            goToRoute('/');
        }
    };
    return {
        handleUserAction,
        displayName,
        userEmail,
        userId
    };
}

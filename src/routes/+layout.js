/** @type {import('./$types').PageLoad} */
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { invalidate } from '$app/navigation';
import { checkUserSignInStatusWrapper, signOutWrapper, signInWithEmailAndPasswordWrapper } from '$lib/helpers/firebase.js';
import { createUserWithEmailAndPasswordWrapper } from '../lib/helpers/firebase.js';
import { showToast } from '$lib/stores/toast';
import { goToRoute } from '$lib/helpers/routing';
import { TOASTS } from '$lib/constants/toasts';
import { currentUser } from '$lib/stores/user';
import { userExtraDataStore } from '$lib/stores/userExtraData';

export async function load({ depends }) {
    depends('app:auth');

    let displayName;
    let userEmail;
    let userId;

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
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
                await userExtraDataStore.fetchUserData(user?.uid);
                await invalidate('app:auth');
                await goToRoute('/');
            }
            return { successful };
        }
        if (action === 'signup' && email && password) {
            const { successful, error } = await createUserWithEmailAndPasswordWrapper(email, password);
            if (successful) {
                const signupMessage = env.PUBLIC_FIREBASE_USE_EMULATORS === 'true'
                    ? 'Success! Open the verification link printed by the Firebase Auth emulator, then verify your account to continue.'
                    : 'Success! Check your email to confirm your account.';
                showToast(signupMessage, TOASTS.SUCCESS, 12000);
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
                await userExtraDataStore.fetchUserData(user?.uid);
                await invalidate('app:auth');
                await goToRoute('/account/verify');
            }
            return { successful, error };
        }
        if (action === 'logout') {
            goToRoute('/');
            await signOutWrapper();
            currentUser.set({});
            await invalidate('app:auth');
            showToast('You have been logged out successfully', TOASTS.SUCCESS, 5000);
            return { successful: true };
        }
        return { successful: false };
    };
    return {
        handleUserAction,
        displayName,
        userEmail,
        userId
    };
}

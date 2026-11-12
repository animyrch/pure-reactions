/** @type {import('./$types').PageLoad} */
import { browser } from '$app/env';
import { PUBLIC_FIREBASE_USE_EMULATORS } from '$app/env/public';
import { invalidate } from '$app/navigation';
import { checkUserSignInStatusWrapper, signOutWrapper, signInWithEmailAndPasswordWrapper } from '#lib/helpers/firebase.js';
import { createUserWithEmailAndPasswordWrapper } from '../lib/helpers/firebase.js';
import { showToast } from '#lib/stores/toast.js';
import { goToRoute, setLogoutRedirectInProgress } from '#lib/helpers/routing.js';
import { TOASTS } from '#lib/constants/toasts.js';
import { currentUser } from '#lib/stores/user.js';
import { userExtraDataStore } from '#lib/stores/userExtraData.js';
import { recordAgeConfirmation } from '#lib/helpers/ageConfirmation.js';

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
                const signupMessage = PUBLIC_FIREBASE_USE_EMULATORS === 'true'
                    ? 'Success! Open the verification link printed by the Firebase Auth emulator, then verify your account to continue.'
                    : 'Success! Check your email to confirm your account.';
                showToast(signupMessage, TOASTS.SUCCESS, 12000);
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
                if (user?.uid && user.emailVerified) {
                    try {
                        await recordAgeConfirmation(user.uid);
                    } catch (error) {
                        console.error('Could not record age confirmation:', error);
                    }
                }
                await userExtraDataStore.fetchUserData(user?.uid);
                await invalidate('app:auth');
                await goToRoute('/account/verify');
            }
            return { successful, error };
        }
        if (action === 'logout') {
            setLogoutRedirectInProgress(true);
            try {
                await signOutWrapper();
                currentUser.set({});
                showToast('You have been logged out successfully', TOASTS.SUCCESS, 5000);
                await goToRoute('/');
                return { successful: true };
            } finally {
                invalidate('app:auth');
                setTimeout(() => setLogoutRedirectInProgress(false), 1000);
            }
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

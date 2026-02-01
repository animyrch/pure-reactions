/** @type {import('./$types').PageLoad} */
import { browser } from '$app/environment';
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
                showToast('Success! Check your email to confirm your account.', TOASTS.SUCCESS, 10000);
                const user = await checkUserSignInStatusWrapper();
                currentUser.set(user);
                await userExtraDataStore.fetchUserData(user?.uid);
                await invalidate('app:auth');
                await goToRoute('/');
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

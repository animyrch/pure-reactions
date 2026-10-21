const UNAUTHORIZED_CONTINUE_URI_CODES = new Set([
    'auth/unauthorized-continue-uri',
    'auth/invalid-continue-uri'
]);

// Preview hosts such as Netlify branch deploys are not Firebase authorized
// domains. A continue URL on those hosts makes the verification email fail
// after the account already exists. Retry without that URL so the message
// still sends and sign-up can open the verification page.
export async function sendAccountVerificationEmail(user, continueUrl, sendEmailVerification) {
    if (continueUrl) {
        try {
            await sendEmailVerification(user, { url: continueUrl });
            return;
        } catch (error) {
            if (!UNAUTHORIZED_CONTINUE_URI_CODES.has(error?.code)) {
                throw error;
            }
            console.warn(
                'Verification continue URL is not an authorized auth domain. Sending the email without it.',
                continueUrl
            );
        }
    }

    await sendEmailVerification(user);
}

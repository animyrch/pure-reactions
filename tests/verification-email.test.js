import assert from 'node:assert/strict';
import test from 'node:test';
import { sendAccountVerificationEmail } from '../src/lib/helpers/verificationEmail.js';

test('retries verification email without a continue URL when the preview domain is not authorized', async () => {
    const calls = [];
    const user = { uid: 'user-1' };
    const continueUrl = 'https://live-react-improvements-3--pure-reactions.netlify.app/account/verify';

    await sendAccountVerificationEmail(user, continueUrl, async (account, settings) => {
        calls.push(settings);
        if (settings?.url) {
            const error = new Error('Firebase: Domain not whitelisted by project (auth/unauthorized-continue-uri).');
            error.code = 'auth/unauthorized-continue-uri';
            throw error;
        }
    });

    assert.deepEqual(calls, [{ url: continueUrl }, undefined]);
});

test('does not hide other verification email errors', async () => {
    const error = new Error('quota');
    error.code = 'auth/too-many-requests';

    await assert.rejects(
        () => sendAccountVerificationEmail({ uid: 'user-1' }, 'https://purereactions.com/account/verify', async () => {
            throw error;
        }),
        (caught) => caught.code === 'auth/too-many-requests'
    );
});

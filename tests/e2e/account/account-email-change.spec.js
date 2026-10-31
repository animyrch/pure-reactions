import { test, expect } from '@playwright/test';

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Email1!';

async function signUp(page, email) {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(async () => {
        await page.getByRole('button', { name: 'Sign up' }).click();
        await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('checkbox', { name: 'I am 15 or older.' }).check();
    await page.getByRole('checkbox', { name: /I have read the Terms/ }).check();
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL(/\/account\/verify/, { timeout: 20000 });
}

async function authRequest(path, body) {
    const response = await fetch(`http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
}

test('changing email sends a confirmation and keeps the current address until that link is opened', async ({ page }) => {
    test.setTimeout(60000);
    const currentEmail = `email-current-${Date.now()}@example.com`;
    const nextEmail = `email-next-${Date.now()}@example.com`;

    await signUp(page, currentEmail);
    await page.goto('/account/edit');

    const emailInput = page.getByLabel('New email');
    await expect(emailInput).toHaveValue(currentEmail, { timeout: 15000 });
    await expect(page.getByText(`Signed in as ${currentEmail}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send confirmation' })).toBeDisabled();

    await emailInput.fill(nextEmail);
    await expect(page.getByRole('button', { name: 'Send confirmation' })).toBeEnabled();

    page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(PASSWORD);
    });
    await page.getByRole('button', { name: 'Send confirmation' }).click();

    const pendingNotice = page.getByRole('status');
    await expect(pendingNotice).toContainText(nextEmail);
    await expect(pendingNotice).toContainText(currentEmail);
    await expect(emailInput).toHaveValue(nextEmail);
    await expect(page.getByRole('button', { name: 'Resend confirmation' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Cancel change' })).toBeVisible();
    await expect(page.getByText(`Signed in as ${currentEmail}`)).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Confirmation email sent');
    await expect(page.getByText('Email updated successfully')).toHaveCount(0);
    await expect(page).toHaveURL(/\/account\/edit/);

    await page.reload();
    await expect(emailInput).toHaveValue(nextEmail, { timeout: 15000 });
    await expect(page.getByRole('status')).toContainText(nextEmail);
    await expect(page.getByRole('button', { name: 'Cancel change' })).toBeVisible();
    await expect(page.getByText(`Signed in as ${currentEmail}`)).toBeVisible();

    const stillCurrent = await authRequest('accounts:signInWithPassword', {
        email: currentEmail,
        password: PASSWORD,
        returnSecureToken: true,
    });
    expect(stillCurrent.ok, JSON.stringify(stillCurrent.payload)).toBe(true);

    const switchedEarly = await authRequest('accounts:signInWithPassword', {
        email: nextEmail,
        password: PASSWORD,
        returnSecureToken: true,
    });
    expect(switchedEarly.ok).toBe(false);

    const oobResponse = await fetch(`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${AUTH_PROJECT}/oobCodes`);
    expect(oobResponse.ok).toBe(true);
    const oobBody = await oobResponse.json();
    const confirmation = (oobBody.oobCodes || []).find((entry) => {
        const requestType = entry.requestType || entry.request_type || '';
        const serialized = JSON.stringify(entry);
        return requestType === 'VERIFY_AND_CHANGE_EMAIL' && serialized.includes(nextEmail);
    });
    expect(confirmation, JSON.stringify(oobBody)).toBeTruthy();

    const applied = await authRequest('accounts:update', { oobCode: confirmation.oobCode });
    expect(applied.ok, JSON.stringify(applied.payload)).toBe(true);

    await page.reload();
    await expect(emailInput).toHaveValue(nextEmail, { timeout: 15000 });
    await expect(page.getByText(`Signed in as ${nextEmail}`)).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);

    const switched = await authRequest('accounts:signInWithPassword', {
        email: nextEmail,
        password: PASSWORD,
        returnSecureToken: true,
    });
    expect(switched.ok, JSON.stringify(switched.payload)).toBe(true);
});

test('a pending email can be corrected or canceled before the link is opened', async ({ page }) => {
    test.setTimeout(60000);
    const currentEmail = `email-keep-${Date.now()}@example.com`;
    const wrongEmail = `email-wrong-${Date.now()}@example.com`;
    const correctedEmail = `email-fixed-${Date.now()}@example.com`;

    await signUp(page, currentEmail);
    await page.goto('/account/edit');

    const emailInput = page.getByLabel('New email');
    await expect(emailInput).toHaveValue(currentEmail, { timeout: 15000 });

    await emailInput.fill(wrongEmail);
    page.once('dialog', async (dialog) => {
        await dialog.accept(PASSWORD);
    });
    await page.getByRole('button', { name: 'Send confirmation' }).click();
    await expect(page.getByRole('status')).toContainText(wrongEmail);
    await expect(emailInput).toHaveValue(wrongEmail);

    await emailInput.fill(correctedEmail);
    page.once('dialog', async (dialog) => {
        await dialog.accept(PASSWORD);
    });
    await page.getByRole('button', { name: 'Send confirmation' }).click();
    await expect(page.getByRole('status')).toContainText(correctedEmail);
    await expect(page.getByRole('status')).not.toContainText(wrongEmail);
    await expect(emailInput).toHaveValue(correctedEmail);
    await expect(page.getByText(`Signed in as ${currentEmail}`)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel change' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(emailInput).toHaveValue(currentEmail);
    await expect(page.getByText('Email change canceled')).toBeVisible();
    await expect(page.getByText(`Signed in as ${currentEmail}`)).toBeVisible();

    await page.reload();
    await expect(emailInput).toHaveValue(currentEmail, { timeout: 15000 });
    await expect(page.getByRole('status')).toHaveCount(0);

    const stillCurrent = await authRequest('accounts:signInWithPassword', {
        email: currentEmail,
        password: PASSWORD,
        returnSecureToken: true,
    });
    expect(stillCurrent.ok, JSON.stringify(stillCurrent.payload)).toBe(true);

    const correctedSignsIn = await authRequest('accounts:signInWithPassword', {
        email: correctedEmail,
        password: PASSWORD,
        returnSecureToken: true,
    });
    expect(correctedSignsIn.ok).toBe(false);
});

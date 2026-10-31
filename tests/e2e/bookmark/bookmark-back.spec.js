import { test, expect } from '@playwright/test';

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Reactions1!';

async function authRequest(path, body) {
    const response = await fetch(`http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
}

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

async function verifyEmail(email) {
    await expect(async () => {
        const oobResponse = await fetch(`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${AUTH_PROJECT}/oobCodes`);
        expect(oobResponse.ok).toBe(true);
        const oobBody = await oobResponse.json();
        const confirmation = (oobBody.oobCodes || []).find((entry) => {
            const requestType = entry.requestType || entry.request_type || '';
            return requestType === 'VERIFY_EMAIL' && JSON.stringify(entry).includes(email);
        });
        expect(confirmation, JSON.stringify(oobBody)).toBeTruthy();
        const applied = await authRequest('accounts:update', { oobCode: confirmation.oobCode });
        expect(applied.ok, JSON.stringify(applied.payload)).toBe(true);
    }).toPass({ timeout: 15000 });
}

test('bookmarks can return to the page that opened it', async ({ page }) => {
    test.setTimeout(60000);
    const email = `bookmarks-${Date.now()}@example.com`;

    await signUp(page, email);
    await verifyEmail(email);
    await page.getByRole('button', { name: 'I’ve verified my account' }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20000 });

    await page.goto('/account');
    await page.getByRole('button', { name: 'See Your Bookmarks' }).click();
    await expect(page).toHaveURL(/\/bookmark$/, { timeout: 15000 });

    const backLink = page.getByRole('link', { name: 'Back' });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/account');
    await backLink.click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'See Your Bookmarks' })).toBeVisible();

    await page.getByRole('link', { name: 'Pure Reactions home' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    await page.locator('footer a[href="/bookmark"]').evaluate((link) => link.click());
    await expect(page).toHaveURL(/\/bookmark$/, { timeout: 15000 });
    const returnHome = page.getByRole('link', { name: 'Back' });
    await expect(returnHome).toHaveCount(1, { timeout: 15000 });
    await expect(returnHome).toHaveAttribute('href', '/');
    await returnHome.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/bookmark|\/account/);

    await page.goto('/bookmark');
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/account');
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
});

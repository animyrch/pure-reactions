import { test, expect } from '@playwright/test';

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Reactions1!';
const ORIGINAL_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function channel(value) {
    const normalized = Number(value) / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
    const value = String(color).trim();
    const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
        return (0.2126 * channel(rgb[1])) + (0.7152 * channel(rgb[2])) + (0.0722 * channel(rgb[3]));
    }
    // Chrome reports Tailwind colors as oklch(). Lightness is enough to tell
    // near-black #050505 from gray placeholders and from slate-100 text.
    const oklch = value.match(/oklch\(\s*([\d.]+)(%)?/);
    if (oklch) {
        const lightness = Number(oklch[1]);
        return oklch[2] ? lightness / 100 : lightness;
    }
    throw new Error(`Could not parse color ${color}`);
}

async function fieldColors(locator) {
    return locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const placeholder = getComputedStyle(element, '::placeholder');
        return {
            color: style.color,
            textFill: style.webkitTextFillColor,
            backgroundColor: style.backgroundColor,
            placeholder: placeholder.color,
        };
    });
}

function typedColor(colors) {
    const fill = colors.textFill;
    if (fill && fill !== colors.color && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') {
        return fill;
    }
    return colors.color;
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

test('typed text stays readable in the original-video field', async ({ page }) => {
    test.setTimeout(60000);
    const email = `react-input-${Date.now()}@example.com`;

    await page.goto('/login');
    const loginEmail = page.getByPlaceholder('Email');
    await expect(loginEmail).toBeVisible();
    await loginEmail.fill('reader@example.com');
    const loginColors = await fieldColors(loginEmail);
    expect(
        luminance(typedColor(loginColors)),
        `login text should stay dark on the white card, got ${JSON.stringify(loginColors)}`
    ).toBeLessThan(0.2);

    await signUp(page, email);
    await verifyEmail(email);
    await page.getByRole('button', { name: 'I’ve verified my account' }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20000 });

    await page.goto('/react');
    const input = page.getByRole('textbox', { name: 'Original video URL' });
    await expect(input).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    const emptyColors = await fieldColors(input);
    expect(
        luminance(emptyColors.placeholder),
        `placeholder should stay visible on the dark field, got ${JSON.stringify(emptyColors)}`
    ).toBeGreaterThan(0.2);

    await input.fill(ORIGINAL_VIDEO_URL);
    await expect(input).toHaveValue(ORIGINAL_VIDEO_URL);
    const filledColors = await fieldColors(input);
    expect(
        luminance(typedColor(filledColors)),
        `typed text should stay light on the dark field, got ${JSON.stringify(filledColors)}`
    ).toBeGreaterThan(0.75);

    await input.blur();
    const reactPage = page.getByTestId('react-page');
    await expect(reactPage).toBeVisible();
    await page.locator('header.nav-shell').evaluate((element) => {
        element.style.setProperty('visibility', 'hidden');
    });
    await page.locator('.firebase-emulator-warning').evaluateAll((elements) => {
        for (const element of elements) {
            element.style.setProperty('display', 'none');
        }
    });
    const toastCloses = page.getByRole('alert').getByRole('button', { name: 'Close' });
    while (await toastCloses.count()) {
        await toastCloses.first().click();
    }
    await expect(reactPage).toHaveScreenshot('react-page.png', {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.05,
    });
});

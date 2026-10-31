import { test, expect } from '@playwright/test';
import { installMockYouTubeApi } from '../../utils/twin-player-helpers.js';

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Reactions1!';

async function authRequest(path, body) {
    const response = await fetch(
        `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        },
    );
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
}

async function signUp(page, email) {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(async () => {
        await page.getByRole('button', { name: 'Sign up' }).click();
        await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible({
            timeout: 1000,
        });
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
        const oobResponse = await fetch(
            `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${AUTH_PROJECT}/oobCodes`,
        );
        expect(oobResponse.ok).toBe(true);
        const oobBody = await oobResponse.json();
        const confirmation = (oobBody.oobCodes || []).find((entry) => {
            const requestType = entry.requestType || entry.request_type || '';
            return requestType === 'VERIFY_EMAIL' && JSON.stringify(entry).includes(email);
        });
        expect(confirmation, JSON.stringify(oobBody)).toBeTruthy();
        const applied = await authRequest('accounts:update', {
            oobCode: confirmation.oobCode,
        });
        expect(applied.ok, JSON.stringify(applied.payload)).toBe(true);
    }).toPass({ timeout: 15000 });
}

const contrastScript = () => {
    const parseColor = (value) => {
        const match = String(value).match(
            /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
        );
        if (!match) return null;
        return {
            r: Number(match[1]),
            g: Number(match[2]),
            b: Number(match[3]),
            a: match[4] === undefined ? 1 : Number(match[4]),
        };
    };

    const channel = (value) => {
        const scaled = value / 255;
        return scaled <= 0.03928
            ? scaled / 12.92
            : ((scaled + 0.055) / 1.055) ** 2.4;
    };

    const luminance = ({ r, g, b }) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    const opaqueOn = (fg, bg) => {
        if (!fg || !bg || bg.a < 1) return null;
        if (fg.a >= 1) return fg;
        return {
            r: fg.r * fg.a + bg.r * (1 - fg.a),
            g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a),
            a: 1,
        };
    };

    const paintedBackground = (el) => {
        let node = el;
        while (node && node !== document.documentElement) {
            const color = parseColor(getComputedStyle(node).backgroundColor);
            if (color && color.a > 0) return color;
            node = node.parentElement;
        }
        return parseColor(getComputedStyle(document.body).backgroundColor);
    };

    const contrastRatio = (el) => {
        const style = getComputedStyle(el);
        const fg = parseColor(style.color);
        const bg = paintedBackground(el);
        const paintedFg = opaqueOn(fg, bg);
        if (!paintedFg || !bg) return 0;
        const lighter = Math.max(luminance(paintedFg), luminance(bg));
        const darker = Math.min(luminance(paintedFg), luminance(bg));
        return (lighter + 0.05) / (darker + 0.05);
    };

    const modal = document.querySelector('[data-testid="share-session-modal"]');
    if (!modal) return null;

    const heading = modal.querySelector('h3');
    const intro = heading?.nextElementSibling;
    const label = modal.querySelector('label[for="share-twitch-channel"]');
    const helper = modal.querySelector('p.text-xs');
    const copy = modal.querySelector('[data-testid="share-copy"]');
    const link = modal.querySelector('a[href="/account/edit#twitch-channel"]');

    return {
        heading: heading ? contrastRatio(heading) : 0,
        intro: intro ? contrastRatio(intro) : 0,
        label: label ? contrastRatio(label) : 0,
        helper: helper ? contrastRatio(helper) : 0,
        copy: copy ? contrastRatio(copy) : 0,
        link: link ? contrastRatio(link) : 0,
        headingText: heading?.textContent?.trim() || '',
        copyText: copy?.textContent?.trim() || '',
    };
};

test('share session modal text meets AA contrast', async ({ page }, testInfo) => {
    test.skip(
        testInfo.project.name !== 'desktop',
        'Share session is a desktop recorder control',
    );
    test.setTimeout(60000);

    const email = `share-modal-${Date.now()}@example.com`;
    await signUp(page, email);
    await verifyEmail(email);
    await page.getByRole('button', { name: 'I’ve verified my account' }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20000 });

    await installMockYouTubeApi(page);
    await page.goto('/backend?id=dQw4w9WgXcQ&sharedSessionId=contrast-check');
    await page.waitForLoadState('networkidle');

    const shareButton = page.getByRole('button', { name: 'Share Session' });
    await expect(shareButton).toBeEnabled({ timeout: 15000 });
    await shareButton.click();

    const modal = page.getByTestId('share-session-modal');
    await expect(modal).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Share Your Reaction Session' }),
    ).toBeVisible();
    await expect(page.getByLabel('Twitch channel')).toBeVisible();
    await expect(page.getByTestId('share-copy')).toBeVisible();

    const ratios = await page.evaluate(contrastScript);
    expect(ratios.headingText).toBe('Share Your Reaction Session');
    expect(ratios.copyText).toBe('Copy');
    expect(ratios.heading).toBeGreaterThanOrEqual(4.5);
    expect(ratios.intro).toBeGreaterThanOrEqual(4.5);
    expect(ratios.label).toBeGreaterThanOrEqual(4.5);
    expect(ratios.helper).toBeGreaterThanOrEqual(4.5);
    expect(ratios.copy).toBeGreaterThanOrEqual(4.5);
    expect(ratios.link).toBeGreaterThanOrEqual(4.5);

    const inset = await page.evaluate(() => {
        const content = document.querySelector('[data-testid="share-session-modal"]');
        const dialog = content?.closest('[role="dialog"]');
        const panel = dialog?.querySelector('.relative.flex.flex-col');
        const closeButton = dialog?.querySelector('button[aria-label="Close modal"]');
        if (!content || !panel) return null;
        const contentBox = content.getBoundingClientRect();
        const panelBox = panel.getBoundingClientRect();
        const headingBox = content.querySelector('h3')?.getBoundingClientRect();
        const closeBox = closeButton?.getBoundingClientRect();
        return {
            top: contentBox.top - panelBox.top,
            right: panelBox.right - contentBox.right,
            bottom: panelBox.bottom - contentBox.bottom,
            left: contentBox.left - panelBox.left,
            headingToClose: closeBox && headingBox ? closeBox.left - headingBox.right : 0,
        };
    });
    expect(inset).toBeTruthy();
    expect(inset.top).toBeGreaterThanOrEqual(24);
    expect(inset.right).toBeGreaterThanOrEqual(24);
    expect(inset.bottom).toBeGreaterThanOrEqual(24);
    expect(inset.left).toBeGreaterThanOrEqual(24);
    expect(inset.headingToClose).toBeGreaterThanOrEqual(16);

    await modal.screenshot({
        path: 'test-results/share-session-modal-contrast.png',
    });
});

import { test, expect } from '@playwright/test';

test('logout from account returns to the home page', async ({ page }) => {
    const email = `logout-${Date.now()}@example.com`;

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(async () => {
        await page.getByRole('button', { name: 'Sign up' }).click();
        await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('Logout1!');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL(/\/account\/verify/, { timeout: 20000 });

    await page.goto('/account');
    const logoutButton = page.getByRole('button', { name: 'Logout' });
    await expect(logoutButton).toBeVisible({ timeout: 15000 });
    await expect(async () => {
        await logoutButton.click();
        await expect(page).toHaveURL(/\/$/, { timeout: 2000 });
    }).toPass({ timeout: 20000 });

    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText('You have been logged out successfully')).toBeVisible();
    await expect(page.getByText('You need to login to do this action!')).toHaveCount(0);
});

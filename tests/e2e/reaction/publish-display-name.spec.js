import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const envOrFile = (name, fallback) => {
	if (process.env[name]) return process.env[name];
	try {
		const line = readFileSync(new URL('../../../.env', import.meta.url), 'utf8')
			.split('\n')
			.find((entry) => entry.startsWith(`${name}=`));
		const value = line?.slice(name.length + 1).trim();
		if (value) return value;
	} catch {
		// CI has no local .env file.
	}
	return fallback;
};

const REACTION_COLLECTION = envOrFile('PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES', 'reactions-local');
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8086';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Publish1!';

const field = {
	str: (value) => ({ stringValue: value }),
	bool: (value) => ({ booleanValue: value })
};

async function authRequest(path, body) {
	const response = await fetch(
		`http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/${path}?key=fake-api-key`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}
	);
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
		const oobResponse = await fetch(
			`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${AUTH_PROJECT}/oobCodes`
		);
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

async function signInRest(email) {
	const result = await authRequest('accounts:signInWithPassword', {
		email,
		password: PASSWORD,
		returnSecureToken: true
	});
	expect(result.ok, JSON.stringify(result.payload)).toBe(true);
	return result.payload;
}

async function createDoc(idToken, documentId, fields) {
	const response = await fetch(
		`http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${AUTH_PROJECT}/databases/(default)/documents/${REACTION_COLLECTION}?documentId=${encodeURIComponent(documentId)}`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${idToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ fields })
		}
	);
	const payload = await response.json().catch(() => ({}));
	expect(response.ok, JSON.stringify(payload)).toBe(true);
}

async function readDoc(documentId) {
	const response = await fetch(
		`http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${AUTH_PROJECT}/databases/(default)/documents/${REACTION_COLLECTION}/${documentId}`
	);
	const payload = await response.json().catch(() => ({}));
	expect(response.ok, JSON.stringify(payload)).toBe(true);
	return payload;
}

async function openAppMenu(page) {
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if ((await menu.getAttribute('aria-expanded')) !== 'true') {
		await menu.click();
	}
}

async function openPublishMenu(page) {
	await openAppMenu(page);
	await page.getByRole('menuitem', { name: 'Publish Reaction' }).click();
}

test('publishing asks for a public name when it still matches the mailbox', async ({ page }) => {
	test.setTimeout(90000);
	const stamp = Date.now();
	const email = `publish-name-${stamp}@example.com`;
	const mailbox = `publish-name-${stamp}`;
	const reactionId = `publish-name-${stamp}`;
	const chosenName = `Studio ${stamp}`;

	await signUp(page, email);
	await expect(page.getByRole('dialog', { name: 'Choose a public name' })).toHaveCount(0);

	await verifyEmail(email);
	await page.getByRole('button', { name: 'I’ve verified my account' }).first().click();
	await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
	await expect(page.getByRole('dialog', { name: 'Choose a public name' })).toHaveCount(0);

	const owner = await signInRest(email);
	await createDoc(owner.idToken, reactionId, {
		reactorId: field.str(owner.localId),
		reactorDisplayName: field.str(mailbox),
		isPublished: field.bool(false),
		reactionVideoId: field.str('dQw4w9WgxcQ'),
		reactionVideoTitle: field.str(`Reaction ${stamp}`),
		originalVideoId: field.str('abcdefghijk'),
		originalVideoTitle: field.str('Original video')
	});

	await page.goto(`/reaction/${reactionId}`);
	await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
	await expect(page.getByRole('link', { name: `Open Pure Reactions profile for ${mailbox}` })).toBeVisible();
	await openPublishMenu(page);

	const ageDialog = page.getByRole('dialog', { name: 'Confirm your age' });
	await expect(ageDialog).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Choose a public name' })).toHaveCount(0);
	await ageDialog.getByRole('checkbox', { name: 'I am 15 or older.' }).check();
	await ageDialog.getByRole('button', { name: 'Confirm' }).click();

	const nameDialog = page.getByRole('dialog', { name: 'Choose a public name' });
	await expect(nameDialog).toBeVisible();
	await expect(nameDialog.getByLabel('Display name')).toHaveValue(mailbox);
	await expect(nameDialog.getByRole('button', { name: 'Save and publish' })).toBeDisabled();

	await nameDialog.getByRole('button', { name: 'Not now' }).click();
	await expect(nameDialog).toHaveCount(0);
	await expect(page.getByRole('alert')).toHaveCount(0);
	let stored = await readDoc(reactionId);
	expect(stored.fields.isPublished.booleanValue).toBe(false);
	expect(stored.fields.reactorDisplayName.stringValue).toBe(mailbox);

	await openPublishMenu(page);
	await expect(page.getByRole('dialog', { name: 'Confirm your age' })).toHaveCount(0);
	await expect(nameDialog).toBeVisible();
	await nameDialog.getByLabel('Display name').fill(mailbox.toUpperCase());
	await expect(nameDialog.getByRole('button', { name: 'Save and publish' })).toBeDisabled();
	await nameDialog.getByLabel('Display name').fill(chosenName);
	await nameDialog.getByRole('button', { name: 'Save and publish' }).click();

	await expect(nameDialog).toHaveCount(0);
	await expect.poll(async () => (await readDoc(reactionId)).fields.isPublished.booleanValue).toBe(true);
	stored = await readDoc(reactionId);
	expect(stored.fields.reactorDisplayName.stringValue).toBe(chosenName);

	await expect(async () => {
		await openAppMenu(page);
		await expect(page.getByRole('menuitem', { name: 'Unpublish Reaction' })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 20000 });
	await page.getByRole('menuitem', { name: 'Unpublish Reaction' }).click();
	await expect(page.getByRole('dialog', { name: 'Choose a public name' })).toHaveCount(0);
	await expect.poll(async () => (await readDoc(reactionId)).fields.isPublished.booleanValue).toBe(false);

	await expect(async () => {
		await openAppMenu(page);
		await expect(page.getByRole('menuitem', { name: 'Publish Reaction' })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 20000 });
	await page.getByRole('menuitem', { name: 'Publish Reaction' }).click();
	await expect(page.getByRole('dialog', { name: 'Choose a public name' })).toHaveCount(0);
	await expect.poll(async () => (await readDoc(reactionId)).fields.isPublished.booleanValue).toBe(true);
	stored = await readDoc(reactionId);
	expect(stored.fields.reactorDisplayName.stringValue).toBe(chosenName);
});

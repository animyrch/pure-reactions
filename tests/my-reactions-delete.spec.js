import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const envOrFile = (name, fallback) => {
	if (process.env[name]) return process.env[name];
	try {
		const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
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
const PLAYLIST_COLLECTION = envOrFile('PUBLIC_FIREBASE_COLLECTION_PLAYLISTS', 'playlists_local');
const MOMENT_COLLECTION = envOrFile('PUBLIC_FIREBASE_COLLECTION_MOMENTS', 'moments_local');

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8086';
const AUTH_PROJECT = process.env.GCLOUD_PROJECT || 'demo-pure-reactions';
const PASSWORD = 'Reactions1!';

const field = {
	str: (value) => ({ stringValue: value }),
	bool: (value) => ({ booleanValue: value }),
	int: (value) => ({ integerValue: String(value) }),
	time: (value) => ({ timestampValue: value }),
	list: (values) => ({ arrayValue: { values } })
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

async function createDoc(idToken, collectionName, documentId, fields) {
	const response = await fetch(
		`http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${AUTH_PROJECT}/databases/(default)/documents/${collectionName}?documentId=${encodeURIComponent(documentId)}`,
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
	return documentId;
}

async function readDoc(collectionName, documentId) {
	const response = await fetch(
		`http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${AUTH_PROJECT}/databases/(default)/documents/${collectionName}/${documentId}`
	);
	const payload = await response.json().catch(() => ({}));
	return { status: response.status, payload };
}

test('my reactions can delete a reaction or a playlist', async ({ page }) => {
	test.setTimeout(90000);
	const stamp = Date.now();
	const email = `delete-content-${stamp}@example.com`;
	const otherEmail = `delete-other-${stamp}@example.com`;
	const soloTitle = `Solo reaction ${stamp}`;
	const playlistTitle = `Playlist reaction ${stamp}`;
	const momentTitle = `Drop this moment ${stamp}`;
	const keptTitle = `Retain this moment ${stamp}`;
	const createdAt = '2026-01-01T00:00:00Z';

	await signUp(page, email);
	await verifyEmail(email);
	await page.getByRole('button', { name: 'I’ve verified my account' }).first().click();
	await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
	await expect(page.getByRole('button', { name: 'Delete reaction' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Delete playlist' })).toHaveCount(0);

	const owner = await signInRest(email);
	const other = await authRequest('accounts:signUp', {
		email: otherEmail,
		password: PASSWORD,
		returnSecureToken: true
	});
	expect(other.ok, JSON.stringify(other.payload)).toBe(true);

	const soloId = `solo-${stamp}`;
	const playlistId = `playlist-${stamp}`;
	const memberId = `member-${stamp}`;
	const momentId = `moment-${stamp}`;
	const momentReactionId = `moment-reaction-${stamp}`;
	const keptReactionId = `kept-reaction-${stamp}`;
	const otherReactionId = `other-reaction-${stamp}`;

	const reactionFields = (title, { playlist = '', published = false, moment = '' } = {}) => ({
		reactorId: field.str(owner.localId),
		playlistId: field.str(playlist),
		isPublished: field.bool(published),
		isMomentReaction: field.bool(Boolean(moment)),
		...(moment ? { momentId: field.str(moment) } : {}),
		reactionVideoTitle: field.str(title),
		reactionVideoId: field.str('dQw4w9WgxcQ'),
		originalVideoId: field.str('abcdefghijk'),
		originalVideoTitle: field.str('Original video'),
		createdAt: field.time(createdAt)
	});

	await createDoc(owner.idToken, REACTION_COLLECTION, soloId, reactionFields(soloTitle));
	await createDoc(
		owner.idToken,
		REACTION_COLLECTION,
		memberId,
		reactionFields(playlistTitle, { playlist: playlistId })
	);
	await createDoc(owner.idToken, PLAYLIST_COLLECTION, playlistId, {
		userId: field.str(owner.localId),
		reactionBinomeIds: field.list([field.str(memberId)]),
		createdAt: field.time(createdAt)
	});
	await createDoc(owner.idToken, MOMENT_COLLECTION, momentId, {
		creatorId: field.str(owner.localId),
		title: field.str('Delete moment'),
		reactionCount: field.int(2),
		createdAt: field.time(createdAt)
	});
	await createDoc(
		owner.idToken,
		REACTION_COLLECTION,
		momentReactionId,
		reactionFields(momentTitle, { published: true, moment: momentId })
	);
	await createDoc(
		owner.idToken,
		REACTION_COLLECTION,
		keptReactionId,
		reactionFields(keptTitle, { published: true, moment: momentId })
	);
	await createDoc(other.payload.idToken, REACTION_COLLECTION, otherReactionId, {
		reactorId: field.str(other.payload.localId),
		playlistId: field.str(''),
		isPublished: field.bool(false),
		reactionVideoTitle: field.str(`Other reaction ${stamp}`),
		createdAt: field.time(createdAt)
	});

	const forbidden = await page.evaluate(
		async ({ token, id }) => {
			const response = await fetch('/api/content/delete', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ kind: 'reaction', id })
			});
			return response.status;
		},
		{ token: owner.idToken, id: otherReactionId }
	);
	expect(forbidden).toBe(403);

	await page.goto('/my-reactions');
	const soloCard = page.locator('.thumbnail-card', { hasText: soloTitle });
	const playlistCard = page.locator('.thumbnail-card', { hasText: playlistTitle });
	const momentCard = page.locator('.thumbnail-card', { hasText: momentTitle });
	await expect(soloCard).toBeVisible({ timeout: 15000 });
	await expect(playlistCard).toBeVisible();
	await expect(momentCard).toBeVisible();
	await expect(page.getByText(keptTitle)).toBeVisible();

	await soloCard.getByRole('button', { name: 'Delete reaction' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: 'Delete this reaction?' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();
	await expect(soloCard).toBeVisible();

	await soloCard.getByRole('button', { name: 'Delete reaction' }).click();
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText('Reaction deleted.')).toBeVisible();
	await expect(soloCard).toHaveCount(0);

	await playlistCard.getByRole('button', { name: 'Delete playlist' }).click();
	await expect(dialog.getByRole('heading', { name: 'Delete this playlist?' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText('Playlist deleted.')).toBeVisible();
	await expect(playlistCard).toHaveCount(0);

	await momentCard.getByRole('button', { name: 'Delete reaction' }).click();
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(momentCard).toHaveCount(0);
	await expect(page.getByText(keptTitle)).toBeVisible();

	await expect.poll(async () => (await readDoc(REACTION_COLLECTION, soloId)).status).toBe(404);
	await expect.poll(async () => (await readDoc(REACTION_COLLECTION, memberId)).status).toBe(404);
	await expect.poll(async () => (await readDoc(PLAYLIST_COLLECTION, playlistId)).status).toBe(404);
	await expect.poll(async () => (await readDoc(REACTION_COLLECTION, momentReactionId)).status).toBe(404);
	expect((await readDoc(REACTION_COLLECTION, keptReactionId)).status).toBe(200);
	expect((await readDoc(REACTION_COLLECTION, otherReactionId)).status).toBe(200);

	const moment = await readDoc(MOMENT_COLLECTION, momentId);
	expect(moment.payload.fields?.reactionCount?.integerValue).toBe('1');
});

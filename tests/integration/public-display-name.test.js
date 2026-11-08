import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { displayNameMatchesEmailLocalPart } from '../../src/lib/helpers/publicDisplayName.js';
import {
	beginPublishNameCheck,
	endPublishNameCheck,
	ensurePublicDisplayName,
	publicDisplayNameRequest,
	publishNameWasDeclined,
	settlePublicDisplayName
} from '../../src/lib/helpers/publicDisplayNamePrompt.js';

const mailboxUser = {
	uid: 'user-1',
	displayName: 'jane.doe',
	email: 'jane.doe@example.com'
};

describe('displayNameMatchesEmailLocalPart', () => {
	it('matches the mailbox when only case or surrounding spaces differ', () => {
		expect(displayNameMatchesEmailLocalPart(' Jane.Doe ', 'jane.doe@gmail.com')).toBe(true);
		expect(displayNameMatchesEmailLocalPart('name+tag', 'Name+Tag@example.com')).toBe(true);
	});

	it('does not match a chosen name, a blank name, or an address with no mailbox', () => {
		expect(displayNameMatchesEmailLocalPart('Jane', 'jane.doe@gmail.com')).toBe(false);
		expect(displayNameMatchesEmailLocalPart('', 'jane.doe@gmail.com')).toBe(false);
		expect(displayNameMatchesEmailLocalPart('jane.doe', '')).toBe(false);
		expect(displayNameMatchesEmailLocalPart('jane.doe', 'not-an-email')).toBe(false);
	});
});

describe('ensurePublicDisplayName', () => {
	it('continues without a prompt when the public name is already different', async () => {
		const allowed = await ensurePublicDisplayName(
			{ uid: 'user-2', displayName: 'Jane', email: 'jane.doe@gmail.com' },
			beginPublishNameCheck()
		);
		endPublishNameCheck();

		expect(allowed).toBe(true);
		expect(get(publicDisplayNameRequest)).toBeNull();
	});

	it('asks once for a batch of publishes and asks again on the next publish', async () => {
		const firstBatch = beginPublishNameCheck();
		const sameBatch = beginPublishNameCheck();
		expect(sameBatch).toBe(firstBatch);

		const first = ensurePublicDisplayName(mailboxUser, firstBatch);
		const second = ensurePublicDisplayName(mailboxUser, sameBatch);
		expect(get(publicDisplayNameRequest)?.displayName).toBe('jane.doe');

		settlePublicDisplayName(false);
		await expect(first).resolves.toBe(false);
		await expect(second).resolves.toBe(false);
		expect(publishNameWasDeclined()).toBe(true);
		expect(get(publicDisplayNameRequest)).toBeNull();

		const skipped = await ensurePublicDisplayName(mailboxUser, sameBatch);
		expect(skipped).toBe(false);
		expect(get(publicDisplayNameRequest)).toBeNull();

		endPublishNameCheck();
		endPublishNameCheck();

		const nextBatch = beginPublishNameCheck();
		expect(publishNameWasDeclined()).toBe(false);
		expect(nextBatch).not.toBe(firstBatch);
		const again = ensurePublicDisplayName(mailboxUser, nextBatch);
		expect(get(publicDisplayNameRequest)?.uid).toBe('user-1');
		settlePublicDisplayName(true);
		await expect(again).resolves.toBe(true);
		endPublishNameCheck();
		expect(get(publicDisplayNameRequest)).toBeNull();
	});
});

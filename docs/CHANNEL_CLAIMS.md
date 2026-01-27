# Channel Claims (V1)

This document captures the initial, manual YouTube channel claim workflow. It is intentionally scoped to claim creation and review only; no discovery or ranking changes are triggered in V1.

## Overview

- Logged-in viewers can submit a claim from a reaction page's Attribution section.
- Claims are stored in Firestore and reviewed manually via Firebase Console.
- Approval/rejection only updates the claim record status.

## Firestore Collection

**Collection:** `youtubeChannelClaims` (configurable via `PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS`)

**Document ID:** `{youtubeChannelId}__{userId}`

**Fields:**

- `userId`
- `youtubeChannelId` (channel handle in V1 if channel ID is unavailable)
- `youtubeChannelUrl`
- `verificationToken`
- `verificationVideoUrl`
- `status` (`pending` | `approved` | `rejected`)
- `createdAt`
- `expiresAt`
- `reviewNotes` (admin-only, optional)

## Claim Flow (Client -> Firestore)

1. Client generates a verification token.
2. User submits a verification video URL and confirms channel control.
3. Client writes the deterministic claim document with `status: pending`.
4. If a pending claim already exists for the same user + channel, it is reused.

## Manual Review (V1)

Admins verify:

- The verification video exists.
- The channel matches the claimed `youtubeChannelId` (handle in V1 if ID is unavailable).
- The video description contains the exact token.

Admins then set:

- `status = approved | rejected`
- Optional `reviewNotes`

When a claim is approved, also create/update a public verification document:

- **Collection:** `youtubeChannelVerifications`
- **Document ID:** `{youtubeChannelId}` (handle in V1)
- **Fields:** `status: approved`, optional `approvedAt`, optional `claimId`

This public verification record is what hides the Attribution/claim UI for all viewers.

**Final step (recommended):** Use the approval script so both updates happen together:

```bash
npm run approve:claim -- --claimId "<channelId>__<userId>"
```

## Discovery Impact

None in V1. Claim approval only affects claim state and does not alter reactions, Algolia, or homepage/search behavior.

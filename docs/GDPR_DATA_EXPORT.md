# GDPR Data Access & Export

## Purpose
This document describes how Pure Reactions fulfills GDPR data access requests (DSAR) through a self-service export flow. It aligns implementation with documented data mappings and clarifies what is included or excluded.

## Verified Data Map

### Firebase Authentication (Account Profile)
- **Scope**: Auth user record for the requesting user only.
- **Fields**: UID, email, emailVerified, displayName, photoURL, phoneNumber, provider data, custom claims, account metadata (creation/sign-in times).
- **Source**: Firebase Authentication (Admin SDK).

### Firestore (Primary Application Data)
- **Collections (user-scoped)**:
  - `userData` (doc ID = userId): bookmarks, follows, optional profile fields, `lastExportAt`.
  - `reactions`: documents where `reactorId == userId`.
  - `playlists`: documents where `userId == userId`.
  - `queues`: documents where `ownerId == userId`.
  - `youtubeChannelClaims`: documents where `userId == userId`.
  - `youtubeChannelVerifications`: documents whose channel IDs are referenced by the user’s claims.
- **Schema reference**: `docs/SCHEMA_REFERENCE.md`.

### Algolia (Search Index)
- **Index**: `ALGOLIA_REACTIONS_INDEX`.
- **Scope**: records whose `objectID` matches the user’s reaction document IDs.
- **Note**: Only published reactions are indexed; missing IDs are listed in the export.

### Firebase Realtime Database (Excluded)
- **Shared sessions** (`sharedSessions/{sessionId}`) are transient synchronization data and are **not exported**.

## Export Implementation
- **Endpoint**: `POST /api/account/export`.
- **Authentication**: Firebase ID token required; userId derived from token only.
- **Rate limit**: One export per user per 24 hours, enforced via `userData.lastExportAt`.
- **Determinism**: Export arrays are sorted by document ID / objectID.

## Export Format (JSON)
Top-level structure:
- `meta`: exportVersion, generatedAt, userId, counts, excluded categories, and notes.
- `data.auth`: Firebase Auth profile snapshot.
- `data.firestore`: grouped Firestore documents.
- `data.algolia`: search index records and missing object IDs.

## Extraction Limitations
- **Transient infrastructure logs** (Netlify/CDN/Firebase logs) are not stored for export.
- **Realtime shared session state** is excluded.
- **Deleted data** cannot be recovered or exported.
- **Third-party logs** (YouTube, Algolia analytics) are outside the export scope.

## Infrastructure Assumptions
- Netlify serverless runtime for API routes.
- Firebase Authentication for account identity.
- Firestore for primary application data.
- Algolia for search indexing.
- YouTube API for metadata lookup (not stored in export unless persisted in Firestore).

## Privacy Policy Alignment
- Privacy policy references self-service exports and lists included/excluded data.
- Any future changes to export behavior must update:
  1. `src/routes/privacy/+page.svelte`
  2. `docs/SCHEMA_REFERENCE.md`
  3. This document

## Version History
- 2026-01-30: Initial GDPR export documentation.
